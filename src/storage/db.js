/* Offline storage service (IndexedDB).
 * Stores: customers, sessions, photos (with image Blobs), templates (custom),
 *         calibrations (history), settings (key/value), activity (log).
 * Falls back to an in-memory store if IndexedDB is blocked, and reports it. */
(function (root) {
  "use strict";
  const SM = (root.SM = root.SM || {});
  const NAME = "stitchmeasure-ai", VERSION = 1;
  const STORES = {
    customers: { keyPath: "id", indexes: ["updatedAt"] },
    sessions: { keyPath: "id", indexes: ["customerId", "updatedAt"] },
    photos: { keyPath: "id", indexes: ["customerId", "sessionId", "createdAt"] },
    templates: { keyPath: "id", indexes: [] },
    calibrations: { keyPath: "id", indexes: ["photoId"] },
    settings: { keyPath: "key", indexes: [] },
    activity: { keyPath: "id", indexes: ["at"] }
  };
  let dbp = null, memory = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve) => {
      if (!root.indexedDB) { memory = {}; return resolve(null); }
      let req;
      try { req = indexedDB.open(NAME, VERSION); } catch (e) { memory = {}; return resolve(null); }
      req.onupgradeneeded = () => {
        const db = req.result;
        Object.entries(STORES).forEach(([name, def]) => {
          if (db.objectStoreNames.contains(name)) return;
          const s = db.createObjectStore(name, { keyPath: def.keyPath });
          def.indexes.forEach((i) => s.createIndex(i, i));
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { memory = {}; resolve(null); };
      req.onblocked = () => { /* another tab holds an old version */ };
    });
    return dbp;
  }
  const mem = (store) => (memory[store] = memory[store] || new Map());
  const key = (store, obj) => obj[STORES[store].keyPath];

  async function tx(store, mode, fn) {
    const db = await open();
    if (!db) return fn(null);
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode), s = t.objectStore(store);
      let result;
      Promise.resolve(fn(s)).then((r) => (result = r));
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error("Storage transaction aborted (the device may be out of space)."));
    });
  }
  const req2p = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  const api = {
    get inMemory() { return !!memory; },
    open,
    async get(store, id) {
      await open(); if (memory) return mem(store).get(id) || null;
      return tx(store, "readonly", (s) => req2p(s.get(id))).then((r) => r || null);
    },
    async put(store, obj) {
      await open(); if (memory) { mem(store).set(key(store, obj), obj); return obj; }
      await tx(store, "readwrite", (s) => { s.put(obj); });
      return obj;
    },
    async putMany(store, list) {
      await open(); if (memory) { list.forEach((o) => mem(store).set(key(store, o), o)); return; }
      await tx(store, "readwrite", (s) => { list.forEach((o) => s.put(o)); });
    },
    async del(store, id) {
      await open(); if (memory) { mem(store).delete(id); return; }
      await tx(store, "readwrite", (s) => { s.delete(id); });
    },
    async all(store) {
      await open(); if (memory) return Array.from(mem(store).values());
      return tx(store, "readonly", (s) => req2p(s.getAll()));
    },
    async where(store, index, value) {
      await open(); if (memory) return Array.from(mem(store).values()).filter((o) => o[index] === value);
      return tx(store, "readonly", (s) => req2p(s.index(index).getAll(value)));
    },
    async clear(store) {
      await open(); if (memory) { mem(store).clear(); return; }
      await tx(store, "readwrite", (s) => { s.clear(); });
    },
    async clearAll() { for (const s of Object.keys(STORES)) await api.clear(s); },
    async setting(k, fallback) { const r = await api.get("settings", k); return r ? r.value : fallback; },
    async setSetting(k, v) { return api.put("settings", { key: k, value: v }); },
    async log(text, ref) {
      const a = { id: "act_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at: new Date().toISOString(), text, ref: ref || null };
      await api.put("activity", a);
      return a;
    },
    async estimate() {
      try { if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate(); } catch (e) {}
      return null;
    },
    async persist() {
      try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) {}
      return false;
    },
    async persisted() {
      try { if (navigator.storage && navigator.storage.persisted) return await navigator.storage.persisted(); } catch (e) {}
      return false;
    },
    STORES: Object.keys(STORES)
  };
  SM.db = api;
})(typeof window !== "undefined" ? window : globalThis);

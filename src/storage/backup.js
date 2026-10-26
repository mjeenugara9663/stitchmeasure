/* Backup, restore, profile export/import. Optional AES-GCM encryption with a
 * password (PBKDF2, 250k iterations). Files are versioned JSON. */
(function (root) {
  "use strict";
  const SM = (root.SM = root.SM || {});
  const VERSION = "1.0.0";

  async function photoOut(p, withImages) {
    const o = Object.assign({}, p);
    delete o.blob; delete o.thumb;
    if (withImages && p.blob) o.imageDataURL = await SM.util.blobToDataURL(p.blob);
    if (withImages && p.thumb) o.thumbDataURL = await SM.util.blobToDataURL(p.thumb);
    return o;
  }
  function photoIn(o) {
    const p = Object.assign({}, o);
    if (o.imageDataURL) p.blob = SM.util.dataURLToBlob(o.imageDataURL);
    if (o.thumbDataURL) p.thumb = SM.util.dataURLToBlob(o.thumbDataURL);
    delete p.imageDataURL; delete p.thumbDataURL;
    return p;
  }

  async function build(opts) {
    opts = opts || {};
    const only = opts.customerId;
    const customers = only ? [await SM.db.get("customers", only)].filter(Boolean) : await SM.db.all("customers");
    const ids = new Set(customers.map((c) => c.id));
    const sessions = (await SM.db.all("sessions")).filter((s) => ids.has(s.customerId));
    const photosRaw = opts.includePhotos === false ? [] : (await SM.db.all("photos")).filter((p) => ids.has(p.customerId));
    const photos = [];
    for (const p of photosRaw) photos.push(await photoOut(p, true));
    const data = {
      schema: only ? "stitchmeasure.profile/1" : "stitchmeasure.backup/1",
      app: "StitchMeasure AI", appVersion: VERSION, createdAt: new Date().toISOString(),
      customers, sessions, photos
    };
    if (!only) {
      data.templates = await SM.db.all("templates");
      data.calibrations = await SM.db.all("calibrations");
      data.settings = (await SM.db.all("settings")).filter((s) => s.key !== "pinHash");
    }
    return data;
  }

  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = (buf) => { let s = ""; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  async function keyFrom(password, salt) {
    const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function encrypt(obj, password) {
    if (!(root.crypto && crypto.subtle)) throw new Error("Encryption needs a secure context (HTTPS or localhost).");
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await keyFrom(password, salt);
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj)));
    return { schema: "stitchmeasure.encrypted/1", kdf: "PBKDF2-SHA256-250000", cipher: "AES-GCM-256", salt: b64(salt), iv: b64(iv), data: b64(ct) };
  }
  async function decrypt(wrap, password) {
    if (!(root.crypto && crypto.subtle)) throw new Error("Decryption needs a secure context (HTTPS or localhost).");
    const key = await keyFrom(password, unb64(wrap.salt));
    try {
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(wrap.iv) }, key, unb64(wrap.data));
      return JSON.parse(dec.decode(pt));
    } catch (e) { throw new Error("Wrong password, or the backup file is damaged."); }
  }

  /* merge a parsed backup/profile into the local database */
  async function restore(data) {
    if (!data || typeof data !== "object") throw new Error("This file is not a StitchMeasure backup.");
    if (!/^stitchmeasure\.(backup|profile)\/1$/.test(data.schema || "")) throw new Error("Unsupported file format: " + (data.schema || "unknown") + ".");
    const counts = { customers: 0, sessions: 0, photos: 0, templates: 0 };
    for (const c of data.customers || []) { if (c && c.id && c.name) { await SM.db.put("customers", c); counts.customers++; } }
    for (const s of data.sessions || []) { if (s && s.id && s.customerId) { await SM.db.put("sessions", s); counts.sessions++; } }
    for (const p of data.photos || []) { if (p && p.id && p.imageDataURL) { await SM.db.put("photos", photoIn(p)); counts.photos++; } }
    for (const t of data.templates || []) { if (t && t.id) { await SM.db.put("templates", t); counts.templates++; } }
    for (const k of data.calibrations || []) if (k && k.id) await SM.db.put("calibrations", k);
    for (const s of data.settings || []) if (s && s.key && s.key !== "pinHash") await SM.db.put("settings", s);
    return counts;
  }

  SM.backup = { VERSION, build, encrypt, decrypt, restore };
})(typeof window !== "undefined" ? window : globalThis);

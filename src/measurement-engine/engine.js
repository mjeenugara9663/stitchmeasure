/* Measurement engine: units, readings, statuses, tolerances, allowances,
 * comparison. Pure functions: no DOM, no storage, testable in Node.
 * All lengths are stored in centimetres; angles in degrees. */
(function (root) {
  "use strict";
  const SM = (root.SM = root.SM || {});

  const UNITS = { cm: { label: "cm", per: 1, dp: 1 }, mm: { label: "mm", per: 10, dp: 0 }, in: { label: "in", per: 1 / 2.54, dp: 2 } };

  const METHODS = {
    manual: "Manual measurement",
    camera: "Calibrated camera measurement",
    ai: "Experimental AI estimate",
    unavailable: "Unavailable"
  };
  const STATUS = {
    not_started: "Not started",
    captured: "Captured",
    estimated: "Estimated",
    requires_verification: "Requires verification",
    verified: "Verified",
    rejected: "Rejected"
  };
  const DEFAULT_TOL = { fitted: 0.5, semi: 1.0, loose: 1.5 }; // cm spread allowed between repeat readings

  const E = (SM.engine = { UNITS, METHODS, STATUS, DEFAULT_TOL, SCHEMA_SESSION: "stitchmeasure.session/1" });

  E.isAngle = (id) => { const e = SM.catalog && SM.catalog.get(id); return !!(e && e.kind === "angle"); };

  /* unit conversion */
  E.toUnit = (cm, unit) => cm * (UNITS[unit] || UNITS.cm).per;
  E.fromUnit = (v, unit) => v / (UNITS[unit] || UNITS.cm).per;
  E.format = (cm, unit, id) => {
    if (cm == null || !isFinite(cm)) return "–";
    if (id && E.isAngle(id)) return (+cm).toFixed(1) + "°";
    const u = UNITS[unit] || UNITS.cm;
    return (cm * u.per).toFixed(u.dp);
  };
  E.unitLabel = (unit, id) => (id && E.isAngle(id) ? "°" : (UNITS[unit] || UNITS.cm).label);
  /* parse user input in display unit → stored value (cm or degrees) */
  E.parse = (text, unit, id) => {
    const v = parseFloat(String(text).replace(",", "."));
    if (!isFinite(v) || v <= 0) return null;
    return id && E.isAngle(id) ? v : E.fromUnit(v, unit);
  };

  E.newItem = () => ({ readings: [], value: null, method: null, status: "not_started", verified: null, rejected: null, ease: null, design: null, note: "" });

  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  E.spread = (item) => {
    const r = (item.readings || []).map((x) => x.v);
    return r.length > 1 ? Math.max.apply(null, r) - Math.min.apply(null, r) : 0;
  };
  E.inconsistent = (item, tolCm) => (item.readings || []).length > 1 && E.spread(item) > tolCm + 1e-9;

  /* derived status — the single source of truth for status display */
  E.status = (item, entry) => {
    if (!item || item.value == null) return item && item.rejected ? "rejected" : "not_started";
    if (item.rejected) return "rejected";
    if (item.verified) return "verified";
    if (item.method === "unavailable") return "not_started";
    if (item.method === "ai") return "estimated";
    if (item.method === "camera") return entry && !entry.critical ? "captured" : "requires_verification";
    return "captured";
  };
  E.classification = (item) => {
    if (!item || item.value == null) return item && item.method === "unavailable" ? METHODS.unavailable : "—";
    if (item.verified) return "Professionally verified";
    return METHODS[item.method] || METHODS.manual;
  };
  /* needs a tape check before it can be used for cutting */
  E.needsVerification = (item, entry) => {
    const s = E.status(item, entry);
    if (s === "requires_verification" || s === "estimated") return true;
    if (s === "captured" && item.method !== "manual" && entry && entry.critical) return true;
    return false;
  };

  /* add one reading. Refuses to touch a verified value unless force=true. */
  E.addReading = (item, valueCm, method, opts) => {
    opts = opts || {};
    if (item.verified && !opts.force) return { ok: false, reason: "verified" };
    if (!(valueCm > 0)) return { ok: false, reason: "invalid" };
    if (item.verified && opts.force) item.verified = null;
    item.rejected = null;
    item.readings.push({ v: +valueCm, method: method || "manual", at: opts.at || new Date().toISOString(), by: opts.by || "", photoId: opts.photoId || null });
    const sameMethod = item.readings.filter((r) => r.method === (method || "manual"));
    item.method = method || "manual";
    item.value = Math.round(mean(sameMethod.map((r) => r.v)) * 10) / 10;
    return { ok: true };
  };
  /* replace all readings with a single value */
  E.setValue = (item, valueCm, method, opts) => {
    opts = opts || {};
    if (item.verified && !opts.force) return { ok: false, reason: "verified" };
    item.readings = [];
    item.verified = null;
    return E.addReading(item, valueCm, method, opts);
  };
  E.removeReading = (item, idx, opts) => {
    if (item.verified && !(opts && opts.force)) return { ok: false, reason: "verified" };
    item.readings.splice(idx, 1);
    if (!item.readings.length) { item.value = null; item.method = null; item.verified = null; }
    else { const m = item.readings[item.readings.length - 1].method; item.method = m; item.value = Math.round(mean(item.readings.filter((r) => r.method === m).map((r) => r.v)) * 10) / 10; }
    return { ok: true };
  };
  E.verify = (item, by) => {
    if (item.value == null) return { ok: false, reason: "empty" };
    item.verified = { by: by || "", at: new Date().toISOString() }; item.rejected = null;
    return { ok: true };
  };
  E.unverify = (item) => { item.verified = null; return { ok: true }; };
  E.reject = (item, reason) => { item.rejected = { reason: reason || "", at: new Date().toISOString() }; item.verified = null; return { ok: true }; };

  /* finished garment measurement = body + ease + design allowance.
   * Seam allowance is NOT added: it belongs to the pattern, not the finished size. */
  E.finished = (item) => {
    if (!item || item.value == null) return null;
    if (item.ease == null && item.design == null) return null;
    return Math.round((item.value + (item.ease || 0) + (item.design || 0)) * 10) / 10;
  };

  E.summary = (session, ids) => {
    const items = (session && session.items) || {};
    let done = 0, verify = 0, verified = 0;
    ids.forEach((id) => {
      const it = items[id]; if (!it || it.value == null) return;
      done++;
      const entry = SM.catalog && SM.catalog.get(id);
      if (it.verified) verified++; else if (E.needsVerification(it, entry)) verify++;
    });
    return { total: ids.length, done, verify, verified, complete: ids.length > 0 && done === ids.length };
  };

  E.compare = (a, b, ids) => ids.map((id) => {
    const x = a.items[id], y = b.items[id];
    const va = x && x.value != null ? x.value : null, vb = y && y.value != null ? y.value : null;
    return { id, a: va, b: vb, diff: va != null && vb != null ? Math.round((vb - va) * 10) / 10 : null };
  });

  E.newSession = (customerId, templateId, by) => ({
    schema: E.SCHEMA_SESSION, id: "ses_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    customerId, templateId, date: new Date().toISOString().slice(0, 10), designer: by || "",
    remarks: "", seamAllowanceCm: null, items: {}, customDefs: [], order: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
})(typeof window !== "undefined" ? window : globalThis);

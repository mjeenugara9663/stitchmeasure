/* App settings (stored in IndexedDB 'settings'). */
(function (root) {
  "use strict";
  const SM = (root.SM = root.SM || {});
  const DEFAULTS = {
    unit: "cm", theme: "system", language: "en", designer: "", keepPhotos: true,
    tolerance: { fitted: 0.5, semi: 1.0, loose: 1.5 }, seamAllowanceCm: 1.5,
    countdown: 3, gridDensity: 8, gridOpacity: 0.5, overlayOpacity: 0.7, mirrorFront: true,
    privacyAccepted: false, cameraConsent: false, lastBackupAt: null, pinEnabled: false
  };
  const S = {
    values: JSON.parse(JSON.stringify(DEFAULTS)),
    async load() {
      const rows = await SM.db.all("settings");
      rows.forEach((r) => { if (r.key in DEFAULTS) S.values[r.key] = r.value; });
      S.applyTheme();
      return S.values;
    },
    async set(k, v) { S.values[k] = v; await SM.db.setSetting(k, v); if (k === "theme") S.applyTheme(); },
    applyTheme() {
      const t = S.values.theme;
      if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
      else document.documentElement.removeAttribute("data-theme");
      const meta = document.querySelector('meta[name="theme-color"]');
      const dark = t === "dark" || (t === "system" && root.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
      if (meta) meta.setAttribute("content", dark ? "#080C20" : "#0B1028");
    },
    /* simple app lock: SHA-256 of salt+PIN. Deters casual access only. */
    async hashPin(pin) {
      const data = new TextEncoder().encode("stitchmeasure:" + pin);
      if (root.crypto && crypto.subtle) { const h = await crypto.subtle.digest("SHA-256", data); return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join(""); }
      let h = 0; for (const b of data) h = (h * 31 + b) >>> 0; return "weak:" + h.toString(16);
    },
    async setPin(pin) { await SM.db.setSetting("pinHash", pin ? await S.hashPin(pin) : null); await S.set("pinEnabled", !!pin); },
    async checkPin(pin) { const h = await SM.db.setting("pinHash", null); return !!h && h === (await S.hashPin(pin)); },
    DEFAULTS
  };
  SM.settings = S;
})(typeof window !== "undefined" ? window : globalThis);

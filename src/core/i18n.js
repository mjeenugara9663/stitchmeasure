/* StitchMeasure AI — text system.
 * English text is the lookup key, so a translation file only has to map
 * English phrases to the target language. The measurement engine never
 * depends on display text; it uses stable measurement ids.
 * Add a language: SM.i18n.add("kn", { "Customers": "ಗ್ರಾಹಕರು", ... })
 */
(function (root) {
  "use strict";
  const SM = (root.SM = root.SM || {});
  const dicts = { en: {} };
  let lang = "en";
  SM.i18n = {
    add(code, map) { dicts[code] = Object.assign(dicts[code] || {}, map); },
    set(code) { lang = dicts[code] ? code : "en"; },
    get lang() { return lang; },
    languages() { return Object.keys(dicts); },
    /* catalog text can be overridden per id: SM.i18n.add("kn", {"m:chest:name": "..."}) */
    catalog(id, field, fallback) {
      const d = dicts[lang] || {};
      return d["m:" + id + ":" + field] || fallback;
    }
  };
  /* t("Hello {name}", {name:"Asha"}) */
  SM.t = function (key, vars) {
    let s = (dicts[lang] && dicts[lang][key]) || key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    return s;
  };
})(typeof window !== "undefined" ? window : globalThis);

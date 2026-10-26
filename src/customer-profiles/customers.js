/* Customer profile service (data layer). UI lives in src/app.js views. */
(function (root) {
  "use strict";
  const SM = (root.SM = root.SM || {});
  const SCHEMA = "stitchmeasure.customer/1";

  const TEMPLATES = { women: "Women", men: "Men", girls: "Girls", boys: "Boys", unisex: "Unisex", custom: "Custom" };
  const AGE_GROUPS = { adult: "Adult", child: "Child" };

  async function nextCode() {
    const all = await SM.db.all("customers");
    let max = 0;
    all.forEach((c) => { const m = /^SM-(\d+)$/.exec(c.code || ""); if (m) max = Math.max(max, +m[1]); });
    return "SM-" + String(max + 1).padStart(4, "0");
  }

  function blank() {
    return {
      schema: SCHEMA, id: SM.util.uid("cus"), code: "", name: "", phone: "", ageGroup: "adult", age: "",
      template: "women", heightCm: null, garment: "", unit: "", designer: "", notes: "",
      consent: { photos: false, guardian: { name: "", given: false } },
      profilePhotoId: null, sample: false,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
  }

  /* validation used by the form and by imports */
  function validate(c) {
    const errs = [];
    if (!c.name || !c.name.trim()) errs.push("Enter the customer's name.");
    if (c.ageGroup === "child" && c.consent && c.consent.photos && !(c.consent.guardian && c.consent.guardian.given && c.consent.guardian.name)) errs.push("Photos of a child need a guardian's name and consent.");
    if (c.heightCm != null && !(c.heightCm > 30 && c.heightCm < 260)) errs.push("Height looks wrong. Enter it in the selected unit.");
    return errs;
  }

  const svc = {
    SCHEMA, TEMPLATES, AGE_GROUPS, blank, validate, nextCode,
    async list() { const a = await SM.db.all("customers"); return a.sort((x, y) => (y.updatedAt || "").localeCompare(x.updatedAt || "")); },
    get: (id) => SM.db.get("customers", id),
    async save(c) {
      if (!c.code) c.code = await nextCode();
      c.updatedAt = new Date().toISOString();
      if (!c.createdAt) c.createdAt = c.updatedAt;
      await SM.db.put("customers", c);
      return c;
    },
    async duplicate(id) {
      const c = await svc.get(id); if (!c) return null;
      const d = JSON.parse(JSON.stringify(c));
      d.id = SM.util.uid("cus"); d.code = await nextCode(); d.name = c.name + " (copy)"; d.profilePhotoId = null; d.sample = false;
      d.createdAt = d.updatedAt = new Date().toISOString();
      await SM.db.put("customers", d);
      // copy the latest measurement session (photos are not copied, for privacy)
      const ses = await svc.sessions(id);
      if (ses[0]) { const s = JSON.parse(JSON.stringify(ses[0])); s.id = SM.util.uid("ses"); s.customerId = d.id; s.createdAt = s.updatedAt = d.createdAt; await SM.db.put("sessions", s); }
      return d;
    },
    async remove(id) {
      for (const s of await SM.db.where("sessions", "customerId", id)) await SM.db.del("sessions", s.id);
      for (const p of await SM.db.where("photos", "customerId", id)) await SM.db.del("photos", p.id);
      await SM.db.del("customers", id);
    },
    async sessions(customerId) { const a = await SM.db.where("sessions", "customerId", customerId); return a.sort((x, y) => (y.date + y.updatedAt).localeCompare(x.date + x.updatedAt)); },
    async photos(customerId) { const a = await SM.db.where("photos", "customerId", customerId); return a.sort((x, y) => y.createdAt.localeCompare(x.createdAt)); }
  };
  SM.customers = svc;
})(typeof window !== "undefined" ? window : globalThis);

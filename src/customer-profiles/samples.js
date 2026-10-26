/* Sample customer profiles for training and testing. Every record is
 * marked sample:true and shown with a "Sample" badge. Values are manual
 * tape measurements typed in for demonstration, not real people. */
(function (root) {
  "use strict";
  const SM = (root.SM = root.SM || {});
  const D = [
    { code: "SM-S001", name: "Sample · Meera R.", ageGroup: "adult", template: "women", heightCm: 158, garment: "w_saree_blouse",
      vals: { full_bust: 86.5, upper_bust: 82, underbust: 72.5, waist: 70, shoulder_width: 36.5, shoulder_length: 12, across_front: 31, across_back: 33, bust_point_height: 24.5, bust_separation: 17.5, armhole: 39, upper_arm: 27, neck_base: 36, front_neck_depth: 18, back_neck_depth: 22, short_sleeve: 15, sleeve_opening: 26, front_waist_length: 38, back_waist_length: 37 },
      verified: ["full_bust", "waist", "shoulder_width"], camera: ["back_waist_length"] },
    { code: "SM-S002", name: "Sample · Arun K.", ageGroup: "adult", template: "men", heightCm: 174, garment: "m_formal_shirt",
      vals: { neck_circ: 39, full_chest: 98, waist: 86, abdomen: 90, hip: 99, shoulder_width: 45.5, across_back: 41, full_arm: 62, bicep: 31, elbow_circ: 27.5, wrist: 17.5, armhole: 47, back_body_length: 76 },
      verified: ["neck_circ", "full_chest"], camera: ["shoulder_width"] },
    { code: "SM-S003", name: "Sample · Diya (child)", ageGroup: "child", age: "8", template: "girls", heightCm: 128, garment: "k_frock",
      vals: { full_chest: 62, waist: 56, shoulder_width: 28, armhole: 30, upper_arm: 19, short_sleeve: 10, back_waist_length: 27, full_garment_length: 70, height: 128 },
      verified: [], camera: [], guardian: "Sample guardian" }
  ];
  async function load() {
    const made = [];
    for (const d of D) {
      const c = SM.customers.blank();
      Object.assign(c, { code: d.code, name: d.name, ageGroup: d.ageGroup, age: d.age || "", template: d.template, heightCm: d.heightCm, garment: d.garment, sample: true, notes: "Sample profile for practice. Delete any time." });
      if (d.guardian) c.consent.guardian = { name: d.guardian, given: true };
      await SM.db.put("customers", c);
      const s = SM.engine.newSession(c.id, d.garment, "Sample");
      s.seamAllowanceCm = 1.5;
      Object.entries(d.vals).forEach(([id, v]) => {
        const it = SM.engine.newItem();
        SM.engine.setValue(it, v, d.camera.includes(id) ? "camera" : "manual", { by: "Sample" });
        if (d.verified.includes(id)) SM.engine.verify(it, "Sample");
        s.items[id] = it;
      });
      if (s.items.full_bust) { s.items.full_bust.ease = 5; }
      if (s.items.full_chest) { s.items.full_chest.ease = 10; }
      await SM.db.put("sessions", s);
      made.push(c);
    }
    await SM.db.log("Loaded " + made.length + " sample profiles");
    return made;
  }
  SM.samples = { data: D, load };
})(typeof window !== "undefined" ? window : globalThis);

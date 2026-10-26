/* Garment measurement templates. Each template is an ordered checklist of
 * catalog ids. Tailors can copy and customise any template (stored in IndexedDB).
 * Ease / design / seam allowances are kept separately from body measurements
 * (see engine.finished()) and are never merged into body values. */
(function (root) {
  "use strict";
  const SM = (root.SM = root.SM || {});

  const T = (id, group, name, fit, items) => ({ id, group, name, fit, items, builtin: true, schema: "stitchmeasure.template/1" });
  const TOP_W = ["full_bust", "upper_bust", "underbust", "waist", "shoulder_width", "shoulder_length", "across_front", "across_back", "bust_point_height", "bust_separation", "armhole", "upper_arm", "neck_base"];
  const TOP_M = ["neck_circ", "full_chest", "waist", "abdomen", "hip", "shoulder_width", "across_back", "full_arm", "bicep", "wrist", "armhole", "back_waist_length"];
  const LOW = ["waist", "high_hip", "hip", "thigh", "knee", "calf", "ankle", "crotch_depth", "front_rise", "back_rise", "inseam", "outseam"];

  const BUILTIN = [
    // Women
    T("w_saree_blouse", "Women", "Saree blouse", "fitted", [...TOP_W, "front_neck_depth", "back_neck_depth", "short_sleeve", "sleeve_opening", "front_waist_length", "back_waist_length"]),
    T("w_designer_blouse", "Women", "Designer blouse", "fitted", [...TOP_W, "shoulder_to_bust", "front_neck_depth", "back_neck_depth", "short_sleeve", "three_quarter_sleeve", "sleeve_opening", "front_waist_length", "back_waist_length", "high_waist"]),
    T("w_kurti", "Women", "Kurti", "semi", ["full_bust", "waist", "high_hip", "full_hip", "shoulder_width", "armhole", "upper_arm", "bust_point_height", "front_neck_depth", "back_neck_depth", "three_quarter_sleeve", "full_arm", "wrist", "full_garment_length"]),
    T("w_salwar_suit", "Women", "Salwar suit", "semi", ["full_bust", "waist", "full_hip", "shoulder_width", "armhole", "upper_arm", "front_neck_depth", "back_neck_depth", "full_arm", "wrist", "full_garment_length", "thigh", "knee", "ankle", "waist_to_floor_legs", "crotch_depth"]),
    T("w_anarkali", "Women", "Anarkali", "semi", ["full_bust", "underbust", "waist", "high_waist", "full_hip", "shoulder_width", "armhole", "upper_arm", "bust_point_height", "front_neck_depth", "back_neck_depth", "full_arm", "wrist", "neck_to_floor", "full_garment_length"]),
    T("w_lehenga", "Women", "Lehenga", "fitted", ["waist", "mid_waist", "high_hip", "full_hip", "waist_to_hip", "waist_to_floor", "full_bust", "underbust", "shoulder_width", "armhole", "front_waist_length", "back_waist_length", "front_neck_depth", "back_neck_depth"]),
    T("w_skirt", "Women", "Skirt", "semi", ["waist", "high_hip", "full_hip", "waist_to_hip", "waist_to_floor", "shorts_length"]),
    T("w_dress", "Women", "Dress", "semi", ["full_bust", "underbust", "waist", "full_hip", "shoulder_width", "armhole", "upper_arm", "bust_point_height", "bust_separation", "front_waist_length", "back_waist_length", "short_sleeve", "full_garment_length"]),
    T("w_evening_gown", "Women", "Evening gown", "fitted", ["full_bust", "upper_bust", "underbust", "waist", "high_hip", "full_hip", "shoulder_width", "bust_point_height", "bust_separation", "front_waist_length", "back_waist_length", "back_neck_depth", "neck_to_floor", "waist_to_floor", "armhole"]),
    T("w_bridal_gown", "Women", "Bridal gown", "fitted", ["full_bust", "upper_bust", "underbust", "waist", "high_waist", "high_hip", "full_hip", "shoulder_width", "shoulder_length", "bust_point_height", "bust_separation", "shoulder_to_bust", "front_waist_length", "back_waist_length", "front_neck_depth", "back_neck_depth", "armhole", "upper_arm", "full_arm", "wrist", "neck_to_floor", "waist_to_floor", "height"]),
    T("w_western_top", "Women", "Western top", "semi", ["full_bust", "underbust", "waist", "high_hip", "shoulder_width", "armhole", "upper_arm", "short_sleeve", "front_body_length", "back_body_length"]),
    T("w_pants", "Women", "Pants", "semi", LOW.concat(["mid_thigh"])),
    T("w_jacket", "Women", "Jacket", "semi", ["full_bust", "waist", "full_hip", "shoulder_width", "across_back", "across_front", "armhole", "bicep", "full_arm", "wrist", "back_waist_length", "back_body_length"]),
    T("w_coat", "Women", "Coat", "loose", ["full_bust", "waist", "full_hip", "shoulder_width", "across_back", "armhole", "bicep", "full_arm", "wrist", "back_body_length", "neck_base"]),
    // Men
    T("m_formal_shirt", "Men", "Formal shirt", "semi", ["neck_circ", "full_chest", "waist", "abdomen", "hip", "shoulder_width", "across_back", "full_arm", "bicep", "elbow_circ", "wrist", "armhole", "back_body_length"]),
    T("m_casual_shirt", "Men", "Casual shirt", "loose", ["neck_circ", "full_chest", "waist", "hip", "shoulder_width", "full_arm", "short_sleeve", "bicep", "wrist", "back_body_length"]),
    T("m_tshirt", "Men", "T-shirt", "loose", ["full_chest", "waist", "shoulder_width", "short_sleeve", "bicep", "neck_base", "back_body_length"]),
    T("m_trousers", "Men", "Trousers", "semi", LOW.concat(["trouser_length", "leg_opening"])),
    T("m_jeans", "Men", "Jeans", "fitted", ["waist", "high_hip", "hip", "thigh", "knee", "calf", "ankle", "front_rise", "back_rise", "inseam", "outseam", "leg_opening"]),
    T("m_kurta", "Men", "Kurta", "semi", ["neck_circ", "full_chest", "waist", "abdomen", "hip", "shoulder_width", "armhole", "full_arm", "bicep", "wrist", "full_garment_length"]),
    T("m_sherwani", "Men", "Sherwani", "fitted", ["neck_circ", "full_chest", "waist", "abdomen", "hip", "shoulder_width", "across_back", "across_front", "armhole", "full_arm", "bicep", "wrist", "back_waist_length", "full_garment_length", "height"]),
    T("m_suit", "Men", "Suit", "fitted", [...TOP_M, "across_front", "shoulder_slope", "back_body_length", "front_rise", "back_rise", "inseam", "outseam", "thigh", "knee", "leg_opening"]),
    T("m_blazer", "Men", "Blazer", "fitted", [...TOP_M, "across_front", "shoulder_slope", "back_body_length"]),
    T("m_jacket", "Men", "Jacket", "semi", ["neck_circ", "full_chest", "waist", "hip", "shoulder_width", "across_back", "full_arm", "bicep", "wrist", "back_body_length"]),
    T("m_waistcoat", "Men", "Waistcoat", "fitted", ["full_chest", "waist", "abdomen", "shoulder_width", "across_back", "armhole", "back_waist_length", "front_body_length", "neck_base"]),
    // Children
    T("k_dress", "Children", "Dress", "loose", ["full_chest", "waist", "hip", "shoulder_width", "armhole", "short_sleeve", "back_waist_length", "full_garment_length", "height"]),
    T("k_frock", "Children", "Frock", "loose", ["full_chest", "waist", "shoulder_width", "armhole", "upper_arm", "short_sleeve", "back_waist_length", "full_garment_length", "height"]),
    T("k_shirt", "Children", "Shirt", "loose", ["neck_circ", "full_chest", "waist", "shoulder_width", "full_arm", "short_sleeve", "wrist", "back_body_length", "height"]),
    T("k_trousers", "Children", "Trousers", "loose", ["waist", "hip", "thigh", "knee", "ankle", "crotch_depth", "inseam", "outseam", "height"]),
    T("k_shorts", "Children", "Shorts", "loose", ["waist", "hip", "thigh", "crotch_depth", "shorts_length"]),
    T("k_traditional", "Children", "Traditional clothing", "semi", ["full_chest", "waist", "hip", "shoulder_width", "armhole", "full_arm", "wrist", "full_garment_length", "waist_to_floor", "ankle", "height"]),
    T("k_custom", "Children", "Custom garment", "semi", ["height", "full_chest", "waist", "hip"]),
    // Unisex / custom
    T("u_body_basic", "Unisex", "Basic body block", "semi", ["height", "neck_circ", "full_chest", "waist", "hip", "shoulder_width", "full_arm", "bicep", "wrist", "inseam", "outseam"]),
    T("u_full_profile", "Unisex", "Complete head-to-toe profile", "semi", null) // null = whole catalog
  ];

  SM.templates = {
    GROUPS: ["Women", "Men", "Children", "Unisex", "Custom"],
    FIT: { fitted: "Fitted", semi: "Semi-fitted", loose: "Loose" },
    builtin: BUILTIN,
    /* resolve the item list of a template (built-in or custom record) */
    items(t) {
      if (!t) return [];
      if (!t.items) return SM.catalog.all.map((e) => e.id);
      return t.items;
    },
    /* which groups suit a customer template choice (never forces; it only orders the list) */
    suggestedGroup(customerTemplate) {
      return { women: "Women", men: "Men", girls: "Children", boys: "Children", unisex: "Unisex", custom: "Custom" }[customerTemplate] || "Unisex";
    }
  };
})(typeof window !== "undefined" ? window : globalThis);

/* Head-to-toe measurement library.
 * Each entry: id, region, kind, name, view, camera, critical, geo, desc, how, pose
 *  kind:     circ | length | width | depth | height | angle
 *  camera:   true only for straight distances lying in the photo plane, which a
 *            calibrated photo can support. Circumferences and depths are tape-only.
 *  critical: stitching-critical; tape verification is required before use.
 *  geo:      drawing instructions for the reference illustration (figure units:
 *            y = fraction of standing height from top of head, x = offset from the
 *            body's centre line as a fraction of height; + is the figure's left side
 *            in front view and the front of the body in side view).
 */
(function (root) {
  "use strict";
  const SM = (root.SM = root.SM || {});

  const REGIONS = [
    { id: "head", name: "Head & neck" },
    { id: "shoulders", name: "Shoulders & upper body" },
    { id: "torso", name: "Waist & torso" },
    { id: "arms", name: "Arms & sleeves" },
    { id: "hips", name: "Hips & lower body" },
    { id: "legs", name: "Legs" },
    { id: "full", name: "Full body" }
  ];

  const KIND_LABEL = { circ: "Circumference", length: "Length", width: "Width", depth: "Depth", height: "Height", angle: "Angle" };

  const L = []; // entries
  function m(id, region, kind, name, view, camera, critical, geo, desc, how, pose) {
    L.push({ id, region, kind, name, view, camera: !!camera, critical: !!critical, geo: geo || [], desc, how, pose: pose || "fullFront" });
  }
  const C = (y, extra) => Object.assign({ t: "c", y }, extra || {});
  const H = (y, x1, x2, v) => ({ t: "h", y, x1, x2, v });
  const V = (x, y1, y2, v) => ({ t: "v", x, y1, y2, v });
  const Pl = (pts, v) => ({ t: "p", pts, v });

  /* A. Head and neck */
  m("head_circ", "head", "circ", "Head circumference", "front", 0, 0, [C("headCirc", { head: 1 })],
    "Around the head at its largest point, used for caps, turbans, hoods and headpieces.",
    "Pass the tape across the middle of the forehead, just above the ears, and around the fullest part of the back of the head. Keep it level and snug.", "upperFront");
  m("neck_circ", "head", "circ", "Neck circumference", "front", 0, 1, [C("neck")],
    "Around the middle of the neck. Sets collar size for shirts, kurtas and sherwanis.",
    "Wrap the tape around the neck just below the Adam's apple. Slip one finger under the tape for comfort and read the value.", "upperFront");
  m("neck_base", "head", "circ", "Neck base", "front", 0, 1, [C("neckBase")],
    "Around the base of the neck where a collar or neckline seam sits.",
    "Place the tape at the base of the neck, over the small bone at the back (nape) and across the top of the collarbones at the front.", "upperFront");
  m("neck_depth", "head", "depth", "Neck depth (front to back)", "side", 0, 0, [H("neckBase", -0.032, 0.035, "side")],
    "Straight-line depth of the neck base from front to back, used for drafting neckline curves.",
    "From the side, measure with a ruler or calliper between the front hollow of the neck and the nape, keeping it level.", "fullRight");
  m("front_neck_depth", "head", "depth", "Front neckline depth", "front", 0, 0, [V(0, "neckBase", 0.22)],
    "How deep the front neckline should drop below the neck base. This is a design choice, confirmed with the customer.",
    "Measure straight down from the hollow of the neck to the desired neckline point.", "upperFront");
  m("back_neck_depth", "head", "depth", "Back neckline depth", "back", 0, 0, [V(0, "neckBase", 0.25, "back")],
    "How deep the back neckline drops below the nape. A design choice, common in blouses and gowns.",
    "Measure straight down the spine from the nape bone to the desired back neckline point.", "upperBack");
  m("head_to_neck", "head", "length", "Head to neck", "side", 1, 0, [V(0.0, "headTop", "neckBase", "side")],
    "Vertical distance from the top of the head to the neck base. Useful for hoods and headwear fall.",
    "With the person standing straight, measure vertically from the crown to the level of the neck base.", "fullRight");

  /* B. Shoulders and upper body */
  m("shoulder_width", "shoulders", "width", "Shoulder width", "back", 1, 1, [H("shoulder", -0.115, 0.115, "back")],
    "Across the back from one shoulder tip to the other. Sets the shoulder line of shirts, blouses and jackets.",
    "From behind, measure from the outer bone point of one shoulder, across the base of the neck, to the other shoulder point.", "shoulder");
  m("shoulder_length", "shoulders", "length", "Individual shoulder length", "front", 1, 1, [Pl([[0.04, "neckBase"], [0.115, "shoulder"]])],
    "Length of one shoulder seam, from the side of the neck to the shoulder tip.",
    "Measure from where the neck meets the shoulder to the outer shoulder bone point.", "shoulder");
  m("shoulder_slope", "shoulders", "angle", "Shoulder slope", "front", 1, 0, [Pl([[0.04, "neckBase"], [0.115, "shoulder"]]), H("neckBase", 0.04, 0.13)],
    "Angle of the shoulder line below horizontal, in degrees. Helps fit square or sloping shoulders.",
    "From a straight-on front photo, compare the neck-to-shoulder line with a level line. Record degrees.", "shoulder");
  m("across_front", "shoulders", "width", "Across front", "front", 0, 1, [H("acrossFront", -0.088, 0.088)],
    "Across the upper chest from one arm crease to the other, about 5 cm below the shoulder line.",
    "With arms relaxed, measure across the chest between the folds where the arms meet the body.", "upperFront");
  m("across_back", "shoulders", "width", "Across back", "back", 0, 1, [H("acrossFront", -0.09, 0.09, "back")],
    "Across the shoulder blades from one arm crease to the other.",
    "With arms relaxed, measure across the back between the arm creases, about 10 cm below the nape.", "upperBack");
  m("upper_chest", "shoulders", "circ", "Upper chest", "front", 0, 1, [C("upperChest")],
    "Around the body high under the arms, above the bust.",
    "Place the tape high under both arms and across the top of the chest, keeping it level at the back.", "upperFront");
  m("full_chest", "shoulders", "circ", "Full chest", "front", 0, 1, [C("chest")],
    "Around the fullest part of the chest. The main fitting measurement for men's tops.",
    "Pass the tape under the arms and around the fullest part of the chest, level across the back. Breathe normally.", "upperFront");
  m("full_bust", "shoulders", "circ", "Full bust", "front", 0, 1, [C("chest")],
    "Around the fullest part of the bust. The main fitting measurement for blouses and dresses.",
    "Wearing the intended undergarment, measure around the fullest part of the bust, level across the back.", "upperFront");
  m("upper_bust", "shoulders", "circ", "Upper bust", "front", 0, 1, [C("upperChest")],
    "Around the chest above the bust, high under the arms.",
    "Measure around the body high under the arms and above the fullest part of the bust.", "upperFront");
  m("underbust", "shoulders", "circ", "Underbust", "front", 0, 1, [C("underbust")],
    "Around the ribcage just below the bust. Used for blouse bands, cholis and empire lines.",
    "Measure snugly around the ribcage directly under the bust, keeping the tape level.", "upperFront");
  m("bust_point_height", "shoulders", "length", "Bust point height", "front", 0, 1, [Pl([[0.04, "neckBase"], [0.05, "bustPoint"]])],
    "From the shoulder at the neck down to the bust point. Places darts correctly.",
    "Measure from the high point of the shoulder, next to the neck, straight down to the bust point.", "upperFront");
  m("bust_separation", "shoulders", "width", "Bust point separation", "front", 1, 1, [H("bustPoint", -0.05, 0.05)],
    "Distance between the two bust points. Sets dart positions in blouses.",
    "Measure straight across from one bust point to the other.", "upperFront");
  m("shoulder_to_bust", "shoulders", "length", "Shoulder to bust point", "front", 0, 1, [Pl([[0.115, "shoulder"], [0.05, "bustPoint"]])],
    "From the shoulder tip to the bust point.",
    "Measure from the outer shoulder point diagonally to the bust point.", "upperFront");
  m("armhole", "shoulders", "circ", "Armhole", "front", 0, 1, [C("armhole", { cx: 0.112, w: 0.024, vert: 1 })],
    "Around the arm at the shoulder joint, passing under the armpit. Sets the armhole of tops.",
    "Loop the tape from the shoulder point, down under the armpit and back up. Keep it comfortable, not tight.", "armRelaxed");
  m("upper_back_width", "shoulders", "width", "Upper back width", "back", 0, 0, [H("upperChest", -0.1, 0.1, "back")],
    "Across the upper back at armpit level.",
    "Measure across the back from armpit to armpit with arms relaxed.", "upperBack");

  /* C. Waist and torso */
  m("waist", "torso", "circ", "Natural waist circumference", "front", 0, 1, [C("waist")],
    "Around the natural waist, the narrowest part of the torso.",
    "Ask the person to bend sideways; the crease is the natural waist. Measure around it level and snug, without pulling in.", "waist");
  m("high_waist", "torso", "circ", "High waist", "front", 0, 1, [C("highWaist")],
    "Around the torso between underbust and natural waist. Used for empire and high-waist garments.",
    "Measure around the body about 5 cm above the natural waist.", "waist");
  m("mid_waist", "torso", "circ", "Mid waist", "front", 0, 1, [C("midWaist")],
    "Around the body between the natural waist and the navel. Common for saree petticoats and skirts.",
    "Measure around the body at the level where the garment waistband will sit.", "waist");
  m("abdomen", "torso", "circ", "Abdomen circumference", "front", 0, 1, [C("abdomen")],
    "Around the fullest part of the stomach.",
    "Measure around the body at the fullest part of the abdomen, usually just below the navel.", "waist");
  m("front_waist_length", "torso", "length", "Front waist length", "front", 0, 1, [Pl([[0.04, "neckBase"], [0.05, "bustPoint"], [0.045, "waist"]])],
    "From the shoulder at the neck, over the bust point, down to the waist.",
    "Measure from the high shoulder point beside the neck, over the bust, to the natural waistline.", "upperFront");
  m("back_waist_length", "torso", "length", "Back waist length", "back", 1, 1, [V(0, "neckBase", "waist", "back")],
    "From the nape of the neck down the spine to the natural waist.",
    "Measure down the centre back from the prominent neck bone to the waistline.", "upperBack");
  m("shoulder_to_waist", "torso", "length", "Shoulder to waist", "front", 1, 0, [V(0.1, "shoulder", "waist")],
    "Vertical length from the shoulder tip to the waist.",
    "Measure straight down from the shoulder point to the waistline.", "upperFront");
  m("shoulder_to_hip", "torso", "length", "Shoulder to hip", "front", 1, 0, [V(0.1, "shoulder", "hip")],
    "Vertical length from the shoulder tip to the hip line. Used for tunics and jackets.",
    "Measure straight down from the shoulder point to the fullest part of the hip.", "upperFront");
  m("neck_to_waist", "torso", "length", "Neck to waist (front)", "front", 1, 0, [V(0, "neckBase", "waist")],
    "From the front hollow of the neck straight down to the waist.",
    "Measure from the hollow at the base of the neck straight down to the waistline.", "upperFront");
  m("torso_length", "torso", "length", "Torso length", "side", 1, 0, [V(-0.03, "neckBase", "crotch", "side")],
    "From the nape down to the crotch level. Used for jumpsuits and leotards.",
    "Measure vertically from the nape to crotch height (a girth torso measurement must be taken by tape).", "fullRight");
  m("upper_hip", "torso", "circ", "Upper hip circumference", "front", 0, 1, [C("highHip")],
    "Around the hip about 10 cm below the waist, over the hip bones.",
    "Measure around the body over the top of the hip bones, level all round.", "hip");
  m("full_hip", "torso", "circ", "Full hip circumference", "front", 0, 1, [C("hip")],
    "Around the fullest part of the hips and seat.",
    "Stand with feet together. Measure around the fullest part of the seat, checking from the side that the tape is level.", "hip");
  m("front_body_length", "torso", "length", "Front body length", "front", 0, 0, [Pl([[0.04, "neckBase"], [0.05, "bustPoint"], [0.05, 0.6]])],
    "From the high shoulder point over the bust to the desired garment hem at the front.",
    "Measure from beside the neck, over the bust, down to where the front hem should fall.", "dressLength");
  m("back_body_length", "torso", "length", "Back body length", "back", 1, 0, [V(0, "neckBase", 0.6, "back")],
    "From the nape down the centre back to the desired garment hem.",
    "Measure from the nape bone straight down the back to the intended hem level.", "dressLength");

  /* D. Arms and sleeves */
  const AX = 0.15; // arm centre line offset
  m("full_arm", "arms", "length", "Full arm length", "front", 1, 1, [Pl([[0.115, "shoulder"], [0.155, "elbow"], [0.16, "wrist"]])],
    "From the shoulder tip, over a slightly bent elbow, to the wrist bone.",
    "With the arm relaxed and slightly bent, measure from the shoulder point over the elbow to the wrist bone.", "armRelaxed");
  m("short_sleeve", "arms", "length", "Short sleeve length", "front", 1, 0, [Pl([[0.115, "shoulder"], [0.142, 0.26]])],
    "From the shoulder tip down the arm to the desired short sleeve hem.",
    "Measure from the shoulder point down the outside of the arm to the chosen sleeve end.", "sleeve");
  m("three_quarter_sleeve", "arms", "length", "Three-quarter sleeve length", "front", 1, 0, [Pl([[0.115, "shoulder"], [0.155, "elbow"], [0.157, 0.44]])],
    "From the shoulder tip to a point between elbow and wrist.",
    "Measure from the shoulder point over the elbow to the chosen sleeve end, usually mid-forearm.", "sleeve");
  m("shoulder_to_elbow", "arms", "length", "Shoulder to elbow", "front", 1, 0, [Pl([[0.115, "shoulder"], [0.155, "elbow"]])],
    "From the shoulder tip to the point of the elbow.",
    "With the arm slightly bent, measure from the shoulder point to the elbow point.", "armRelaxed");
  m("elbow_to_wrist", "arms", "length", "Elbow to wrist", "front", 1, 0, [Pl([[0.155, "elbow"], [0.16, "wrist"]])],
    "From the elbow point to the wrist bone.",
    "Measure from the elbow point down the outside of the forearm to the wrist bone.", "armRelaxed");
  m("upper_arm", "arms", "circ", "Upper arm circumference", "front", 0, 1, [C("upperArm", { cx: 0.145, w: 0.024 })],
    "Around the upper arm just below the armpit.",
    "With the arm relaxed, measure around the upper arm at the level of the armpit crease.", "armRelaxed");
  m("bicep", "arms", "circ", "Bicep circumference", "front", 0, 1, [C("bicep", { cx: 0.148, w: 0.022 })],
    "Around the fullest part of the upper arm.",
    "With the arm relaxed at the side, measure around the fullest part of the bicep.", "armRelaxed");
  m("elbow_circ", "arms", "circ", "Elbow circumference", "front", 0, 0, [C("elbow", { cx: 0.155, w: 0.018 })],
    "Around the elbow with the arm bent. Needed for fitted long sleeves.",
    "Bend the arm to about 90° and measure around the elbow point.", "armExtended");
  m("forearm", "arms", "circ", "Forearm circumference", "front", 0, 0, [C("forearm", { cx: 0.157, w: 0.019 })],
    "Around the fullest part of the forearm.",
    "Measure around the forearm a few centimetres below the elbow.", "armRelaxed");
  m("wrist", "arms", "circ", "Wrist circumference", "front", 0, 1, [C("wrist", { cx: 0.16, w: 0.013 })],
    "Around the wrist over the wrist bone. Sets cuff size.",
    "Measure around the wrist just above the wrist bone; add ease separately for cuffs.", "armRelaxed");
  m("sleeve_opening", "arms", "circ", "Sleeve opening", "front", 0, 0, [C(0.44, { cx: 0.157, w: 0.02 })],
    "Around the arm where the sleeve will end. A body measure at that level; garment opening is set with ease.",
    "Measure around the arm at the chosen sleeve hem level.", "sleeve");
  m("armhole_circ", "arms", "circ", "Armhole circumference (sleeve)", "front", 0, 1, [C("armhole", { cx: 0.112, w: 0.024, vert: 1 })],
    "Armhole girth used to draft the sleeve head. Usually the same tape reading as the bodice armhole.",
    "Loop the tape around the shoulder joint and under the armpit.", "armRelaxed");
  m("sleeve_cap", "arms", "length", "Sleeve cap reference (cap height)", "front", 0, 0, [V(0.118, "shoulder", "armpit")],
    "Vertical distance from the shoulder point to armpit level. Reference for sleeve cap height.",
    "With the arm relaxed, measure vertically from the shoulder point to the level of the armpit crease.", "armRelaxed");

  /* E. Hips and lower body */
  m("hip", "hips", "circ", "Hip circumference", "front", 0, 1, [C("hip")],
    "Around the fullest part of the hips and seat.",
    "Feet together; measure around the fullest part of the seat, level all round.", "hip");
  m("high_hip", "hips", "circ", "High hip", "front", 0, 1, [C("highHip")],
    "Around the body over the hip bones, between waist and full hip.",
    "Measure around the top of the hip bones, roughly 10 cm below the waist.", "hip");
  m("thigh", "hips", "circ", "Thigh circumference", "front", 0, 1, [C("thigh", { cx: 0.05, w: 0.046 })],
    "Around the fullest part of one thigh, just below the crotch.",
    "Stand with weight on both feet; measure around the top of one thigh, level.", "trouser");
  m("mid_thigh", "hips", "circ", "Mid-thigh circumference", "front", 0, 0, [C("midThigh", { cx: 0.05, w: 0.04 })],
    "Around the thigh halfway between crotch and knee.",
    "Measure around one thigh halfway between the crotch and the knee.", "trouser");
  m("knee", "hips", "circ", "Knee circumference", "front", 0, 0, [C("knee", { cx: 0.05, w: 0.032 })],
    "Around the knee with the leg straight.",
    "Measure around the middle of the knee cap with the leg straight.", "trouser");
  m("calf", "hips", "circ", "Calf circumference", "front", 0, 0, [C("calf", { cx: 0.05, w: 0.033 })],
    "Around the fullest part of the calf.",
    "Measure around the widest part of the lower leg.", "trouser");
  m("ankle", "hips", "circ", "Ankle circumference", "front", 0, 1, [C("ankle", { cx: 0.05, w: 0.02 })],
    "Around the ankle just above the ankle bone. Used for churidar and fitted trouser hems.",
    "Measure around the narrowest part of the leg above the ankle bone.", "trouser");
  m("waist_to_hip", "hips", "length", "Waist to hip", "side", 1, 0, [V(0.07, "waist", "hip", "side")],
    "Vertical distance from the waistline to the fullest part of the hip.",
    "From the side, measure straight down from the waistline to the fullest part of the seat.", "hip");
  m("hip_to_knee", "hips", "length", "Hip to knee", "side", 1, 0, [V(0.07, "hip", "knee", "side")],
    "From the hip line down the side of the leg to the knee.",
    "Measure straight down the side of the leg from the hip line to the middle of the knee.", "trouser");
  m("knee_to_ankle", "hips", "length", "Knee to ankle", "side", 1, 0, [V(0.05, "knee", "ankle", "side")],
    "From the middle of the knee to the ankle bone.",
    "Measure down the outside of the leg from the knee to the ankle bone.", "trouser");
  m("crotch_depth", "hips", "length", "Crotch depth (body rise)", "side", 0, 1, [V(0.09, "waist", "crotch", "side")],
    "Seated: from the waistline down to the chair seat. Sets trouser rise.",
    "Sit upright on a flat, hard chair. Measure down the side from the waistline to the chair seat.", "inseam");
  m("front_rise", "hips", "length", "Front rise", "side", 0, 1, [Pl([[0.055, "waist"], [0.065, "hip"], [0.02, "crotch"]], "side")],
    "From the centre front waist, between the legs, to the crotch point.",
    "Measure from the centre front waistline down through the legs to the crotch point.", "inseam");
  m("back_rise", "hips", "length", "Back rise", "side", 0, 1, [Pl([[-0.05, "waist"], [-0.085, "hip"], [-0.02, "crotch"]], "side")],
    "From the centre back waist, over the seat, to the crotch point.",
    "Measure from the centre back waistline over the seat down to the crotch point.", "inseam");
  m("total_rise", "hips", "length", "Total rise", "side", 0, 1, [Pl([[0.055, "waist"], [0.065, "hip"], [0, "crotch"], [-0.085, "hip"], [-0.05, "waist"]], "side")],
    "From centre front waist, through the crotch, to centre back waist.",
    "Run the tape from the front waistline down between the legs and up to the back waistline.", "inseam");

  /* F. Legs */
  m("inseam", "legs", "length", "Inseam", "front", 1, 1, [V(0.008, "crotch", "floor")],
    "From the crotch down the inside leg to the floor (or desired hem).",
    "Barefoot, measure from the crotch straight down the inside of the leg to the floor.", "inseam");
  m("outseam", "legs", "length", "Outseam", "side", 1, 1, [V(0.06, "waist", "floor", "side")],
    "From the waistline down the outside of the leg to the floor.",
    "Measure from the side waistline straight down the outside of the leg to the floor.", "trouser");
  m("waist_to_floor_legs", "legs", "length", "Waist to floor", "side", 1, 1, [V(0.06, "waist", "floor", "side")],
    "From the waistline to the floor, barefoot.",
    "Measure from the side waistline straight down to the floor, standing barefoot.", "trouser");
  m("hip_to_floor", "legs", "length", "Hip to floor", "side", 1, 0, [V(0.07, "hip", "floor", "side")],
    "From the fullest hip level down to the floor.",
    "Measure from the hip line straight down the side of the leg to the floor.", "trouser");
  m("thigh_to_knee", "legs", "length", "Thigh to knee", "front", 1, 0, [V(0.07, "thigh", "knee")],
    "From the top of the thigh (crotch level) to the middle of the knee.",
    "Measure down the front of the thigh from crotch level to the middle of the knee.", "trouser");
  m("knee_to_ankle_legs", "legs", "length", "Knee to ankle (front)", "front", 1, 0, [V(0.05, "knee", "ankle")],
    "From the middle of the knee to the ankle.",
    "Measure down the front of the leg from mid-knee to the ankle bone.", "trouser");
  m("trouser_length", "legs", "length", "Trouser length", "side", 1, 1, [V(0.06, "waist", 0.975, "side")],
    "Finished outer length of trousers, waist to hem. Depends on footwear and style.",
    "Measure from the waistband position down the outside leg to where the hem should fall, with the intended shoes on.", "trouser");
  m("shorts_length", "legs", "length", "Shorts length", "side", 1, 0, [V(0.06, "waist", 0.64, "side")],
    "From the waistline down the outside leg to the desired shorts hem.",
    "Measure from the waistline down the side of the leg to the chosen hem level.", "trouser");
  m("leg_opening", "legs", "circ", "Leg opening", "front", 0, 0, [C(0.95, { cx: 0.05, w: 0.026 })],
    "Body girth where the trouser hem will sit. The garment opening adds ease to this.",
    "Measure around the leg (or foot and heel for tapered styles) at the hem level.", "trouser");
  m("hem_opening", "legs", "circ", "Hem opening (foot entry)", "side", 0, 0, [C(0.97, { cx: 0.0, w: 0.05, side: 1 })],
    "Diagonal girth around heel and instep, so a narrow hem can still pass over the foot.",
    "Point the foot and measure around the heel and the top of the foot.", "trouser");

  /* G. Full body */
  m("height", "full", "height", "Standing height", "side", 1, 1, [V(-0.09, "headTop", "floor", "side")],
    "Barefoot height from floor to the top of the head.",
    "Stand barefoot against a wall, heels touching it. Rest a flat object on the head and mark the wall; measure from floor to mark.", "fullRight");
  m("shoulder_to_floor", "full", "length", "Shoulder to floor", "front", 1, 0, [V(0.115, "shoulder", "floor")],
    "From the shoulder tip straight down to the floor.",
    "Measure vertically from the shoulder point to the floor, barefoot.", "dressLength");
  m("neck_to_floor", "full", "length", "Neck to floor", "front", 1, 0, [V(0, "neckBase", "floor")],
    "From the front neck base straight down to the floor. Used for gowns and anarkalis.",
    "Measure from the hollow of the neck straight down to the floor, barefoot.", "dressLength");
  m("waist_to_floor", "full", "length", "Waist to floor", "front", 1, 1, [V(0.075, "waist", "floor")],
    "From the natural waist down to the floor. Lehengas, skirts and petticoats.",
    "Measure from the natural waistline straight down the side to the floor, barefoot.", "dressLength");
  m("arm_span", "full", "width", "Arm span", "front", 1, 0, [H("shoulder", -0.5, 0.5)],
    "Fingertip to fingertip with arms stretched out sideways.",
    "With arms horizontal at shoulder height, measure from one middle fingertip to the other across the back.", "armExtended");
  m("full_garment_length", "full", "length", "Full garment length", "front", 1, 0, [V(0.04, "neckBase", 0.97)],
    "From the high shoulder point to the desired garment hem. Depends on style.",
    "Measure from beside the neck straight down to the intended hem level.", "dressLength");
  m("overall_length", "full", "length", "Overall body length (nape to floor)", "back", 1, 0, [V(0, "neckBase", "floor", "back")],
    "From the nape of the neck down the back to the floor.",
    "Measure from the nape bone down the centre back to the floor, barefoot.", "fullBack");

  /* Pose reference library */
  const POSES = {
    fullFront: { name: "Full body · front", view: "front", arms: "a", camera: "Facing the person, phone upright, lens at waist height.", posture: "Stand tall, weight even on both feet, chin level, look at the camera.", limbs: "Feet hip-width apart inside the foot guides. Arms held slightly out from the body so light shows between arms and waist.", landmarks: ["Top of head", "Shoulder points", "Waist", "Hips", "Knees", "Ankles"], mistakes: ["Phone tilted up or down", "Feet cut off at the bottom of the frame", "Loose clothing hiding the body line", "Arms pressed against the sides"] },
    fullBack: { name: "Full body · back", view: "back", arms: "a", camera: "Behind the person, phone upright, lens at waist height.", posture: "Stand tall facing away from the camera, head level.", limbs: "Feet hip-width apart inside the guides. Arms slightly out from the body.", landmarks: ["Nape", "Shoulder points", "Waist", "Seat", "Knees", "Heels"], mistakes: ["Hair covering the nape", "Leaning on one hip", "Camera too close so head or feet are cut off"] },
    fullLeft: { name: "Full body · left side", view: "side", flip: true, arms: "down", camera: "At the person's left, phone upright, lens at waist height.", posture: "Turn 90° so the left side faces the camera. Stand naturally, look straight ahead.", limbs: "Feet together. Arms relaxed by the sides, slightly forward so they do not hide the waist.", landmarks: ["Neck front and nape", "Chest", "Waist", "Seat", "Knee", "Ankle"], mistakes: ["Turning less than 90°", "Arms hiding the waist line", "Pushing the stomach in"] },
    fullRight: { name: "Full body · right side", view: "side", arms: "down", camera: "At the person's right, phone upright, lens at waist height.", posture: "Turn 90° so the right side faces the camera. Stand naturally.", limbs: "Feet together. Arms relaxed, slightly forward.", landmarks: ["Neck front and nape", "Chest", "Waist", "Seat", "Knee", "Ankle"], mistakes: ["Turning less than 90°", "Leaning forward", "Arms hiding the waist line"] },
    upperFront: { name: "Upper body · front", view: "front", crop: "upper", arms: "a", camera: "Facing the person, lens at chest height, phone upright.", posture: "Shoulders relaxed and level, breathe normally.", limbs: "Arms slightly away from the body.", landmarks: ["Neck base", "Shoulder points", "Bust or chest", "Underbust", "Waist"], mistakes: ["Raised shoulders", "Holding the breath", "Bulky clothing"] },
    upperBack: { name: "Upper body · back", view: "back", crop: "upper", arms: "a", camera: "Behind the person at shoulder-blade height.", posture: "Shoulders relaxed and level, head straight.", limbs: "Arms slightly away from the body.", landmarks: ["Nape", "Shoulder points", "Shoulder blades", "Waist"], mistakes: ["Hair over the nape", "Rounded shoulders"] },
    shoulder: { name: "Shoulder positioning", view: "back", crop: "upper", arms: "down", camera: "Behind the person, lens at shoulder height, phone exactly level.", posture: "Relaxed, natural shoulders. Do not lift or pull them back.", limbs: "Arms hanging naturally.", landmarks: ["Left shoulder point", "Nape", "Right shoulder point"], mistakes: ["Phone tilted, which makes one shoulder look lower", "Shrugging"] },
    armExtended: { name: "Arm extended", view: "front", arms: "t", camera: "Facing the person, far enough to see both hands, lens at shoulder height.", posture: "Stand tall with arms straight out at shoulder height.", limbs: "Palms facing down, fingers straight.", landmarks: ["Fingertips", "Shoulder points", "Elbows", "Wrists"], mistakes: ["Arms drooping below shoulder level", "Hands cut off by the frame"] },
    armRelaxed: { name: "Arm relaxed", view: "front", arms: "a", camera: "Facing the person at chest height.", posture: "Arms relaxed with a slight bend at the elbow.", limbs: "Hands open, palms facing the body.", landmarks: ["Shoulder point", "Elbow", "Wrist bone", "Armpit"], mistakes: ["Locking the elbow straight", "Lifting the shoulder"] },
    sleeve: { name: "Sleeve measurement", view: "front", arms: "a", camera: "Facing the person, lens at chest height, whole arm in frame.", posture: "Stand straight, arm slightly bent and a little away from the body.", limbs: "Hand relaxed with fingers pointing down.", landmarks: ["Shoulder point", "Elbow", "Wrist bone"], mistakes: ["Arm pressed into the body", "Shoulder point hidden by hair or clothing"] },
    waist: { name: "Waist measurement", view: "front", crop: "upper", arms: "a", camera: "Facing the person at waist height.", posture: "Stand relaxed, breathe out normally, do not pull the stomach in.", limbs: "Arms slightly out so the waist line is visible on both sides.", landmarks: ["Natural waist crease", "Navel"], mistakes: ["Measuring over a belt or thick waistband", "Pulling the stomach in"] },
    hip: { name: "Hip measurement", view: "side", arms: "down", camera: "At the side, lens at hip height.", posture: "Feet together, weight even.", limbs: "Arms relaxed and slightly forward to show the seat.", landmarks: ["Fullest part of the seat", "Hip bones"], mistakes: ["Feet apart, which widens the hip reading", "Phone held too high"] },
    inseam: { name: "Inseam measurement", view: "front", crop: "lower", arms: "a", camera: "Facing the person, lens at knee height, phone upright.", posture: "Stand straight, barefoot, weight even.", limbs: "Feet about 15 cm apart.", landmarks: ["Crotch point", "Inside ankle", "Floor"], mistakes: ["Wearing shoes", "Loose trousers hiding the crotch point"] },
    trouser: { name: "Trouser measurement", view: "side", crop: "lower", arms: "down", camera: "At the side, lens at knee height.", posture: "Stand straight, wearing the shoes intended for the trousers if hem length matters.", limbs: "Feet together.", landmarks: ["Waistline", "Hip", "Knee", "Ankle", "Floor"], mistakes: ["Waistband rolled over", "Slouching"] },
    dressLength: { name: "Dress length", view: "front", arms: "a", camera: "Facing the person, lens at waist height, whole body in frame.", posture: "Stand tall in the footwear planned for the garment.", limbs: "Feet together, arms slightly out.", landmarks: ["High shoulder point", "Neck base", "Waist", "Desired hem", "Floor"], mistakes: ["Barefoot when heels will be worn", "Camera too high, which shortens the legs"] }
  };

  const byId = {};
  L.forEach((e) => (byId[e.id] = e));
  SM.catalog = {
    REGIONS, KIND_LABEL, POSES,
    all: L,
    get: (id) => byId[id],
    byRegion: (r) => L.filter((e) => e.region === r),
    name: (id) => { const e = byId[id]; return e ? SM.i18n.catalog(id, "name", e.name) : id; }
  };
})(typeof window !== "undefined" ? window : globalThis);

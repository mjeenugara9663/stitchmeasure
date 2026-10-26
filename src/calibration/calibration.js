/* Calibration service. Converts photo pixels to millimetres only when a
 * physical reference has been marked and passes validation. Pure functions.
 *
 * Methods
 *  marker  – printed square marker of known size (default 100 mm), both edges marked
 *  a4      – A4 sheet 210 × 297 mm; long edge required, short edge recommended
 *  known   – any straight object of known length (ruler, tape held flat)
 *  height  – the person's verified standing height (top of head to floor);
 *            only valid for lines close to vertical
 *  depth   – device depth sensing: not available to web browsers (future native app)
 *
 * A calibration only describes the plane where the reference was held.
 * Anything far in front of or behind that plane will be off; the UI says so.
 */
(function (root) {
  "use strict";
  const SM = (root.SM = root.SM || {});

  const A4 = { long: 297, short: 210 };
  const MIN_PX = 60;          // reference shorter than this in the image is rejected
  const SHAPE_TOL = 0.05;     // 5 % deviation from the expected aspect ratio
  const RIGHT_ANGLE_TOL = 10; // degrees
  const VERTICAL_TOL = 8;     // degrees off vertical for the height line
  const HEIGHT_SCOPE = 20;    // degrees: lines this close to vertical may use a height calibration

  const len = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const angleDeg = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  const offVertical = (a, b) => { const ang = Math.abs(angleDeg(a, b)) % 180; return Math.abs(90 - ang); };
  const between = (a1, a2, b1, b2) => {
    const u = { x: a2.x - a1.x, y: a2.y - a1.y }, v = { x: b2.x - b1.x, y: b2.y - b1.y };
    const c = (u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y));
    return Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI;
  };

  const METHODS = {
    marker: { name: "Printed calibration marker", needs: ["edge1", "edge2"], hint: "Print the marker at 100 % scale, hold it flat against the body at the level you will measure, then mark two adjacent edges." },
    a4: { name: "A4 reference sheet", needs: ["edge1", "edge2?"], hint: "Hold a flat A4 sheet (210 × 297 mm) against the body at measurement level, facing the camera. Mark the long edge, then the short edge." },
    known: { name: "Known-length object", needs: ["edge1"], hint: "Hold a ruler or rigid object of known length flat against the body, parallel to the camera, and mark its two ends." },
    height: { name: "Known standing height", needs: ["edge1"], hint: "Full-body photo only. Mark the top of the head and the floor at the heels. Supports near-vertical lengths only." },
    depth: { name: "Device depth sensing", needs: [], hint: "Requires a native app with depth hardware access. Not available in this web version." }
  };

  /* input: { method, edge1:[p,p], edge2:[p,p]|null, knownMm, heightCm, markerMm, confirmed }
   * output: { valid, method, mmPerPx, scope:'plane'|'vertical', errors[], warnings[], at } */
  function calibrate(inp) {
    const out = { valid: false, method: inp.method, mmPerPx: null, scope: "plane", errors: [], warnings: [], at: new Date().toISOString() };
    const e1 = inp.edge1, e2 = inp.edge2;
    if (inp.method === "depth") { out.errors.push("Depth sensing is not available to web browsers. Use a marker, an A4 sheet, a known-length object or the person's height."); return out; }
    if (!METHODS[inp.method]) { out.errors.push("Choose a calibration method."); return out; }
    if (!e1 || !e1[0] || !e1[1]) { out.errors.push("Mark both ends of the reference on the photo."); return out; }
    const l1 = len(e1[0], e1[1]);
    if (l1 < MIN_PX) { out.errors.push(`The reference is only ${Math.round(l1)} px long in the photo. Move closer or use a larger reference (needs at least ${MIN_PX} px).`); return out; }

    if (inp.method === "marker" || inp.method === "a4") {
      if (!inp.confirmed) { out.errors.push(inp.method === "a4" ? "Confirm the sheet is a genuine A4 sheet (210 × 297 mm), held flat." : "Confirm the marker was printed at actual size (100 %, no 'fit to page')."); return out; }
    }

    if (inp.method === "marker") {
      const size = +inp.markerMm || 100;
      if (!e2 || !e2[0] || !e2[1]) { out.errors.push("Mark the second edge of the marker so its shape can be checked."); return out; }
      const l2 = len(e2[0], e2[1]);
      const ratio = l1 / l2, dev = Math.abs(ratio - 1);
      if (dev > SHAPE_TOL) { out.errors.push(`The marker looks ${Math.round(dev * 100)} % out of square. It is tilted or not flat. Face it straight to the camera and retake.`); return out; }
      const ang = between(e1[0], e1[1], e2[0], e2[1]);
      if (Math.abs(ang - 90) > RIGHT_ANGLE_TOL) { out.errors.push(`The two marked edges meet at ${Math.round(ang)}°, not about 90°. Mark two adjacent edges, or retake with the marker facing the camera.`); return out; }
      out.mmPerPx = (size / l1 + size / l2) / 2;
    } else if (inp.method === "a4") {
      if (e2 && e2[0] && e2[1]) {
        const l2 = len(e2[0], e2[1]);
        const ratio = l1 / l2, expect = A4.long / A4.short, dev = Math.abs(ratio - expect) / expect;
        if (dev > SHAPE_TOL) { out.errors.push(`The sheet's shape is ${Math.round(dev * 100)} % off from A4. Check you marked the long edge first, hold the sheet flat facing the camera, and retake.`); return out; }
        const ang = between(e1[0], e1[1], e2[0], e2[1]);
        if (Math.abs(ang - 90) > RIGHT_ANGLE_TOL) { out.errors.push(`The edges meet at ${Math.round(ang)}°, not about 90°. The sheet is tilted. Retake facing the camera.`); return out; }
        out.mmPerPx = (A4.long / l1 + A4.short / l2) / 2;
      } else {
        out.mmPerPx = A4.long / l1;
        out.warnings.push("Only the long edge is marked, so tilt cannot be checked. Mark the short edge too for a safer calibration.");
      }
    } else if (inp.method === "known") {
      const k = +inp.knownMm;
      if (!(k > 0)) { out.errors.push("Enter the reference object's real length."); return out; }
      if (k < 100) out.warnings.push("References shorter than 10 cm magnify marking errors. A 30 cm ruler or longer is better.");
      out.mmPerPx = k / l1;
      out.warnings.push("Tilt cannot be checked with a single edge. Keep the object flat and parallel to the camera.");
    } else if (inp.method === "height") {
      const h = +inp.heightCm;
      if (!(h > 30 && h < 260)) { out.errors.push("Enter the person's verified standing height first."); return out; }
      const ov = offVertical(e1[0], e1[1]);
      if (ov > VERTICAL_TOL) { out.errors.push(`The head-to-floor line is ${Math.round(ov)}° off vertical. The phone was tilted. Hold it upright and retake.`); return out; }
      out.mmPerPx = (h * 10) / l1;
      out.scope = "vertical";
      out.warnings.push("Height calibration only supports lengths running roughly up and down the body. Widths and circumferences need a tape.");
    }
    out.warnings.push("Values are only valid near the plane where the reference was held. Measurements far in front of or behind it will be off.");
    out.valid = true;
    return out;
  }

  /* distance between two image points using a calibration */
  function measure(cal, a, b) {
    const px = len(a, b);
    const r = { px, mm: null, reason: null };
    if (!cal || !cal.valid) { r.reason = "Not calibrated: pixel distance only."; return r; }
    if (cal.scope === "vertical" && offVertical(a, b) > HEIGHT_SCOPE) { r.reason = "Height calibration supports only near-vertical lines. Use a marker or A4 sheet for this line."; return r; }
    r.mm = px * cal.mmPerPx;
    return r;
  }

  SM.calibration = { A4, MIN_PX, SHAPE_TOL, METHODS, calibrate, measure, len, angleDeg, offVertical };
})(typeof window !== "undefined" ? window : globalThis);

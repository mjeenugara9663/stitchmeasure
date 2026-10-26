/* Original parametric body figure (front / side / back, adult / child).
 * One geometry drives three uses:
 *   - reference illustrations with highlighted measurement lines
 *   - the interactive body map (tap regions)
 *   - transparent camera overlays (outline only)
 * Coordinates: y = fraction of standing height from the top of the head,
 * x = offset from the body centre line as a fraction of height. */
(function (root) {
  "use strict";
  const SM = (root.SM = root.SM || {});

  const LEVEL = {
    headTop: 0, headCirc: 0.045, neck: 0.135, neckBase: 0.155, shoulder: 0.178, acrossFront: 0.2, armhole: 0.2,
    armpit: 0.225, upperChest: 0.235, upperArm: 0.235, chest: 0.27, bustPoint: 0.27, bicep: 0.27, underbust: 0.31,
    highWaist: 0.345, waist: 0.38, elbow: 0.385, midWaist: 0.41, forearm: 0.42, abdomen: 0.43, highHip: 0.45,
    wrist: 0.49, hip: 0.49, crotch: 0.525, thigh: 0.56, midThigh: 0.62, knee: 0.715, calf: 0.8, ankle: 0.94, floor: 1
  };
  // half-widths of the torso, front view  [y, halfWidth]
  const TORSO = [[0.115, 0.028], [0.152, 0.034], [0.165, 0.075], [0.178, 0.112], [0.2, 0.116], [0.225, 0.1], [0.27, 0.094], [0.31, 0.086], [0.345, 0.08], [0.38, 0.075], [0.41, 0.08], [0.43, 0.088], [0.45, 0.094], [0.49, 0.1], [0.52, 0.097]];
  const LEG_OUT = [[0.52, 0.097], [0.56, 0.093], [0.62, 0.082], [0.715, 0.064], [0.8, 0.062], [0.88, 0.047], [0.94, 0.037], [0.97, 0.04], [0.985, 0.056], [1, 0.058]];
  const LEG_IN = [[1, 0.012], [0.985, 0.012], [0.94, 0.016], [0.88, 0.018], [0.8, 0.021], [0.715, 0.016], [0.62, 0.012], [0.56, 0.006], [0.532, 0]];
  const ARM_A = [[0.112, 0.178], [0.128, 0.195], [0.142, 0.24], [0.153, 0.3], [0.163, 0.385], [0.17, 0.44], [0.176, 0.49], [0.181, 0.52], [0.176, 0.565], [0.158, 0.565], [0.153, 0.52], [0.151, 0.49], [0.146, 0.44], [0.142, 0.385], [0.13, 0.3], [0.113, 0.25], [0.1, 0.226]];
  const ARM_T = [[0.112, 0.175], [0.3, 0.171], [0.42, 0.171], [0.49, 0.176], [0.502, 0.188], [0.49, 0.2], [0.42, 0.198], [0.3, 0.199], [0.14, 0.213], [0.1, 0.232]];
  // side profile [y, front, back]
  const SIDE = [[0.115, 0.025, -0.03], [0.15, 0.03, -0.035], [0.17, 0.05, -0.045], [0.23, 0.07, -0.055], [0.27, 0.078, -0.058], [0.31, 0.066, -0.055], [0.38, 0.055, -0.05], [0.43, 0.065, -0.052], [0.49, 0.06, -0.082], [0.53, 0.058, -0.075], [0.56, 0.055, -0.052], [0.62, 0.05, -0.046], [0.715, 0.035, -0.033], [0.8, 0.03, -0.05], [0.88, 0.025, -0.03], [0.94, 0.02, -0.022], [0.97, 0.03, -0.03], [0.985, 0.09, -0.035], [1, 0.095, -0.035]];
  const SIDE_ARM = [[-0.022, 0.185], [0.026, 0.185], [0.032, 0.3], [0.032, 0.385], [0.037, 0.49], [0.032, 0.56], [0.012, 0.566], [0.0, 0.49], [-0.01, 0.385], [-0.02, 0.3]];

  const VB_H = 400, TOP = 16, HP = 372;
  const lvl = (y) => (typeof y === "string" ? LEVEL[y] : y);
  const childY = (fy) => (fy <= 0.155 ? fy * 1.45 : 0.225 + (fy - 0.155) * (0.775 / 0.845));

  function geom(age) {
    const child = age === "child";
    const Y = (fy) => TOP + (child ? childY(lvl(fy)) : lvl(fy)) * HP;
    const wk = child ? 1.15 : 1;
    const X = (dx, cx) => (cx == null ? 100 : cx) + dx * HP * wk;
    return { child, Y, X, wk };
  }
  function interp(table, y, col) {
    col = col || 1;
    if (y <= table[0][0]) return table[0][col];
    for (let i = 1; i < table.length; i++) {
      if (y <= table[i][0]) { const a = table[i - 1], b = table[i], t = (y - a[0]) / (b[0] - a[0]); return a[col] + (b[col] - a[col]) * t; }
    }
    return table[table.length - 1][col];
  }
  const halfWidth = (y) => interp(TORSO, lvl(y));
  const sideAt = (y) => [interp(SIDE, lvl(y), 1), interp(SIDE, lvl(y), 2)];

  const pts = (arr) => arr.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");

  function bodyPaths(view, age, arms) {
    const g = geom(age), out = [];
    if (view === "side") {
      const front = SIDE.map(([y, f]) => [g.X(f), g.Y(y)]);
      const back = SIDE.slice().reverse().map(([y, , b]) => [g.X(b), g.Y(y)]);
      out.push({ k: "body", d: "M" + pts(front) + " L" + pts(back) + " Z" });
      const hr = g.child ? 1.4 : 1;
      out.push({ k: "head", ellipse: [g.X(0.005), g.Y(0.062 / (g.child ? 1 : 1)), 0.055 * HP * hr, 0.062 * HP * (g.child ? 1.45 : 1)] });
      out.push({ k: "arm", d: "M" + pts(SIDE_ARM.map(([x, y]) => [g.X(x), g.Y(y)])) + " Z" });
      return { g, out };
    }
    const right = [].concat(TORSO.map(([y, w]) => [w, y]), LEG_OUT.slice(1).map(([y, w]) => [w, y]), LEG_IN.map(([y, w]) => [w, y]));
    const left = right.slice().reverse().map(([x, y]) => [-x, y]);
    out.push({ k: "body", d: "M" + pts(right.map(([x, y]) => [g.X(x), g.Y(y)])) + " L" + pts(left.map(([x, y]) => [g.X(x), g.Y(y)])) + " Z" });
    const hr = g.child ? 1.4 : 1;
    out.push({ k: "head", ellipse: [g.X(0), g.Y(0.062), 0.05 * HP * hr, 0.062 * HP * (g.child ? 1.45 : 1)] });
    let arm = arms === "t" ? ARM_T : ARM_A;
    if (arms === "down") arm = ARM_A.map(([x, y]) => [0.1 + (x - 0.1) * 0.55, y]);
    out.push({ k: "arm", d: "M" + pts(arm.map(([x, y]) => [g.X(x), g.Y(y)])) + " Z" });
    out.push({ k: "arm", d: "M" + pts(arm.map(([x, y]) => [g.X(-x), g.Y(y)])) + " Z" });
    return { g, out };
  }

  function shape(p, attrs) {
    if (p.ellipse) { const [cx, cy, rx, ry] = p.ellipse; return `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" ${attrs}/>`; }
    return `<path d="${p.d}" ${attrs}/>`;
  }

  /* highlight geometry for a catalog entry */
  function highlightSVG(geo, view, age) {
    const g = geom(age);
    let s = "";
    const dot = (x, y) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" class="hl-dot"/>`;
    (geo || []).forEach((sh) => {
      if (sh.v && sh.v !== view) return;
      if (sh.t === "c") {
        let cx = 100, rx, ry;
        const y = g.Y(sh.y);
        if (sh.head) { rx = 0.053 * HP * (g.child ? 1.4 : 1); }
        else if (sh.w) { cx = g.X(sh.cx || 0); rx = sh.w * HP * g.wk + 1.5; }
        else if (view === "side") { const [f, b] = sideAt(sh.y); cx = g.X((f + b) / 2); rx = ((f - b) / 2) * HP * g.wk + 2; }
        else rx = halfWidth(sh.y) * HP * g.wk + 2;
        ry = Math.max(2.5, rx * 0.2);
        if (sh.vert) { const t = rx; rx = ry * 1.2; ry = t * 1.6; }
        s += `<ellipse cx="${cx.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" class="hl-line"/>`;
        if (sh.cx && view !== "side") s += `<ellipse cx="${(200 - cx).toFixed(1)}" cy="${y.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" class="hl-ghost"/>`;
      } else if (sh.t === "h") {
        const y = g.Y(sh.y), x1 = g.X(sh.x1), x2 = g.X(sh.x2);
        s += `<line x1="${x1.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y.toFixed(1)}" class="hl-line"/>` + dot(x1, y) + dot(x2, y);
      } else if (sh.t === "v") {
        const x = g.X(sh.x), y1 = g.Y(sh.y1), y2 = g.Y(sh.y2);
        s += `<line x1="${x.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y2.toFixed(1)}" class="hl-line"/>` + dot(x, y1) + dot(x, y2);
      } else if (sh.t === "p") {
        const p = sh.pts.map(([x, y]) => [g.X(x), g.Y(y)]);
        s += `<polyline points="${pts(p)}" class="hl-line" fill="none"/>` + dot(p[0][0], p[0][1]) + dot(p[p.length - 1][0], p[p.length - 1][1]);
      }
    });
    return s;
  }

  /* body-map regions (front/back share; side has its own) */
  const REGION_BANDS = [
    { id: "head", y1: 0, y2: 0.155 }, { id: "shoulders", y1: 0.155, y2: 0.3 }, { id: "torso", y1: 0.3, y2: 0.45 },
    { id: "hips", y1: 0.45, y2: 0.6 }, { id: "legs", y1: 0.6, y2: 1.0 }
  ];
  function regionAt(view, age, x, y) {
    // x,y in SVG units → region id
    const g = geom(age);
    const inv = (py) => { let fy = (py - TOP) / HP; if (g.child) fy = fy <= 0.225 ? fy / 1.45 : 0.155 + (fy - 0.225) * (0.845 / 0.775); return fy; };
    const fy = inv(y), dx = (x - 100) / (HP * g.wk);
    if (fy < -0.05 || fy > 1.05) return null;
    if (view !== "side" && Math.abs(dx) > 0.108 && fy > 0.18 && fy < 0.58) return "arms";
    if (view === "side" && dx > -0.03 && dx < 0.04 && fy > 0.2 && fy < 0.56) return "arms";
    const b = REGION_BANDS.find((r) => fy >= r.y1 && fy < r.y2);
    return b ? b.id : "legs";
  }
  function regionBand(view, age, id) {
    const g = geom(age);
    if (id === "arms") {
      if (view === "side") return `<rect x="${g.X(-0.03).toFixed(1)}" y="${g.Y(0.18).toFixed(1)}" width="${(0.07 * HP * g.wk).toFixed(1)}" height="${(g.Y(0.57) - g.Y(0.18)).toFixed(1)}" rx="8" class="region-hl"/>`;
      return `<rect x="${g.X(0.105).toFixed(1)}" y="${g.Y(0.17).toFixed(1)}" width="${(0.09 * HP * g.wk).toFixed(1)}" height="${(g.Y(0.58) - g.Y(0.17)).toFixed(1)}" rx="8" class="region-hl"/>` +
        `<rect x="${g.X(-0.195).toFixed(1)}" y="${g.Y(0.17).toFixed(1)}" width="${(0.09 * HP * g.wk).toFixed(1)}" height="${(g.Y(0.58) - g.Y(0.17)).toFixed(1)}" rx="8" class="region-hl"/>`;
    }
    const b = REGION_BANDS.find((r) => r.id === id); if (!b) return "";
    return `<rect x="22" y="${g.Y(b.y1).toFixed(1)}" width="156" height="${(g.Y(b.y2) - g.Y(b.y1)).toFixed(1)}" rx="10" class="region-hl"/>`;
  }

  /* camera overlay markers */
  function markersSVG(view, age) {
    const g = geom(age);
    const lines = [["shoulder", "Shoulders"], ["waist", "Waist"], ["hip", "Hips"], ["knee", "Knees"], ["ankle", "Ankles"]];
    let s = `<line x1="100" y1="${g.Y(-0.03)}" x2="100" y2="${g.Y(1.02)}" class="ov-center"/>`;
    s += `<line x1="40" y1="${g.Y(0)}" x2="160" y2="${g.Y(0)}" class="ov-limit"/><text x="162" y="${g.Y(0) + 3}" class="ov-label">Head</text>`;
    s += `<line x1="30" y1="${g.Y(1)}" x2="170" y2="${g.Y(1)}" class="ov-limit"/><text x="172" y="${g.Y(1) + 3}" class="ov-label">Floor</text>`;
    lines.forEach(([lv, label]) => {
      const y = g.Y(lv), w = view === "side" ? 0.11 : (lv === "knee" || lv === "ankle" ? 0.11 : halfWidth(lv) + 0.03);
      s += `<line x1="${g.X(-w)}" y1="${y}" x2="${g.X(w)}" y2="${y}" class="ov-marker"/><text x="${g.X(w) + 3}" y="${y + 3}" class="ov-label">${SM.t ? SM.t(label) : label}</text>`;
    });
    // foot guides
    if (view === "side") s += `<rect x="${g.X(-0.05)}" y="${g.Y(0.985)}" width="${0.16 * HP * g.wk}" height="${0.03 * HP}" rx="4" class="ov-foot"/>`;
    else { [-1, 1].forEach((sd) => { s += `<rect x="${g.X(sd > 0 ? 0.008 : -0.075)}" y="${g.Y(0.97)}" width="${0.067 * HP * g.wk}" height="${0.035 * HP}" rx="5" class="ov-foot"/>`; }); }
    return s;
  }

  /* main renderer */
  function svg(o) {
    o = Object.assign({ view: "front", age: "adult", arms: "a", mode: "fill", highlight: null, crop: null, markers: false, region: null, flip: false, cls: "" }, o || {});
    const { g, out } = bodyPaths(o.view, o.age, o.arms);
    let vb = o.arms === "t" ? [-92, 0, 384, VB_H] : [0, 0, 200, VB_H];
    if (o.crop === "upper") vb = [vb[0], 0, vb[2], g.Y(0.6)];
    if (o.crop === "lower") { const y0 = g.Y(0.42); vb = [vb[0], y0, vb[2], VB_H - y0]; }
    const flip = o.flip ? ` transform="translate(200 0) scale(-1 1)"` : "";
    let body = "";
    const cls = o.mode === "outline" ? "fig-outline" : "fig-fill";
    out.filter((p) => p.k !== "arm").forEach((p) => (body += shape(p, `class="${cls}"`)));
    out.filter((p) => p.k === "arm").forEach((p) => (body += shape(p, `class="${cls} fig-arm"`)));
    if (o.mode !== "outline") {
      if (o.view === "back") body += `<line x1="100" y1="${g.Y(0.16)}" x2="100" y2="${g.Y(0.5)}" class="fig-seam"/>`;
      if (o.view === "front") body += `<path d="M${g.X(-0.03)},${g.Y(0.152)} Q100,${g.Y(0.185)} ${g.X(0.03)},${g.Y(0.152)}" class="fig-seam"/><line x1="100" y1="${g.Y(0.38)}" x2="100" y2="${g.Y(0.52)}" class="fig-seam faint"/>`;
      if (o.view === "side") body += `<path d="M${g.X(0.045)},${g.Y(0.055)} l6,6 -5,2" class="fig-seam"/>`;
    }
    let extra = "", outer = "";
    if (o.region) extra += regionBand(o.view, o.age, o.region);
    if (o.markers) outer += markersSVG(o.view, o.age);
    if (o.highlight) extra += highlightSVG(o.highlight, o.view, o.age);
    return `<svg class="figure ${o.cls}" viewBox="${vb.map((n) => (+n).toFixed(1)).join(" ")}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${o.view} body illustration"><g${flip}>${body}${extra}</g>${outer}</svg>`;
  }

  /* reference illustration for a catalog entry */
  function forEntry(entry, age) {
    const pose = (SM.catalog.POSES[entry.pose] || {});
    let view = entry.view;
    const views = new Set((entry.geo || []).map((s) => s.v).filter(Boolean));
    if (views.size === 1) view = [...views][0];
    const arms = entry.id === "arm_span" ? "t" : view === "side" ? "down" : (pose.arms === "t" ? "a" : pose.arms || "a");
    return svg({ view, age, arms, highlight: entry.geo, cls: "ref" });
  }
  function forPose(poseId, age) {
    const p = SM.catalog.POSES[poseId]; if (!p) return "";
    return svg({ view: p.view, age, arms: p.arms, crop: p.crop || null, flip: !!p.flip, markers: true, cls: "pose" });
  }

  SM.figure = { LEVEL, svg, forEntry, forPose, regionAt, halfWidth, VB_H, TOP, HP };
})(typeof window !== "undefined" ? window : globalThis);

/* Overlay layers for the live camera and for exported photos.
 * Grid (canvas) and body outline (SVG) are separate layers.
 * Grid squares are positioning references only; they are never labelled in
 * centimetres because the camera has no scale until a photo is calibrated. */
(function (root) {
  "use strict";
  const SM = (root.SM = root.SM || {});

  const VIEWS = {
    front: { name: "Front", fig: { view: "front", arms: "a" } },
    back: { name: "Back", fig: { view: "back", arms: "a" } },
    left: { name: "Left side", fig: { view: "side", arms: "down", flip: true } },
    right: { name: "Right side", fig: { view: "side", arms: "down" } },
    upper: { name: "Upper body", fig: { view: "front", arms: "a", crop: "upper" } },
    lower: { name: "Lower body", fig: { view: "front", arms: "a", crop: "lower" } },
    sleeve: { name: "Arm & sleeve", fig: { view: "front", arms: "a", sleeve: true } },
    extended: { name: "Arms extended", fig: { view: "front", arms: "t" } }
  };

  const STYLE = `<style>
    .fig-outline{fill:rgba(255,255,255,.06);stroke:#ffffff;stroke-width:1.6;stroke-linejoin:round}
    .fig-arm{fill:rgba(255,255,255,.04)}
    .ov-center{stroke:#3CC4B8;stroke-width:1;stroke-dasharray:4 4}
    .ov-limit{stroke:#D8B76A;stroke-width:1.4;stroke-dasharray:6 3}
    .ov-marker{stroke:#3CC4B8;stroke-width:1.2}
    .ov-label{fill:#ffffff;font:600 7.5px system-ui,sans-serif;paint-order:stroke;stroke:rgba(0,0,0,.6);stroke-width:2px}
    .ov-foot{fill:rgba(216,183,106,.18);stroke:#D8B76A;stroke-width:1.2}
    .hl-line{stroke:#D8B76A;stroke-width:2;fill:none;stroke-dasharray:5 3}
    .hl-dot{fill:#D8B76A}.hl-ghost{display:none}
  </style>`;

  function outlineSVG(viewKey, age) {
    const v = VIEWS[viewKey] || VIEWS.front;
    const o = Object.assign({ age: age || "adult", mode: "outline", markers: true, cls: "ov" }, v.fig);
    if (v.fig.sleeve) o.highlight = SM.catalog.get("full_arm").geo;
    return SM.figure.svg(o).replace(/(<svg[^>]*>)/, "$1" + STYLE);
  }

  /* grid: density = number of columns; adds thirds + centre lines */
  function drawGrid(canvas, opts) {
    const dpr = root.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    if (!opts.show) return;
    paintGrid(g, w, h, opts);
  }
  function paintGrid(g, w, h, opts) {
    const n = Math.max(2, opts.density || 8), cell = w / n, a = opts.opacity == null ? 0.5 : opts.opacity;
    g.save();
    g.lineWidth = Math.max(1, w / 800);
    g.strokeStyle = `rgba(255,255,255,${0.35 * a})`;
    g.beginPath();
    for (let x = cell; x < w - 0.5; x += cell) { g.moveTo(Math.round(x) + 0.5, 0); g.lineTo(Math.round(x) + 0.5, h); }
    for (let y = cell; y < h - 0.5; y += cell) { g.moveTo(0, Math.round(y) + 0.5); g.lineTo(w, Math.round(y) + 0.5); }
    g.stroke();
    g.strokeStyle = `rgba(60,196,184,${0.9 * a})`; g.lineWidth = Math.max(1.5, w / 500);
    g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    g.setLineDash([8, 6]); g.strokeStyle = `rgba(216,183,106,${0.8 * a})`;
    g.beginPath(); [1 / 3, 2 / 3].forEach((f) => { g.moveTo(0, h * f); g.lineTo(w, h * f); g.moveTo(w * f, 0); g.lineTo(w * f, h); }); g.stroke();
    g.restore();
  }

  /* render the outline SVG as an image (for burning into exported photos) */
  async function outlineImage(viewKey, age) {
    const s = outlineSVG(viewKey, age);
    const blob = new Blob([s], { type: "image/svg+xml" });
    return SM.util.blobToImage(blob);
  }

  /* compute where the outline sits within a frame of size W×H for a given transform */
  function outlineRect(W, H, t, viewBoxAspect) {
    // outline fills 88 % of frame height by default, centred, then scaled & offset
    const baseH = H * 0.88 * (t.scale || 1), baseW = baseH * viewBoxAspect;
    const cx = W / 2 + (t.x || 0) * W, cy = H / 2 + (t.y || 0) * H;
    return { x: cx - baseW / 2, y: cy - baseH / 2, w: baseW, h: baseH };
  }
  function aspectOf(viewKey, age) {
    const m = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(outlineSVG(viewKey, age));
    return m ? +m[3] / +m[4] : 0.5;
  }

  SM.overlays = { VIEWS, outlineSVG, drawGrid, paintGrid, outlineImage, outlineRect, aspectOf };
})(typeof window !== "undefined" ? window : globalThis);

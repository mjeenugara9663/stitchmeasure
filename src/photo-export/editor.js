/* Photo editor: zoom/pan, rotate, crop, grid, landmark points, measurement
 * lines with draggable handles, calibration, undo/redo, annotated export.
 * The original image is never modified; annotations are stored beside it. */
(function () {
  "use strict";
  const SM = window.SM, U = SM.util, t = SM.t, app = SM.app, E = SM.engine, CAL = SM.calibration, PX = SM.photoExport;

  const LANDMARKS = ["Top of head", "Neck base", "Nape", "Shoulder point (L)", "Shoulder point (R)", "Bust point", "Natural waist", "Hip (fullest)", "Crotch", "Knee", "Ankle", "Elbow", "Wrist", "Floor"];

  function open(photo, opts) {
    opts = opts || {};
    return new Promise(async (resolve) => {
      const customer = opts.customer || (photo.customerId ? await SM.customers.get(photo.customerId) : null);
      const unit = app.unit(customer);
      photo.ann = Object.assign({ points: [], lines: [], cal: null, crop: null, rotation: 0, grid: { show: false, density: 8, opacity: 0.5 } }, photo.ann || {});
      const ann = photo.ann;
      const img = await U.blobToImage(photo.blob);
      const IW = img.naturalWidth, IH = img.naturalHeight;
      let rotCanvas = null;
      const undo = [], redo = [];
      const st = { tool: "line", s: 1, ox: 0, oy: 0, sel: null, pending: null, calEdge: "edge1", drag: null, dirty: false };
      const calIn = Object.assign({ method: (opts.calMethod && opts.calMethod !== "depth") ? opts.calMethod : "a4", confirmed: false, knownMm: 300, markerMm: 100, heightCm: customer && customer.heightCm ? customer.heightCm : null }, ann.cal ? { method: ann.cal.method, confirmed: ann.cal.confirmed, knownMm: ann.cal.knownMm, markerMm: ann.cal.markerMm, heightCm: ann.cal.heightCm || (customer && customer.heightCm) } : {});

      const root = document.createElement("div");
      root.className = "editor"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", t("Photo editor"));
      root.innerHTML = `
        <div class="ed-top">
          <button class="icon-btn" data-close aria-label="${t("Close editor")}">${SM.icon("back")}</button>
          <div class="title">${U.esc(customer ? customer.name + " · " : "")}${t(SM.overlays.VIEWS[photo.view] ? SM.overlays.VIEWS[photo.view].name : "Photo")}${opts.temporary ? " · " + t("not stored") : ""}</div>
          <button class="icon-btn" data-undo aria-label="${t("Undo")}" disabled>${SM.icon("undo")}</button>
          <button class="icon-btn" data-redo aria-label="${t("Redo")}" disabled>${SM.icon("redo")}</button>
          <button class="icon-btn" data-zoomout aria-label="${t("Zoom out")}"><b style="font-size:22px;line-height:1">−</b></button>
          <button class="icon-btn" data-zoomin aria-label="${t("Zoom in")}"><b style="font-size:22px;line-height:1">+</b></button>
          <button class="btn sm primary" data-save style="background:#3CC4B8;border-color:#3CC4B8;color:#06201E">${opts.temporary ? t("Done") : t("Save")}</button>
        </div>
        <div class="ed-stage" data-stage><canvas data-cv></canvas></div>
        <div class="ed-tools" role="toolbar">
          ${[["pan", "hand", "Move"], ["line", "line", "Line"], ["point", "point", "Point"], ["cal", "target", "Calibrate"], ["grid", "grid", "Grid"], ["rotate", "rotate", "Rotate"], ["crop", "crop", "Crop"], ["export", "download", "Export"]].map(([k, i, n]) => `<button data-tool="${k}" aria-pressed="${k === st.tool}">${SM.icon(i)}${t(n)}</button>`).join("")}
        </div>
        <div class="ed-panel" data-panel></div>`;
      document.body.appendChild(root);
      document.body.classList.add("no-scroll");
      const $ = (s) => root.querySelector(s);
      const cv = $("[data-cv]"), stage = $("[data-stage]");
      const g = cv.getContext("2d");

      /* ---------- geometry ---------- */
      const rot = () => ann.rotation || 0;
      const vd = () => PX.dims(IW, IH, rot());
      function buildRot() { const d = vd(); rotCanvas = document.createElement("canvas"); rotCanvas.width = d.w; rotCanvas.height = d.h; PX.drawRotated(rotCanvas.getContext("2d"), img, IW, IH, rot()); }
      function fit() { const d = vd(), W = stage.clientWidth, H = stage.clientHeight; st.s = Math.min(W / d.w, H / d.h) * 0.94; st.ox = (W - d.w * st.s) / 2; st.oy = (H - d.h * st.s) / 2; }
      const screenToView = (x, y) => ({ x: (x - st.ox) / st.s, y: (y - st.oy) / st.s });
      const viewToScreen = (p) => ({ x: st.ox + p.x * st.s, y: st.oy + p.y * st.s });
      const toOrig = (vp) => PX.fromView(vp, IW, IH, rot());
      const toV = (op) => PX.toView(op, IW, IH, rot());
      const clampO = (p) => ({ x: U.clamp(p.x, 0, IW), y: U.clamp(p.y, 0, IH) });

      function snapshot() { undo.push(JSON.stringify(ann)); if (undo.length > 60) undo.shift(); redo.length = 0; st.dirty = true; buttons(); }
      function restore(json) { const o = JSON.parse(json); Object.keys(ann).forEach((k) => delete ann[k]); Object.assign(ann, o); buildRot(); }
      function buttons() { $("[data-undo]").disabled = !undo.length; $("[data-redo]").disabled = !redo.length; }

      /* ---------- drawing ---------- */
      function draw(loupeAt) {
        const dpr = window.devicePixelRatio || 1, W = stage.clientWidth, H = stage.clientHeight;
        if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
        g.save(); g.translate(st.ox, st.oy); g.scale(st.s, st.s);
        g.imageSmoothingQuality = "high";
        g.drawImage(rotCanvas, 0, 0);
        const d = vd();
        if (ann.grid && ann.grid.show) { g.save(); g.beginPath(); g.rect(0, 0, d.w, d.h); g.clip(); SM.overlays.paintGrid(g, d.w, d.h, { density: ann.grid.density, opacity: ann.grid.opacity }); g.restore(); }
        if (ann.crop) {
          const c = ann.crop; g.fillStyle = "rgba(0,0,0,.55)";
          g.fillRect(0, 0, d.w, c.y); g.fillRect(0, c.y + c.h, d.w, d.h - c.y - c.h); g.fillRect(0, c.y, c.x, c.h); g.fillRect(c.x + c.w, c.y, d.w - c.x - c.w, c.h);
          g.strokeStyle = "#D8B76A"; g.lineWidth = 2 / st.s; g.setLineDash([8 / st.s, 6 / st.s]); g.strokeRect(c.x, c.y, c.w, c.h); g.setLineDash([]);
        }
        PX.drawAnnotations(g, ann, IW, IH, rot(), 1 / st.s, unit);
        // pending first point and selected handle
        const mark = (vp, color) => { g.beginPath(); g.arc(vp.x, vp.y, 9 / st.s, 0, 7); g.lineWidth = 3 / st.s; g.strokeStyle = color; g.stroke(); };
        if (st.pending) mark(toV(st.pending), "#ffffff");
        if (st.sel && st.sel.p) mark(toV(st.sel.p), "#ffffff");
        g.restore();
        if (loupeAt) loupe(loupeAt);
      }
      function loupe(op) {
        const sp = viewToScreen(toV(op)), dpr = window.devicePixelRatio || 1, R = 64, Z = 2.5;
        const lx = sp.x < 170 && sp.y < 170 ? stage.clientWidth - R * 2 - 12 : 12, ly = 12;
        g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.beginPath(); g.arc(lx + R, ly + R, R, 0, 7); g.closePath(); g.save(); g.clip();
        g.fillStyle = "#000"; g.fillRect(lx, ly, R * 2, R * 2);
        const src = (R * 2 / Z) * dpr;
        g.drawImage(cv, sp.x * dpr - src / 2, sp.y * dpr - src / 2, src, src, lx, ly, R * 2, R * 2);
        g.restore();
        g.strokeStyle = "#D8B76A"; g.lineWidth = 3; g.beginPath(); g.arc(lx + R, ly + R, R, 0, 7); g.stroke();
        g.strokeStyle = "#fff"; g.lineWidth = 1; g.beginPath(); g.moveTo(lx + R - 10, ly + R); g.lineTo(lx + R + 10, ly + R); g.moveTo(lx + R, ly + R - 10); g.lineTo(lx + R, ly + R + 10); g.stroke();
        g.restore();
      }

      /* ---------- hit testing ---------- */
      function handles() {
        const hs = [];
        (ann.lines || []).forEach((l) => { hs.push({ obj: l, key: "a", p: l.a }); hs.push({ obj: l, key: "b", p: l.b }); });
        (ann.points || []).forEach((p) => hs.push({ obj: p, key: null, p }));
        if (ann.cal) ["edge1", "edge2"].forEach((e) => { const ed = ann.cal[e]; if (ed && ed[0]) { hs.push({ obj: ed, key: 0, p: ed[0], cal: true }); if (ed[1]) hs.push({ obj: ed, key: 1, p: ed[1], cal: true }); } });
        return hs;
      }
      function hit(sx, sy) {
        let best = null, bd = 24;
        handles().forEach((h) => { const s = viewToScreen(toV(h.p)); const d = Math.hypot(s.x - sx, s.y - sy); if (d < bd) { bd = d; best = h; } });
        return best;
      }
      function setHandle(h, op) {
        op = clampO(op);
        if (h.key === null) { h.obj.x = op.x; h.obj.y = op.y; }
        else if (h.cal) { h.obj[h.key] = op; }
        else { h.obj[h.key] = op; }
        h.p = h.key === null ? h.obj : h.obj[h.key];
        if (h.cal) recalibrate(false);
      }

      /* ---------- pointer input ---------- */
      const ptrs = new Map(); let gesture = null;
      stage.addEventListener("pointerdown", (e) => {
        stage.setPointerCapture(e.pointerId);
        const r = stage.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
        ptrs.set(e.pointerId, { x: sx, y: sy });
        if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; gesture = { type: "pinch", d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, s: st.s, ox: st.ox, oy: st.oy }; return; }
        const vp = screenToView(sx, sy), op = clampO(toOrig(vp));
        const h = st.tool !== "pan" && st.tool !== "crop" ? hit(sx, sy) : null;
        if (h) { snapshot(); gesture = { type: "handle", h, start: { sx, sy } }; st.sel = h; draw(h.p); return; }
        if (st.tool === "pan" || st.tool === "grid" || st.tool === "rotate" || st.tool === "export") { gesture = { type: "pan", sx, sy, ox: st.ox, oy: st.oy }; return; }
        if (st.tool === "line" || st.tool === "cal") {
          if (st.pending) { gesture = { type: "tap2", sx, sy, op }; return; }
          gesture = { type: "draw", sx, sy, a: op, b: op, moved: false };
          return;
        }
        if (st.tool === "point") { gesture = { type: "tapPoint", sx, sy, op }; return; }
        if (st.tool === "crop") { const vv = { x: U.clamp(vp.x, 0, vd().w), y: U.clamp(vp.y, 0, vd().h) }; gesture = { type: "crop", a: vv, before: JSON.stringify(ann) }; }
      });
      stage.addEventListener("pointermove", (e) => {
        if (!ptrs.has(e.pointerId) || !gesture) return;
        const r = stage.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
        ptrs.set(e.pointerId, { x: sx, y: sy });
        if (gesture.type === "pinch" && ptrs.size >= 2) {
          const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
          const ns = U.clamp(gesture.s * d / Math.max(10, gesture.d), 0.05, 20);
          st.ox = cx - (gesture.cx - gesture.ox) * (ns / gesture.s); st.oy = cy - (gesture.cy - gesture.oy) * (ns / gesture.s); st.s = ns; draw(); return;
        }
        const vp = screenToView(sx, sy), op = clampO(toOrig(vp));
        if (gesture.type === "handle") { setHandle(gesture.h, op); draw(gesture.h.p); panelValues(); }
        else if (gesture.type === "pan") { st.ox = gesture.ox + sx - gesture.sx; st.oy = gesture.oy + sy - gesture.sy; draw(); }
        else if (gesture.type === "draw") { if (Math.hypot(sx - gesture.sx, sy - gesture.sy) > 8) gesture.moved = true; gesture.b = op; drawTemp(gesture.a, op); }
        else if (gesture.type === "crop") { const b = { x: U.clamp(vp.x, 0, vd().w), y: U.clamp(vp.y, 0, vd().h) }; ann.crop = { x: Math.min(gesture.a.x, b.x), y: Math.min(gesture.a.y, b.y), w: Math.abs(b.x - gesture.a.x), h: Math.abs(b.y - gesture.a.y) }; draw(); }
      });
      function drawTemp(a, b) {
        draw(b);
        const dpr = window.devicePixelRatio || 1, A = viewToScreen(toV(a)), B = viewToScreen(toV(b));
        g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.strokeStyle = st.tool === "cal" ? "#D8B76A" : "#3CC4B8"; g.lineWidth = 2.5; g.setLineDash([6, 4]);
        g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke(); g.restore();
      }
      const finishSeg = (a, b) => {
        if (CAL.len(a, b) < 3) return;
        snapshot();
        if (st.tool === "line") { const ln = { id: U.uid("ln"), a, b, label: "", measureId: opts.measureId && !ann.lines.some((l) => l.measureId === opts.measureId) ? opts.measureId : "" }; ann.lines.push(ln); st.sel = null; }
        else { ann.cal = ann.cal || {}; ann.cal[st.calEdge] = [a, b]; if (st.calEdge === "edge1" && calIn.method !== "known" && calIn.method !== "height") st.calEdge = "edge2"; recalibrate(true); }
        panel(); draw();
      };
      const end = (e) => {
        if (!ptrs.has(e.pointerId)) return;
        ptrs.delete(e.pointerId);
        if (!gesture) return;
        const gs = gesture;
        if (gs.type === "pinch") { if (ptrs.size === 0) gesture = null; return; }
        gesture = null;
        if (gs.type === "handle") { panel(); draw(); return; }
        if (gs.type === "draw") {
          if (gs.moved) finishSeg(gs.a, gs.b);
          else { st.pending = gs.a; draw(); U.toast(t("Now tap the second point.")); }
        } else if (gs.type === "tap2") { const a = st.pending; st.pending = null; finishSeg(a, gs.op); }
        else if (gs.type === "tapPoint") addPoint(gs.op);
        else if (gs.type === "crop") { if (!ann.crop || ann.crop.w < 20 || ann.crop.h < 20) { ann.crop = JSON.parse(gs.before).crop || null; } else { undo.push(gs.before); redo.length = 0; st.dirty = true; buttons(); } draw(); panel(); }
      };
      stage.addEventListener("pointerup", end); stage.addEventListener("pointercancel", end);
      stage.addEventListener("wheel", (e) => { e.preventDefault(); const r = stage.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
      function zoomAt(x, y, f) { const ns = U.clamp(st.s * f, 0.05, 20); st.ox = x - (x - st.ox) * (ns / st.s); st.oy = y - (y - st.oy) * (ns / st.s); st.s = ns; draw(); }

      async function addPoint(op) {
        const sh = U.sheet({ title: t("Landmark point"), html: `<div class="choice-grid">${LANDMARKS.map((l) => `<button class="choice" data-l="${U.esc(l)}"><b>${U.esc(t(l))}</b></button>`).join("")}</div><form class="row" data-f style="flex-wrap:nowrap"><input type="text" placeholder="${t("Custom label")}" data-c><button class="btn primary">${t("Add")}</button></form>` });
        const add = (label) => { snapshot(); ann.points.push({ id: U.uid("pt"), x: op.x, y: op.y, label }); sh.close(); draw(); panel(); };
        sh.el.onclick = (e) => { const b = e.target.closest("[data-l]"); if (b) add(t(b.dataset.l)); };
        sh.el.querySelector("[data-f]").onsubmit = (e) => { e.preventDefault(); const v = sh.el.querySelector("[data-c]").value.trim(); if (v) add(v); };
      }

      /* ---------- calibration ---------- */
      function recalibrate(record) {
        const res = CAL.calibrate({ method: calIn.method, confirmed: calIn.confirmed, knownMm: calIn.knownMm, markerMm: calIn.markerMm, heightCm: calIn.heightCm, edge1: ann.cal && ann.cal.edge1, edge2: ann.cal && ann.cal.edge2 });
        ann.cal = Object.assign(ann.cal || {}, { method: calIn.method, confirmed: calIn.confirmed, knownMm: calIn.knownMm, markerMm: calIn.markerMm, heightCm: calIn.heightCm, result: res });
        if (record && res.valid && !opts.temporary) SM.db.put("calibrations", { id: U.uid("cal"), photoId: photo.id, customerId: photo.customerId, method: res.method, mmPerPx: res.mmPerPx, scope: res.scope, at: res.at, warnings: res.warnings });
        return res;
      }

      /* value of a line for its measurement type */
      function lineValue(ln) {
        const entry = ln.measureId && SM.catalog.get(ln.measureId);
        if (entry && entry.kind === "angle") {
          const a = toV(ln.a), b = toV(ln.b); let ang = Math.abs(Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI); if (ang > 90) ang = 180 - ang;
          return { text: ang.toFixed(1) + "°", value: ang, ok: true, note: t("Angle needs no calibration, but phone tilt affects it.") };
        }
        const r = CAL.measure(ann.cal && ann.cal.result, ln.a, ln.b);
        if (r.mm == null) return { text: Math.round(r.px) + " px", value: null, ok: false, note: r.reason };
        return { text: E.format(r.mm / 10, unit) + " " + E.unitLabel(unit), value: r.mm / 10, ok: true };
      }

      /* ---------- panels ---------- */
      const camEntries = SM.catalog.all.filter((e) => e.camera);
      function panelValues() { root.querySelectorAll("[data-lv]").forEach((n) => { const ln = ann.lines.find((l) => l.id === n.dataset.lv); if (ln) n.textContent = lineValue(ln).text; }); const cr = root.querySelector("[data-calres]"); if (cr) cr.innerHTML = calResultHTML(); }
      function calResultHTML() {
        const r = ann.cal && ann.cal.result;
        if (!r) return `<div class="notice">${SM.icon("info")}<div>${t("Not calibrated. Lines show pixel distances only.")}</div></div>`;
        if (!r.valid) return `<div class="notice danger">${SM.icon("warn")}<div><b>${t("Calibration rejected")}</b><br>${r.errors.map(U.esc).join("<br>")}<br><small>${t("Fix the marks or retake the photo. No physical values are shown until calibration passes.")}</small></div></div>`;
        return `<div class="notice ok">${SM.icon("check")}<div><b>${t("Calibrated")}</b> · ${t(CAL.METHODS[r.method].name)} · ${(r.mmPerPx).toFixed(3)} mm/px${r.scope === "vertical" ? " · " + t("vertical lines only") : ""}${r.warnings.length ? `<ul>${r.warnings.map((w) => `<li>${U.esc(t(w))}</li>`).join("")}</ul>` : ""}</div></div>`;
      }
      function panel() {
        const p = $("[data-panel]");
        root.querySelectorAll("[data-tool]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.tool === st.tool));
        if (st.tool === "pan") p.innerHTML = `<p class="ed-hint">${t("Drag to move the photo. Pinch or use + / − to zoom.")}</p>`;
        else if (st.tool === "line") {
          p.innerHTML = `<p class="ed-hint">${t("Drag across the photo to draw a line, or tap two points. Drag the round handles to adjust; a magnifier helps you place them.")}</p>
            <div data-calres>${calResultHTML()}</div>
            <div class="ed-lines">${(ann.lines || []).map((ln) => { const v = lineValue(ln); return `<div class="ed-line" data-l="${ln.id}">
              <div class="n"><select data-mid aria-label="${t("Measurement")}"><option value="">${t("Unassigned line")}</option>${camEntries.map((e) => `<option value="${e.id}" ${ln.measureId === e.id ? "selected" : ""}>${U.esc(SM.catalog.name(e.id))}</option>`).join("")}</select>
              ${v.note ? `<div class="ed-hint" style="margin-top:4px">${U.esc(v.note)}</div>` : ""}</div>
              <span class="v" data-lv="${ln.id}">${v.text}</span>
              ${ln.measureId && v.ok ? `<button class="btn sm primary" data-send title="${t("Add as a camera reading to the measurement record")}">${t("Use")}</button>` : ""}
              <button class="icon-btn" data-del aria-label="${t("Delete line")}">${SM.icon("trash")}</button></div>`; }).join("") || `<p class="ed-hint">${t("No lines yet.")}</p>`}</div>
            <p class="ed-hint">${t("Only straight distances in the photo plane can be measured here. Circumferences and depths need a tape and are not listed.")}</p>`;
        } else if (st.tool === "point") {
          p.innerHTML = `<p class="ed-hint">${t("Tap the photo to place a labelled landmark. Drag a point to move it.")}</p>
            <div class="ed-lines">${(ann.points || []).map((pt) => `<div class="ed-line" data-p="${pt.id}"><span class="n">${U.esc(pt.label)}</span><button class="icon-btn" data-delp aria-label="${t("Delete point")}">${SM.icon("trash")}</button></div>`).join("")}</div>`;
        } else if (st.tool === "cal") {
          const m = calIn.method, M = CAL.METHODS[m];
          p.innerHTML = `
            <label class="field">${t("Calibration method")}<select data-cm>${Object.entries(CAL.METHODS).map(([k, v]) => `<option value="${k}" ${m === k ? "selected" : ""} ${k === "depth" ? "disabled" : ""}>${t(v.name)}${k === "depth" ? " — " + t("not available in web version") : ""}</option>`).join("")}</select></label>
            <p class="ed-hint">${t(M.hint)}</p>
            ${m === "marker" ? `<label class="field">${t("Marker size (mm)")}<input type="number" step="any" data-cv-mm value="${calIn.markerMm}"></label><button class="btn sm" data-dlmarker>${SM.icon("download")}${t("Get printable marker")}</button>` : ""}
            ${m === "known" ? `<label class="field">${t("Real length of the object (mm)")}<input type="number" step="any" data-cv-known value="${calIn.knownMm || ""}"></label>` : ""}
            ${m === "height" ? `<label class="field">${t("Verified standing height")} (cm)<input type="number" step="any" data-cv-h value="${calIn.heightCm || ""}"></label>` : ""}
            ${m === "marker" || m === "a4" ? `<label class="check"><input type="checkbox" data-cv-conf ${calIn.confirmed ? "checked" : ""}><span>${m === "a4" ? t("This is a genuine A4 sheet (210 × 297 mm), held flat against the body, facing the camera.") : t("The marker was printed at actual size (100 %), and I checked it with a ruler.")}</span></label>` : ""}
            ${m !== "depth" ? `<div class="row"><span class="ed-hint">${t("Mark on the photo:")}</span>
              <button class="btn sm ${st.calEdge === "edge1" ? "primary" : ""}" data-edge="edge1">${m === "height" ? t("Head → floor") : m === "a4" ? t("Long edge") : m === "known" ? t("Object ends") : t("Edge 1")}${ann.cal && ann.cal.edge1 ? " ✓" : ""}</button>
              ${m === "marker" || m === "a4" ? `<button class="btn sm ${st.calEdge === "edge2" ? "primary" : ""}" data-edge="edge2">${m === "a4" ? t("Short edge") : t("Edge 2")}${ann.cal && ann.cal.edge2 ? " ✓" : ""}</button>` : ""}
              <button class="btn sm" data-calclear>${t("Clear")}</button></div>` : ""}
            <div data-calres>${calResultHTML()}</div>`;
        } else if (st.tool === "grid") {
          const gr = ann.grid;
          p.innerHTML = `<label class="check"><input type="checkbox" data-gs ${gr.show ? "checked" : ""}><span>${t("Show grid on photo")}</span></label>
            <label class="field">${t("Grid density")}<input type="range" min="3" max="30" value="${gr.density}" data-gd></label>
            <label class="field">${t("Grid opacity")}<input type="range" min="10" max="100" value="${Math.round(gr.opacity * 100)}" data-go></label>
            <p class="ed-hint">${t("Grid squares are visual guides, not centimetres.")}</p>`;
        } else if (st.tool === "rotate") {
          p.innerHTML = `<div class="btn-row"><button class="btn" data-rot="-90">${t("Rotate left")}</button><button class="btn" data-rot="90">${t("Rotate right")}</button></div><p class="ed-hint">${t("Rotation applies to the annotated copies; the original photo is kept unchanged.")}</p>`;
        } else if (st.tool === "crop") {
          p.innerHTML = `<p class="ed-hint">${t("Drag a rectangle over the photo to crop the annotated copies. The stored original stays complete.")}</p><div class="btn-row"><button class="btn" data-cropclear ${ann.crop ? "" : "disabled"}>${t("Remove crop")}</button></div>`;
        } else if (st.tool === "export") {
          p.innerHTML = `<label class="field">${t("Version")}<select data-ver>${Object.entries(PX.VERSIONS).map(([k, v]) => `<option value="${k}" ${k === "lines" ? "selected" : ""}>${t(v)}</option>`).join("")}<option value="all">${t("All layers")}</option></select></label>
            <label class="field">${t("Format")}<select data-fmt><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option></select></label>
            <div class="btn-row"><button class="btn primary" data-ex="gallery">${t("Save to Gallery / Photos")}</button><button class="btn" data-ex="download">${t("Download")}</button><button class="btn" data-ex="share">${t("Share")}</button>${window.showSaveFilePicker ? `<button class="btn" data-ex="saveas">${t("Save as…")}</button>` : ""}</div>
            <p class="ed-hint">${U.esc(PX.galleryHelp())}</p>`;
        }
      }

      $("[data-panel]").addEventListener("change", (e) => {
        const tg = e.target;
        if (tg.matches("[data-mid]")) { snapshot(); const ln = ann.lines.find((l) => l.id === tg.closest("[data-l]").dataset.l); ln.measureId = tg.value; panel(); draw(); }
        else if (tg.matches("[data-cm]")) { calIn.method = tg.value; calIn.confirmed = false; st.calEdge = "edge1"; if (ann.cal) { ann.cal.edge2 = null; } if (calIn.method === "height" && !calIn.heightCm && customer && customer.heightCm) calIn.heightCm = customer.heightCm; if (ann.cal && ann.cal.edge1) recalibrate(false); panel(); draw(); }
        else if (tg.matches("[data-cv-mm]")) { calIn.markerMm = +tg.value; recalibrate(false); panelValues(); }
        else if (tg.matches("[data-cv-known]")) { calIn.knownMm = +tg.value; recalibrate(false); panelValues(); }
        else if (tg.matches("[data-cv-h]")) { calIn.heightCm = +tg.value; recalibrate(false); panelValues(); }
        else if (tg.matches("[data-cv-conf]")) { calIn.confirmed = tg.checked; if (ann.cal && ann.cal.edge1) recalibrate(true); panelValues(); draw(); }
        else if (tg.matches("[data-gs]")) { ann.grid.show = tg.checked; st.dirty = true; draw(); }
      });
      $("[data-panel]").addEventListener("input", (e) => {
        if (e.target.matches("[data-gd]")) { ann.grid.density = +e.target.value; st.dirty = true; draw(); }
        if (e.target.matches("[data-go]")) { ann.grid.opacity = e.target.value / 100; st.dirty = true; draw(); }
      });
      $("[data-panel]").addEventListener("click", async (e) => {
        const tg = e.target;
        if (tg.closest("[data-del]")) { snapshot(); const id = tg.closest("[data-l]").dataset.l; ann.lines = ann.lines.filter((l) => l.id !== id); panel(); draw(); }
        else if (tg.closest("[data-delp]")) { snapshot(); const id = tg.closest("[data-p]").dataset.p; ann.points = ann.points.filter((p) => p.id !== id); panel(); draw(); }
        else if (tg.closest("[data-send]")) sendLine(ann.lines.find((l) => l.id === tg.closest("[data-l]").dataset.l));
        else if (tg.closest("[data-edge]")) { st.calEdge = tg.closest("[data-edge]").dataset.edge; panel(); U.toast(t("Drag along the edge on the photo.")); }
        else if (tg.closest("[data-calclear]")) { snapshot(); ann.cal = null; st.calEdge = "edge1"; panel(); draw(); }
        else if (tg.closest("[data-dlmarker]")) downloadMarker(calIn.markerMm || 100);
        else if (tg.closest("[data-rot]")) { snapshot(); ann.rotation = (rot() + (+tg.closest("[data-rot]").dataset.rot) + 360) % 360; ann.crop = null; buildRot(); fit(); draw(); }
        else if (tg.closest("[data-cropclear]")) { snapshot(); ann.crop = null; draw(); panel(); }
        else if (tg.closest("[data-ex]")) {
          const mode = tg.closest("[data-ex]").dataset.ex, ver = $("[data-ver]").value, fmt = $("[data-fmt]").value;
          const c = await PX.render(photo, ver, unit);
          let b = await U.canvasToBlob(c, fmt, 0.92); if (fmt === "image/webp" && b.type !== "image/webp") b = await U.canvasToBlob(c, "image/png");
          const name = PX.filename(customer, photo, ver, b.type === "image/png" ? "png" : b.type === "image/webp" ? "webp" : "jpg");
          const r = mode === "gallery" ? await PX.toGallery(b, name) : mode === "share" ? await PX.share(b, name) : mode === "saveas" ? await PX.saveAs(b, name) : await PX.download(b, name);
          U.toast(r.message || "");
        }
      });

      async function sendLine(ln) {
        const v = lineValue(ln); if (!v.ok) return;
        const entry = SM.catalog.get(ln.measureId);
        if (!customer) { U.toast(t("Save this photo to a customer first."), "err"); return; }
        let s = opts.sessionId ? await SM.db.get("sessions", opts.sessionId) : photo.sessionId ? await SM.db.get("sessions", photo.sessionId) : null;
        if (!s) { const list = await SM.customers.sessions(customer.id); s = list[0] || (await app.ensureSession(customer.id, customer.garment || "u_body_basic")); }
        const tpl = await app.resolveTemplate(s.templateId);
        const it = (s.items[ln.measureId] = s.items[ln.measureId] || E.newItem());
        let force = false;
        if (it.verified) { force = await U.confirm({ title: t("Replace a verified value?"), message: t("{n} is already tape-verified. Adding a camera reading removes the verification.", { n: SM.catalog.name(ln.measureId) }), ok: t("Add reading"), danger: true }); if (!force) return; }
        E.addReading(it, v.value, "camera", { force, photoId: photo.id, by: app.settings.designer });
        const ids = app.sessionIds(s, tpl); if (!ids.includes(ln.measureId)) s.order = ids.concat([ln.measureId]);
        await app.saveSession(s);
        if (!photo.sessionId && !opts.temporary) { photo.sessionId = s.id; st.dirty = true; }
        U.toast(t("{n}: {v} added as a camera reading. {need}", { n: SM.catalog.name(ln.measureId), v: v.text, need: entry.critical ? t("Tape verification required.") : "" }));
      }

      async function downloadMarker(mm) {
        // 300 dpi image of a square marker of the given size with a ruler, to print at 100 %
        const dpi = 300, px = Math.round(mm / 25.4 * dpi), pad = Math.round(15 / 25.4 * dpi);
        const c = document.createElement("canvas"); c.width = px + pad * 2; c.height = px + pad * 2 + Math.round(20 / 25.4 * dpi);
        const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
        x.fillStyle = "#000"; x.fillRect(pad, pad, px, px); x.fillStyle = "#fff"; const q = px / 5;
        x.fillRect(pad + q, pad + q, q, q); x.fillRect(pad + 3 * q, pad + q, q, q); x.fillRect(pad + q, pad + 3 * q, 3 * q, q * 0.6);
        x.fillStyle = "#000"; x.font = `${Math.round(dpi / 7)}px sans-serif`;
        x.fillText(`StitchMeasure calibration marker · ${mm} × ${mm} mm · print at 100 % (actual size) and check with a ruler`, pad, pad + px + Math.round(dpi / 4));
        const b = await U.canvasToBlob(c, "image/png");
        const r = await PX.download(b, `StitchMeasure_marker_${mm}mm_300dpi.png`);
        U.toast(r.message + " " + t("Print at 300 dpi / actual size, then measure the black square: it must be exactly {mm} mm.", { mm }));
      }

      /* ---------- toolbar & lifecycle ---------- */
      root.querySelector(".ed-tools").onclick = (e) => { const b = e.target.closest("[data-tool]"); if (!b) return; st.tool = b.dataset.tool; st.pending = null; panel(); draw(); };
      $("[data-undo]").onclick = () => { if (!undo.length) return; redo.push(JSON.stringify(ann)); restore(undo.pop()); buttons(); panel(); draw(); };
      $("[data-redo]").onclick = () => { if (!redo.length) return; undo.push(JSON.stringify(ann)); restore(redo.pop()); buttons(); panel(); draw(); };
      $("[data-zoomin]").onclick = () => zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 1.3);
      $("[data-zoomout]").onclick = () => zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 1 / 1.3);
      const onResize = () => { fit(); draw(); };
      window.addEventListener("resize", onResize);
      async function save() {
        if (!opts.temporary) { await SM.db.put("photos", photo); await SM.db.log("Annotations saved", photo.id); U.toast(t("Annotations saved. The original photo is unchanged.")); }
        st.dirty = false;
      }
      $("[data-save]").onclick = async () => { await save(); close(); };
      $("[data-close]").onclick = async () => {
        if (st.dirty && !opts.temporary) {
          const keep = await U.confirm({ title: t("Save changes?"), message: t("You have unsaved annotations."), ok: t("Save"), cancel: t("Discard") });
          if (keep) await save();
        }
        close();
      };
      function close() { window.removeEventListener("resize", onResize); root.remove(); if (!document.querySelector(".sheet-wrap,.cam")) document.body.classList.remove("no-scroll"); resolve(photo); }

      buildRot(); fit(); panel(); draw();
      if (ann.cal && ann.cal.edge1) recalibrate(false);
      if (opts.tool) { st.tool = opts.tool; panel(); }
    });
  }

  SM.editor = { open };
})();

/* Photo Storage & Export Service.
 * - Builds the four photo versions (original, with outline, with grid,
 *   with measurement lines) without altering the stored original.
 * - Saves via download, Web Share (files) or the File System Access API.
 * - A browser cannot insert into Gallery/Photos by itself; we never claim it did.
 */
(function (root) {
  "use strict";
  const SM = (root.SM = root.SM || {});

  const VERSIONS = {
    original: "Original photo",
    outline: "With body outline",
    grid: "With measurement grid",
    lines: "With measurement lines & labels"
  };
  const VIEW_NAMES = { front: "Front", back: "Back", left: "LeftSide", right: "RightSide", upper: "UpperBody", lower: "LowerBody", sleeve: "Sleeve", extended: "ArmsExtended", measurement: "Measurement", other: "Photo" };

  /* geometry helpers for rotation (rot in degrees, clockwise) */
  function dims(w, h, rot) { return rot % 180 ? { w: h, h: w } : { w, h }; }
  function toView(p, w, h, rot) {
    switch (rot) { case 90: return { x: h - p.y, y: p.x }; case 180: return { x: w - p.x, y: h - p.y }; case 270: return { x: p.y, y: w - p.x }; default: return { x: p.x, y: p.y }; }
  }
  function fromView(p, w, h, rot) {
    switch (rot) { case 90: return { x: p.y, y: h - p.x }; case 180: return { x: w - p.x, y: h - p.y }; case 270: return { x: w - p.y, y: p.x }; default: return { x: p.x, y: p.y }; }
  }
  function drawRotated(g, img, w, h, rot) {
    g.save();
    if (rot === 90) { g.translate(h, 0); g.rotate(Math.PI / 2); }
    else if (rot === 180) { g.translate(w, h); g.rotate(Math.PI); }
    else if (rot === 270) { g.translate(0, w); g.rotate(-Math.PI / 2); }
    g.drawImage(img, 0, 0, w, h);
    g.restore();
  }

  /* draw annotations (in view coordinates) onto a 2D context. k = visual scale */
  function drawAnnotations(g, ann, w, h, rot, k, unit, opts) {
    opts = opts || {};
    if (!ann) return;
    const V = (p) => toView(p, w, h, rot);
    const fontPx = 13 * k;
    const label = (text, x, y, color) => {
      g.font = `600 ${fontPx}px "DM Sans", system-ui, sans-serif`;
      const tw = g.measureText(text).width, pad = 4 * k;
      g.fillStyle = "rgba(14,27,44,.82)"; g.fillRect(x - pad, y - fontPx - pad * 0.5, tw + pad * 2, fontPx + pad * 1.6);
      g.fillStyle = color || "#ffffff"; g.fillText(text, x, y);
    };
    const seg = (a, b, color, dash) => {
      g.save(); g.lineCap = "round";
      g.strokeStyle = "rgba(0,0,0,.55)"; g.lineWidth = 5 * k; g.setLineDash(dash ? [10 * k, 7 * k] : []);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      g.strokeStyle = color; g.lineWidth = 2.4 * k; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.restore();
      [a, b].forEach((p) => { g.beginPath(); g.arc(p.x, p.y, 5 * k, 0, 7); g.fillStyle = color; g.fill(); g.lineWidth = 1.5 * k; g.strokeStyle = "#0E1B2C"; g.stroke(); });
    };
    const cal = ann.cal;
    if (cal) {
      [cal.edge1, cal.edge2].forEach((e, i) => {
        if (!e || !e[0] || !e[1]) return;
        const a = V(e[0]), b = V(e[1]);
        seg(a, b, "#D8B76A", true);
        if (!opts.noLabels) label(i === 0 ? SM.t("Reference") : SM.t("Reference edge 2"), (a.x + b.x) / 2 + 8 * k, (a.y + b.y) / 2 - 8 * k, "#D8B76A");
      });
    }
    (ann.lines || []).forEach((ln) => {
      const a = V(ln.a), b = V(ln.b);
      seg(a, b, "#3CC4B8", false);
      if (opts.noLabels) return;
      const r = SM.calibration.measure(cal && cal.result, ln.a, ln.b);
      const val = r.mm != null ? SM.engine.format(r.mm / 10, unit || "cm") + " " + SM.engine.unitLabel(unit || "cm") : Math.round(r.px) + " px";
      const name = ln.measureId ? SM.catalog.name(ln.measureId) : (ln.label || SM.t("Line"));
      label(name + ": " + val, Math.min((a.x + b.x) / 2 + 10 * k, (rot % 180 ? h : w) - 200 * k), (a.y + b.y) / 2 - 10 * k);
    });
    (ann.points || []).forEach((pt) => {
      const p = V(pt);
      g.beginPath(); g.arc(p.x, p.y, 7 * k, 0, 7); g.lineWidth = 3 * k; g.strokeStyle = "rgba(0,0,0,.6)"; g.stroke();
      g.lineWidth = 2 * k; g.strokeStyle = "#D8B76A"; g.stroke();
      g.beginPath(); g.arc(p.x, p.y, 1.8 * k, 0, 7); g.fillStyle = "#fff"; g.fill();
      if (pt.label && !opts.noLabels) label(pt.label, p.x + 10 * k, p.y - 8 * k, "#D8B76A");
    });
  }

  /* produce a canvas for one version of a stored photo */
  async function render(photo, version, unit) {
    const img = await SM.util.blobToImage(photo.blob);
    const W = img.naturalWidth, Hh = img.naturalHeight;
    const ann = photo.ann || {};
    const rot = version === "original" ? 0 : (ann.rotation || 0);
    const d = dims(W, Hh, rot);
    const c = document.createElement("canvas"); c.width = d.w; c.height = d.h;
    const g = c.getContext("2d");
    drawRotated(g, img, W, Hh, rot);
    const k = Math.max(1, Math.max(d.w, d.h) / 1400);
    if (version === "outline" || version === "all") {
      const ov = photo.overlay || { view: photo.view in SM.overlays.VIEWS ? photo.view : "front", scale: 1, x: 0, y: 0, opacity: 0.8, age: "adult" };
      const oimg = await SM.overlays.outlineImage(ov.view, ov.age);
      const asp = SM.overlays.aspectOf(ov.view, ov.age);
      const r = SM.overlays.outlineRect(d.w, d.h, ov, asp);
      g.globalAlpha = ov.opacity == null ? 0.8 : Math.max(0.15, ov.opacity);
      g.drawImage(oimg, r.x, r.y, r.w, r.h);
      g.globalAlpha = 1;
    }
    if (version === "grid" || version === "all") {
      const gr = ann.grid || { density: 8, opacity: 0.6 };
      SM.overlays.paintGrid(g, d.w, d.h, { show: true, density: gr.density || 8, opacity: Math.max(0.4, gr.opacity || 0.6) });
    }
    if (version === "lines" || version === "all") drawAnnotations(g, ann, W, Hh, rot, k, unit);
    // crop applies to annotated versions only; the original stays complete
    if (version !== "original" && ann.crop && ann.crop.w > 20 && ann.crop.h > 20) {
      const cr = ann.crop, cc = document.createElement("canvas");
      cc.width = Math.round(cr.w); cc.height = Math.round(cr.h);
      cc.getContext("2d").drawImage(c, cr.x, cr.y, cr.w, cr.h, 0, 0, cc.width, cc.height);
      return cc;
    }
    return c;
  }

  function filename(customer, photo, version, ext) {
    const code = SM.util.safeName((customer && (customer.code || customer.name)) || "Customer");
    const date = (photo.createdAt || new Date().toISOString()).slice(0, 10);
    let part = VIEW_NAMES[photo.view] || "Photo";
    if (photo.measureId) part = SM.util.safeName(SM.catalog.name(photo.measureId).replace(/\s+/g, "")) + "_Measurement";
    const suffix = { original: "", outline: "_Outline", grid: "_Grid", lines: "_Annotated", all: "_AllLayers" }[version] || "";
    return `${code}_${part}_${date}${suffix}.${ext}`;
  }

  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = () => /Android/i.test(navigator.userAgent);
  function canShareFiles(file) { try { return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [file] })); } catch (e) { return false; } }

  /* returns a plain-language result; never claims Gallery success */
  async function download(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    return { done: true, message: isIOS() ? SM.t("Download started. On iPhone it goes to Files › Downloads; to put it in Photos use Share › Save Image.") : SM.t("Download started. Look in your Downloads folder.") };
  }
  async function share(blob, name, title) {
    const file = new File([blob], name, { type: blob.type });
    if (!canShareFiles(file)) return { done: false, unsupported: true, message: SM.t("Sharing files is not supported in this browser. Use Download instead.") };
    try { await navigator.share({ files: [file], title: title || name }); return { done: true, message: SM.t("Shared. The receiving app decides where the file is stored.") }; }
    catch (e) { if (e.name === "AbortError") return { done: false, message: SM.t("Sharing cancelled.") }; return { done: false, message: SM.t("Sharing failed: ") + e.message }; }
  }
  async function saveAs(blob, name) {
    if (!root.showSaveFilePicker) return { done: false, unsupported: true };
    try {
      const ext = name.split(".").pop();
      const h = await root.showSaveFilePicker({ suggestedName: name, types: [{ description: ext.toUpperCase(), accept: { [blob.type]: ["." + ext] } }] });
      const w = await h.createWritable(); await w.write(blob); await w.close();
      return { done: true, message: SM.t("Saved to the location you chose.") };
    } catch (e) { return { done: false, message: e.name === "AbortError" ? SM.t("Save cancelled.") : e.message }; }
  }
  /* Gallery / Photos workflow: iPhone → share sheet (user picks "Save Image");
   * Android → share sheet if available (user picks Gallery/Photos/Files) or download. */
  async function toGallery(blob, name) {
    const file = new File([blob], name, { type: blob.type });
    if (canShareFiles(file)) {
      const r = await share(blob, name);
      if (r.done) r.message = isIOS() ? SM.t("Share sheet completed. If you chose “Save Image”, the photo is now in Photos.") : SM.t("Share completed. If you picked Gallery, Photos or Files, the photo was saved there.");
      return r;
    }
    const r = await download(blob, name);
    if (isAndroid()) r.message = SM.t("Download started. Android usually shows downloaded images in Gallery under “Downloads” after a moment.");
    return r;
  }
  function galleryHelp() {
    if (isIOS()) return SM.t("On iPhone: tap Save to Gallery / Photos, then choose “Save Image” in the share sheet.");
    if (isAndroid()) return SM.t("On Android: tap Save to Gallery / Photos and pick Gallery, Photos or Files, or use Download and find it in Gallery › Downloads.");
    return SM.t("On a computer: use Download, or Save as… to choose a folder.");
  }

  async function makeThumb(canvasOrImg, max) {
    max = max || 320;
    const w = canvasOrImg.width || canvasOrImg.naturalWidth, h = canvasOrImg.height || canvasOrImg.naturalHeight;
    const k = Math.min(1, max / Math.max(w, h));
    const c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext("2d").drawImage(canvasOrImg, 0, 0, c.width, c.height);
    return SM.util.canvasToBlob(c, "image/jpeg", 0.75);
  }
  /* keep stored originals reasonable: long edge ≤ 2560 px, JPEG q 0.9 */
  async function compress(canvas, maxEdge) {
    maxEdge = maxEdge || 2560;
    const k = Math.min(1, maxEdge / Math.max(canvas.width, canvas.height));
    let c = canvas;
    if (k < 1) { c = document.createElement("canvas"); c.width = Math.round(canvas.width * k); c.height = Math.round(canvas.height * k); c.getContext("2d").drawImage(canvas, 0, 0, c.width, c.height); }
    return { blob: await SM.util.canvasToBlob(c, "image/jpeg", 0.9), w: c.width, h: c.height };
  }

  SM.photoExport = { VERSIONS, VIEW_NAMES, render, filename, download, share, saveAs, toGallery, galleryHelp, makeThumb, compress, drawAnnotations, toView, fromView, dims, drawRotated, isIOS, isAndroid, canShareFiles };
})(typeof window !== "undefined" ? window : globalThis);

/* Local photo library: browse by customer and view, open, annotate, export, delete. */
(function () {
  "use strict";
  const SM = window.SM, U = SM.util, t = SM.t, app = SM.app, PX = SM.photoExport;
  const viewName = (v) => t(SM.overlays.VIEWS[v] ? SM.overlays.VIEWS[v].name : v === "measurement" ? "Measurement" : "Photo");

  SM.views.photos = async function (el, args) {
    if (args[0]) return detail(el, args[0]);
    const [photos, customers] = await Promise.all([SM.db.all("photos"), SM.db.all("customers")]);
    const cmap = Object.fromEntries(customers.map((c) => [c.id, c]));
    const f = (app._phF = app._phF || { view: "all", cust: "all" });
    const list = photos.filter((p) => (f.view === "all" || p.view === f.view) && (f.cust === "all" || p.customerId === f.cust)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const bytes = photos.reduce((s, p) => s + (p.blob ? p.blob.size : 0) + (p.thumb ? p.thumb.size : 0), 0);
    el.innerHTML = app.head({ title: t("Photo library"), sub: t("{n} photos · {b} on this device. Originals are never altered by annotations.", { n: photos.length, b: U.bytes(bytes) }), actions: `<a class="btn primary" href="#/camera">${SM.icon("camera")}${t("Open camera")}</a>` }) + `
      <div class="stack">
        <div class="form-grid">
          <label class="field">${t("Customer")}<select id="phCust"><option value="all">${t("All customers")}</option>${customers.map((c) => `<option value="${c.id}" ${f.cust === c.id ? "selected" : ""}>${U.esc(c.name)}</option>`).join("")}</select></label>
          <label class="field">${t("View")}<select id="phView"><option value="all">${t("All views")}</option>${Object.entries(SM.overlays.VIEWS).map(([k, v]) => `<option value="${k}" ${f.view === k ? "selected" : ""}>${t(v.name)}</option>`).join("")}</select></label>
        </div>
        ${list.length ? `<div class="photo-grid" id="phGrid"></div>` : `<div class="empty">${SM.icon("image")}<p>${t("No photos here yet.")}</p></div>`}
      </div>`;
    const grid = U.$("#phGrid");
    if (grid) list.forEach((p) => {
      const a = document.createElement("a"); a.className = "photo-card"; a.href = "#/photos/" + p.id;
      a.innerHTML = `<img src="${URL.createObjectURL(p.thumb || p.blob)}" alt=""><span class="cap">${U.esc(cmap[p.customerId] ? cmap[p.customerId].name : t("No customer"))}<br>${viewName(p.view)} · ${U.esc(U.fmtDate(p.createdAt))}</span>`;
      grid.appendChild(a);
    });
    U.$("#phCust").onchange = (e) => { f.cust = e.target.value; app.rerender(); };
    U.$("#phView").onchange = (e) => { f.view = e.target.value; app.rerender(); };
  };

  async function detail(el, id) {
    const p = await SM.db.get("photos", id);
    if (!p) { el.innerHTML = `<div class="empty">${t("Photo not found.")}</div>`; return; }
    const c = p.customerId ? await SM.customers.get(p.customerId) : null;
    const nLines = (p.ann && p.ann.lines || []).length, cal = p.ann && p.ann.cal && p.ann.cal.result;
    let version = "original";
    el.innerHTML = app.head({ eyebrow: c ? c.name + " · " + c.code : "", title: viewName(p.view), sub: `${U.esc(U.fmtDateTime(p.createdAt))} · ${p.w}×${p.h}px · ${U.bytes(p.blob ? p.blob.size : 0)} · ${p.source === "import" ? t("imported") : t("camera")}`,
      actions: `<a class="btn" href="#/photos">${SM.icon("back")}${t("Library")}</a><button class="btn primary" data-edit>${SM.icon("ruler")}${t("Annotate & calibrate")}</button>` }) + `
      <div class="grid-2" style="align-items:start">
        <div class="stack">
          <div class="review-img" id="phPrev"></div>
          <div class="seg">${Object.entries({ original: "Original", outline: "Outline", grid: "Grid", lines: "Lines", all: "All" }).map(([k, n]) => `<button data-ver="${k}" aria-pressed="${k === version}">${t(n)}</button>`).join("")}</div>
        </div>
        <div class="stack">
          <section class="card stack-sm">
            <h3>${t("Analysis")}</h3>
            <p>${nLines} ${t("measurement lines")} · ${cal ? (cal.valid ? t("calibrated") + " (" + t(SM.calibration.METHODS[cal.method].name) + ")" : t("calibration rejected")) : t("not calibrated")}</p>
          </section>
          <section class="card stack">
            <h3>${t("Save & share")}</h3>
            <label class="field">${t("Format")}<select id="phFmt"><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select></label>
            <div class="btn-row"><button class="btn primary" data-x="gallery">${SM.icon("image")}${t("Save to Gallery / Photos")}</button><button class="btn" data-x="download">${SM.icon("download")}${t("Download photo")}</button><button class="btn" data-x="share">${SM.icon("share")}${t("Share photo")}</button><button class="btn" data-x="every">${t("Download all versions")}</button></div>
            <p class="muted small">${U.esc(PX.galleryHelp())}</p>
          </section>
          <section class="card stack-sm">
            <h3>${t("Organise")}</h3>
            <label class="field">${t("View / category")}<select id="phSetView">${Object.entries(SM.overlays.VIEWS).map(([k, v]) => `<option value="${k}" ${p.view === k ? "selected" : ""}>${t(v.name)}</option>`).join("")}<option value="measurement" ${p.view === "measurement" ? "selected" : ""}>${t("Selected measurement")}</option></select></label>
            <div class="btn-row"><button class="btn danger" data-del>${SM.icon("trash")}${t("Delete photo")}</button></div>
          </section>
        </div>
      </div>`;
    const draw = async () => { const box = U.$("#phPrev"); box.innerHTML = ""; box.appendChild(await PX.render(p, version, app.unit(c))); };
    await draw();
    U.$$("[data-ver]", el).forEach((b) => (b.onclick = async () => { version = b.dataset.ver; U.$$("[data-ver]", el).forEach((x) => x.setAttribute("aria-pressed", x === b)); await draw(); }));
    U.$("[data-edit]", el).onclick = async () => { await SM.editor.open(p, { customer: c }); app.rerender(); };
    U.$("#phSetView").onchange = async (e) => { p.view = e.target.value; await SM.db.put("photos", p); U.toast(t("Category updated")); };
    U.$("[data-del]", el).onclick = async () => {
      if (!(await U.confirm({ title: t("Delete photo?"), message: t("The photo and its annotations are removed from this device. Exported copies are not affected."), ok: t("Delete"), danger: true }))) return;
      await SM.db.del("photos", p.id); await SM.db.log("Photo deleted"); U.toast(t("Photo deleted")); app.go(c ? "#/customer/" + c.id : "#/photos");
    };
    U.$$("[data-x]", el).forEach((b) => (b.onclick = async () => {
      const fmt = U.$("#phFmt").value;
      const vers = b.dataset.x === "every" ? ["original", "outline", "grid", "lines"] : [version];
      for (const v of vers) {
        const cv = await PX.render(p, v, app.unit(c));
        let blob = await U.canvasToBlob(cv, fmt, 0.92); if (fmt === "image/webp" && blob.type !== "image/webp") blob = await U.canvasToBlob(cv, "image/jpeg", 0.92);
        const name = PX.filename(c, p, v, blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg");
        const mode = b.dataset.x === "every" ? "download" : b.dataset.x;
        const r = mode === "gallery" ? await PX.toGallery(blob, name) : mode === "share" ? await PX.share(blob, name) : await PX.download(blob, name);
        U.toast(r.message);
        if (vers.length > 1) await new Promise((res) => setTimeout(res, 600));
      }
    }));
  }

  /* choose a photo to measure a specific item on */
  async function pickForMeasure(session, measureId) {
    const entry = SM.catalog.get(measureId);
    const c = await SM.customers.get(session.customerId);
    const photos = await SM.customers.photos(session.customerId);
    const want = entry.view === "side" ? ["right", "left"] : entry.view === "back" ? ["back"] : ["front", "upper", "lower", "sleeve", "extended"];
    const sorted = photos.slice().sort((a, b) => (want.includes(b.view) ? 1 : 0) - (want.includes(a.view) ? 1 : 0));
    const sh = U.sheet({ title: t("Measure {n} on a photo", { n: SM.catalog.name(measureId) }), wide: true, html: `
      <div class="notice">${SM.icon("info")}<div>${t("Best view: {v}. Calibrate the photo (marker, A4, known length or height) before the value can be used. The result is saved as a camera reading that needs verification.", { v: t(entry.view === "side" ? "Side" : entry.view === "back" ? "Back" : "Front") })}</div></div>
      <div class="btn-row"><button class="btn primary" data-new>${SM.icon("camera")}${t("Take new photo")}</button></div>
      ${sorted.length ? `<div class="photo-grid" data-g></div>` : `<p class="muted">${t("No stored photos for this customer yet.")}</p>`}` });
    const grid = sh.el.querySelector("[data-g]");
    if (grid) sorted.forEach((p) => {
      const b = document.createElement("button"); b.className = "photo-card"; b.dataset.id = p.id;
      b.innerHTML = `<img src="${URL.createObjectURL(p.thumb || p.blob)}" alt=""><span class="cap">${viewName(p.view)}${want.includes(p.view) ? " ★" : ""} · ${U.esc(U.fmtDate(p.createdAt))}</span>`;
      grid.appendChild(b);
    });
    sh.el.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-id]");
      if (b) { sh.close(); const p = photos.find((x) => x.id === b.dataset.id); await SM.editor.open(p, { customer: c, sessionId: session.id, measureId, tool: (p.ann && p.ann.cal && p.ann.cal.result && p.ann.cal.result.valid) ? "line" : "cal" }); app.rerender(); }
      if (e.target.closest("[data-new]")) {
        sh.close();
        const view = entry.view === "side" ? "right" : entry.view === "back" ? "back" : (entry.region === "arms" ? "sleeve" : "front");
        const shots = await SM.cameraUI.open({ customerId: c.id, sessionId: session.id, view, views: [view], measureId });
        if (shots && shots[0]) { await SM.editor.open(shots[0], { customer: c, sessionId: session.id, measureId, tool: "cal" }); }
        app.rerender();
      }
    });
  }
  SM.photosView = { pickForMeasure };
})();

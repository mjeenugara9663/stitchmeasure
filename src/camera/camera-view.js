/* Live camera screen: transparent body outline + grid layers, guidance,
 * countdown, capture, review, save/export. Also handles photo import. */
(function () {
  "use strict";
  const SM = window.SM, U = SM.util, t = SM.t, app = SM.app;
  const PX = SM.photoExport;

  const GUIDE = {
    front: "Face the camera. Arms slightly away from the body, feet in the guides.",
    back: "Turn your back to the camera. Arms slightly away from the body.",
    left: "Turn so your left side faces the camera. Arms relaxed.",
    right: "Turn so your right side faces the camera. Arms relaxed.",
    upper: "Upper body in the frame, shoulders level and relaxed.",
    lower: "Waist to feet in the frame. Feet in the guides.",
    sleeve: "Arm slightly bent and away from the body, shoulder to wrist visible.",
    extended: "Arms straight out at shoulder height, palms down."
  };

  /* open the camera. opts: {customerId, sessionId, views[], view, measureId, onClose(captured[])} */
  async function open(opts) {
    opts = opts || {};
    const S = app.settings;
    const captured = [];
    const req = opts.views && opts.views.length ? opts.views : null;
    const st = {
      view: opts.view || (req ? req[0] : "front"), age: "adult",
      showOutline: true, opacity: S.overlayOpacity == null ? 0.7 : S.overlayOpacity,
      showGrid: true, density: S.gridDensity || 8, gridOpacity: S.gridOpacity == null ? 0.5 : S.gridOpacity,
      scale: 1, x: 0, y: 0, timer: S.countdown == null ? 3 : S.countdown, mirror: S.mirrorFront !== false,
      panel: false, tilt: null, tiltOn: false, info: null, running: false
    };
    let customer = opts.customerId || app.state.customerId ? await SM.customers.get(opts.customerId || app.state.customerId) : null;
    if (customer) st.age = customer.ageGroup === "child" ? "child" : "adult";

    const root = document.createElement("div");
    root.className = "cam"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", t("Camera"));
    root.innerHTML = `
      <div class="cam-top">
        <button class="icon-btn" data-close aria-label="${t("Close camera")}">${SM.icon("x")}</button>
        <div class="title" data-title></div>
        <button class="icon-btn" data-torch aria-label="${t("Torch")}" hidden>${SM.icon("bolt")}</button>
        <button class="icon-btn" data-flip aria-label="${t("Switch camera")}">${SM.icon("flip")}</button>
        <button class="icon-btn" data-panel aria-label="${t("Overlay settings")}" aria-pressed="false">${SM.icon("settings")}</button>
      </div>
      <div class="cam-guide" data-guide hidden></div>
      <div class="cam-stage-wrap" data-wrap>
        <div class="cam-stage" data-stage>
          <video data-video playsinline muted autoplay></video>
          <canvas class="cam-layer" data-grid></canvas>
          <div class="cam-outline" data-outline></div>
          <div class="countdown" data-count hidden></div>
        </div>
        <div class="cam-msg" data-msg hidden></div>
      </div>
      <div class="cam-panel" data-ppanel hidden></div>
      <div class="cam-bottom">
        <div class="cam-views" data-views></div>
        <div class="cam-actions">
          <div class="l"><button class="icon-btn" data-import aria-label="${t("Import from gallery")}">${SM.icon("image")}</button><button class="icon-btn" data-timer aria-label="${t("Countdown timer")}">${SM.icon("timer")}</button></div>
          <button class="shutter" data-shutter aria-label="${t("Capture photo")}"><span></span></button>
          <div class="r"><button class="btn sm" data-done style="background:#fff;color:#0E1B2C;border-color:#fff" hidden></button></div>
        </div>
      </div>
      <input type="file" accept="image/*" data-file hidden>`;
    document.body.appendChild(root);
    document.body.classList.add("no-scroll");
    const $ = (s) => root.querySelector(s);
    const video = $("[data-video]"), stage = $("[data-stage]"), wrap = $("[data-wrap]"), outline = $("[data-outline]"), gridC = $("[data-grid]");

    const title = () => {
      $("[data-title]").textContent = (customer ? customer.name + " · " : "") + t(SM.overlays.VIEWS[st.view].name) + (st.timer ? ` · ${st.timer}s` : "");
      $("[data-timer]").setAttribute("aria-pressed", st.timer ? "true" : "false");
    };
    const viewsBar = () => {
      const keys = req || Object.keys(SM.overlays.VIEWS);
      $("[data-views]").innerHTML = keys.map((k) => {
        const n = captured.filter((c) => c.view === k).length;
        return `<button data-v="${k}" aria-pressed="${st.view === k}">${n ? "✓ " : ""}${t(SM.overlays.VIEWS[k].name)}</button>`;
      }).join("");
      const d = $("[data-done]");
      d.hidden = !captured.length && !req;
      d.textContent = req ? t("Done") + ` (${captured.length})` : t("Done") + ` (${captured.length})`;
      d.hidden = false;
    };

    /* layout: stage keeps the video's aspect so overlays map 1:1 to the captured frame */
    let aspectCache = null;
    function layout() {
      const vw = video.videoWidth || 3, vh = video.videoHeight || 4;
      const W = wrap.clientWidth, H = wrap.clientHeight;
      const k = Math.min(W / vw, H / vh);
      stage.style.width = Math.round(vw * k) + "px"; stage.style.height = Math.round(vh * k) + "px";
      drawOverlay();
    }
    function drawOverlay() {
      const W = stage.clientWidth, H = stage.clientHeight;
      if (!aspectCache || aspectCache.key !== st.view + st.age) {
        aspectCache = { key: st.view + st.age, a: SM.overlays.aspectOf(st.view, st.age), svg: SM.overlays.outlineSVG(st.view, st.age) };
        outline.innerHTML = aspectCache.svg;
      }
      const r = SM.overlays.outlineRect(W, H, st, aspectCache.a);
      Object.assign(outline.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px", opacity: st.opacity });
      outline.hidden = !st.showOutline;
      SM.overlays.drawGrid(gridC, { show: st.showGrid, density: st.density, opacity: st.gridOpacity });
    }

    /* drag the outline to align (one finger), pinch to resize (two fingers) */
    const pointers = new Map(); let drag0 = null;
    outline.addEventListener("pointerdown", (e) => { outline.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); drag0 = { st: { x: st.x, y: st.y, scale: st.scale }, pts: new Map(pointers) }; });
    outline.addEventListener("pointermove", (e) => {
      if (!pointers.has(e.pointerId) || !drag0) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const W = stage.clientWidth, H = stage.clientHeight;
      const now = [...pointers.values()], was = [...drag0.pts.values()];
      if (now.length === 1 && was.length === 1) { st.x = drag0.st.x + (now[0].x - was[0].x) / W; st.y = drag0.st.y + (now[0].y - was[0].y) / H; }
      else if (now.length >= 2 && was.length >= 2) {
        const d1 = Math.hypot(was[0].x - was[1].x, was[0].y - was[1].y), d2 = Math.hypot(now[0].x - now[1].x, now[0].y - now[1].y);
        st.scale = U.clamp(drag0.st.scale * d2 / Math.max(10, d1), 0.4, 1.6);
      }
      drawOverlay();
    });
    const up = (e) => { pointers.delete(e.pointerId); drag0 = pointers.size ? { st: { x: st.x, y: st.y, scale: st.scale }, pts: new Map(pointers) } : null; };
    outline.addEventListener("pointerup", up); outline.addEventListener("pointercancel", up);

    function panel() {
      const p = $("[data-ppanel]"); p.hidden = !st.panel;
      $("[data-panel]").setAttribute("aria-pressed", st.panel);
      if (!st.panel) return;
      const z = st.info && st.info.zoom;
      p.innerHTML = `
        <label class="check"><input type="checkbox" data-k="showOutline" ${st.showOutline ? "checked" : ""}><span>${t("Show body outline")}</span></label>
        <label>${t("Outline transparency")} <span data-opv>${Math.round((1 - st.opacity) * 100)}%</span><input type="range" min="0" max="100" value="${Math.round((1 - st.opacity) * 100)}" data-k="opacity"></label>
        <label>${t("Reference template")}<select data-k="age"><option value="adult" ${st.age === "adult" ? "selected" : ""}>${t("Adult")}</option><option value="child" ${st.age === "child" ? "selected" : ""}>${t("Child")}</option></select></label>
        <label>${t("Camera view")}<select data-k="view">${Object.entries(SM.overlays.VIEWS).map(([k, v]) => `<option value="${k}" ${st.view === k ? "selected" : ""}>${t(v.name)}</option>`).join("")}</select></label>
        <label>${t("Outline size")} <span>${Math.round(st.scale * 100)}%</span><input type="range" min="40" max="160" value="${Math.round(st.scale * 100)}" data-k="scale"></label>
        <div class="btn-row"><button class="btn" data-act="recenter">${t("Recenter")}</button><button class="btn" data-act="reset">${t("Reset alignment")}</button></div>
        <label class="check"><input type="checkbox" data-k="showGrid" ${st.showGrid ? "checked" : ""}><span>${t("Show grid")}</span></label>
        <label>${t("Grid density")} <span>${st.density}</span><input type="range" min="3" max="24" value="${st.density}" data-k="density"></label>
        <label>${t("Grid visibility")}<input type="range" min="10" max="100" value="${Math.round(st.gridOpacity * 100)}" data-k="gridOpacity"></label>
        ${z ? `<label>${t("Zoom")} <span>${(+z.value).toFixed(1)}×</span><input type="range" min="${z.min}" max="${z.max}" step="${z.step}" value="${z.value}" data-k="zoom"></label>` : ""}
        <label class="check"><input type="checkbox" data-k="mirror" ${st.mirror ? "checked" : ""}><span>${t("Mirror front-camera preview")}</span></label>
        ${"DeviceOrientationEvent" in window ? `<label class="check"><input type="checkbox" data-k="tiltOn" ${st.tiltOn ? "checked" : ""}><span>${t("Tilt warnings (uses motion sensor)")}</span></label>` : ""}
        <p style="color:#AFBACB;font-size:12.5px">${t("Grid squares are positioning guides only. They are not centimetres: a photo has no scale until it is calibrated.")}</p>
        <p style="color:#AFBACB;font-size:12.5px">${t("Starting point for full body: about 2–3 m away, lens at waist height. Adjust until the head and feet sit between the gold lines; the right distance depends on the person's height, the lens and the room.")}</p>`;
    }
    $("[data-ppanel]").addEventListener("input", async (e) => {
      const k = e.target.dataset.k; if (!k) return;
      const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      if (k === "opacity") { st.opacity = 1 - v / 100; $("[data-opv]").textContent = v + "%"; }
      else if (k === "scale") { st.scale = v / 100; e.target.previousElementSibling.textContent = v + "%"; }
      else if (k === "density") { st.density = +v; e.target.previousElementSibling.textContent = v; }
      else if (k === "gridOpacity") st.gridOpacity = v / 100;
      else if (k === "zoom") { await SM.camera.setZoom(+v); st.info.zoom.value = +v; e.target.previousElementSibling.textContent = (+v).toFixed(1) + "×"; }
      else if (k === "mirror") { st.mirror = v; applyMirror(); }
      else if (k === "tiltOn") { if (v) await enableTilt(); else st.tiltOn = false; }
      else if (k === "view" || k === "age") { st[k] = v; aspectCache = null; title(); viewsBar(); }
      else st[k] = v;
      drawOverlay();
    });
    $("[data-ppanel]").addEventListener("click", (e) => {
      const a = e.target.closest("[data-act]"); if (!a) return;
      if (a.dataset.act === "recenter") { st.x = 0; st.y = 0; }
      if (a.dataset.act === "reset") { st.x = 0; st.y = 0; st.scale = 1; st.opacity = 0.7; panel(); }
      drawOverlay();
    });

    async function enableTilt() {
      try {
        if (typeof DeviceOrientationEvent.requestPermission === "function") {
          const r = await DeviceOrientationEvent.requestPermission();
          if (r !== "granted") { U.toast(t("Motion sensor permission was not granted. Tilt warnings are off.")); st.tiltOn = false; panel(); return; }
        }
        st.tiltOn = true;
        window.addEventListener("deviceorientation", onTilt);
      } catch (e) { st.tiltOn = false; U.toast(t("Tilt sensor unavailable on this device.")); panel(); }
    }
    function onTilt(e) { if (e.beta != null) st.tilt = { beta: e.beta, gamma: e.gamma }; }

    function applyMirror() { video.classList.toggle("mirror", st.mirror && SM.camera.facing === "user"); }

    /* live guidance */
    let guideTimer = null;
    function guide() {
      const g = $("[data-guide]");
      if (!SM.camera.active) { g.hidden = true; return; }
      let msg = t(GUIDE[st.view] || ""), sub = t("Manual alignment: AI body detection is not installed in this version."), cls = "";
      const full = ["front", "back", "left", "right", "extended"].includes(st.view);
      const a = SM.camera.analyse(video);
      const tiltBad = st.tiltOn && st.tilt && (Math.abs(st.tilt.beta - 90) > 8 || Math.abs(st.tilt.gamma) > 6);
      if (full && video.videoWidth > video.videoHeight && st.view !== "extended") { msg = t("Keep your phone upright (portrait) for full-body photos."); cls = "warn"; }
      else if (tiltBad) { msg = Math.abs(st.tilt.gamma) > 6 ? t("Level the phone: it is tilted sideways.") : st.tilt.beta < 82 ? t("Tilt the top of the phone back. Keep it upright.") : t("Tilt the top of the phone forward. Keep it upright."); sub = t("Tilt makes the body look shorter or longer."); cls = "warn"; }
      else if (a && a.brightness < 55) { msg = t("Improve the lighting. The picture is too dark."); cls = "warn"; }
      else if (a && a.brightness > 225) { msg = t("Too bright or backlit. Avoid standing in front of a window."); cls = "warn"; }
      else if (a && a.motion > 14) { msg = t("Please stand still."); cls = "warn"; }
      else if (full) { sub = t("Head at the top gold line, feet in the foot guides, whole body visible. Move the phone back if anything is cut off."); cls = "ok"; }
      g.className = "cam-guide " + cls; g.hidden = false;
      g.innerHTML = `<span>${U.esc(msg)}</span><small>${U.esc(sub)}</small>`;
    }

    function message(html) { const m = $("[data-msg]"); m.hidden = !html; m.innerHTML = html ? `<div class="box">${html}</div>` : ""; }

    async function startCam(facing) {
      message("");
      try {
        st.info = await SM.camera.start(video, facing ? { facing } : {});
        $("[data-torch]").hidden = !st.info.torch;
        $("[data-flip]").hidden = st.info.cameras < 2;
        applyMirror(); layout(); panel();
        clearInterval(guideTimer); guideTimer = setInterval(guide, 450);
        await SM.settings.set("cameraConsent", true);
      } catch (e) {
        stage.style.width = "0px";
        message(`${SM.icon("camera", "")}<p style="font-weight:600;font-size:17px">${U.esc(e.message)}</p>
          <div class="btn-row" style="justify-content:center"><button class="btn" data-msgimport>${SM.icon("image")}${t("Import photo")}</button>${SM.camera.support().ok ? `<button class="btn ghost" data-retry>${t("Try again")}</button>` : ""}</div>
          <p style="color:#AFBACB;font-size:13.5px">${t("You can always enter measurements manually with a tape.")}</p>`);
        const mi = root.querySelector("[data-msgimport]"); if (mi) mi.onclick = () => $("[data-file]").click();
        const rt = root.querySelector("[data-retry]"); if (rt) rt.onclick = () => startCam();
      }
    }

    /* camera permission explanation, shown once */
    async function explainFirst() {
      if (S.cameraConsent || !SM.camera.support().ok) return true;
      return new Promise((resolve) => {
        message(`${SM.icon("shield")}<p style="font-weight:600;font-size:18px">${t("Camera access")}</p>
          <p style="color:#C4CDDB">${t("StitchMeasure uses the camera only while this screen is open. Photos are processed on this device and are stored only if you save them to a customer. Nothing is uploaded.")}</p>
          <div class="btn-row" style="justify-content:center"><button class="btn" data-allow>${t("Continue")}</button><button class="btn ghost" data-msgimport>${t("Import a photo instead")}</button></div>`);
        root.querySelector("[data-allow]").onclick = () => { message(""); resolve(true); };
        root.querySelector("[data-msgimport]").onclick = () => { message(""); resolve(false); $("[data-file]").click(); };
      });
    }

    /* capture */
    let busy = false;
    async function shoot() {
      if (busy || !SM.camera.active) return;
      busy = true;
      try {
        for (let n = st.timer; n > 0; n--) { const c = $("[data-count]"); c.hidden = false; c.textContent = n; if (navigator.vibrate) navigator.vibrate(30); await new Promise((r) => setTimeout(r, 1000)); }
        $("[data-count]").hidden = true;
        const frame = SM.camera.capture(video, false);
        const mirroredPreview = st.mirror && SM.camera.facing === "user";
        const overlay = { view: st.view, age: st.age, scale: st.scale, x: mirroredPreview ? -st.x : st.x, y: st.y, opacity: st.opacity };
        await review(frame, { source: "camera", overlay, device: { facing: SM.camera.facing, label: st.info && st.info.label, w: frame.width, h: frame.height } });
      } catch (e) { U.toast(e.message, "err"); }
      finally { busy = false; $("[data-count]").hidden = true; }
    }

    async function importFile(file) {
      if (!file) return;
      try {
        const img = await SM.util.blobToImage(file);
        const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext("2d").drawImage(img, 0, 0);
        await review(c, { source: "import", overlay: { view: st.view, age: st.age, scale: st.scale, x: st.x, y: st.y, opacity: st.opacity }, device: null });
      } catch (e) { U.toast(t("That file could not be opened as an image."), "err"); }
    }

    /* review: preview versions, then save / export / retake / discard */
    function review(frame, meta) {
      return new Promise(async (resolve) => {
        const { blob, w, h } = await PX.compress(frame);
        const thumb = await PX.makeThumb(frame);
        const photo = {
          schema: "stitchmeasure.photo/1", id: U.uid("pho"), customerId: customer ? customer.id : null, sessionId: opts.sessionId || null,
          view: st.view, measureId: opts.measureId || null, garmentId: null, blob, thumb, w, h, overlay: meta.overlay,
          ann: { grid: { show: false, density: st.density, opacity: st.gridOpacity }, points: [], lines: [], cal: null, crop: null, rotation: 0 },
          source: meta.source, device: meta.device, createdAt: new Date().toISOString()
        };
        let version = "original", saved = false;
        const s = U.sheet({ title: t("Review photo"), wide: true, html: `
          <div class="review-img" data-prev></div>
          <div class="seg" role="group" aria-label="${t("Version")}">${Object.entries({ original: "Original", outline: "Outline", grid: "Grid", all: "All layers" }).map(([k, n]) => `<button data-ver="${k}" aria-pressed="${k === version}">${t(n)}</button>`).join("")}</div>
          <div data-consent></div>
          <div class="btn-row">
            <button class="btn primary" data-a="save">${SM.icon("check")}${t("Save to customer")}</button>
            <button class="btn" data-a="gallery">${SM.icon("image")}${t("Save to Gallery / Photos")}</button>
            <button class="btn" data-a="download">${SM.icon("download")}${t("Download photo")}</button>
            <button class="btn" data-a="share">${SM.icon("share")}${t("Share photo")}</button>
          </div>
          <div class="btn-row">
            <button class="btn" data-a="edit">${SM.icon("ruler")}${t("Annotate & calibrate")}</button>
            <button class="btn ghost" data-a="retake">${SM.icon("camera")}${t("Retake photo")}</button>
            <button class="btn ghost danger" data-a="delete" style="border-color:transparent">${SM.icon("trash")}${t("Delete photo")}</button>
          </div>
          <p class="muted small">${U.esc(PX.galleryHelp())} ${t("“Lines” versions are created in the editor after you add measurement lines.")}</p>
          <label class="field">${t("Format for export")}<select data-fmt><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select></label>`,
          onClose: () => resolve(saved ? photo : null)
        });
        const prev = s.el.querySelector("[data-prev]");
        const drawPrev = async () => { prev.innerHTML = ""; const c = await PX.render(photo, version, app.unit(customer)); prev.appendChild(c); };
        const consentBox = () => {
          const box = s.el.querySelector("[data-consent]");
          if (!customer) { box.innerHTML = `<div class="notice">${SM.icon("info")}<div>${t("No customer selected. “Save to customer” will ask which customer.")}</div></div>`; return; }
          if (!app.settings.keepPhotos) { box.innerHTML = `<div class="notice">${SM.icon("shield")}<div>${t("Photo storage is switched off in Settings (analyse without keeping). You can still annotate and export.")}</div></div>`; return; }
          if (!customer.consent.photos) box.innerHTML = `<div class="notice warn">${SM.icon("shield")}<div>${t("{n} has no photo consent recorded.", { n: U.esc(customer.name) })}<label class="check" style="margin-top:8px"><input type="checkbox" data-grant><span>${customer.ageGroup === "child" ? t("The guardian has consented to storing this child's photos.") : t("The customer consents to storing this photo.")}</span></label></div></div>`;
          else box.innerHTML = `<p class="muted small">${t("Will be saved to")} <b>${U.esc(customer.name)}</b> · ${t(SM.overlays.VIEWS[photo.view].name)}</p>`;
        };
        await drawPrev(); consentBox();
        s.el.querySelectorAll("[data-ver]").forEach((b) => (b.onclick = async () => { version = b.dataset.ver; s.el.querySelectorAll("[data-ver]").forEach((x) => x.setAttribute("aria-pressed", x === b)); await drawPrev(); }));
        const exportBlob = async () => {
          const fmt = s.el.querySelector("[data-fmt]").value;
          const c = await PX.render(photo, version, app.unit(customer));
          let b = await U.canvasToBlob(c, fmt, 0.92);
          if (fmt === "image/webp" && b.type !== "image/webp") b = await U.canvasToBlob(c, "image/jpeg", 0.92); // WebP unsupported → JPEG
          const ext = b.type === "image/png" ? "png" : b.type === "image/webp" ? "webp" : "jpg";
          return { b, name: PX.filename(customer, photo, version, ext) };
        };
        s.el.addEventListener("click", async (e) => {
          const a = e.target.closest("[data-a]"); if (!a) return;
          const act = a.dataset.a;
          if (act === "save") {
            if (!customer) { const c = await app.pickCustomer({ title: t("Save photo to…") }); if (!c) return; customer = c; photo.customerId = c.id; app.state.customerId = c.id; title(); consentBox(); }
            if (!app.settings.keepPhotos) { U.toast(t("Photo storage is off in Settings."), "err"); return; }
            if (!customer.consent.photos) {
              const g = s.el.querySelector("[data-grant]");
              if (!g || !g.checked) { U.toast(t("Record consent first, or use Download/Share without storing."), "err"); return; }
              customer.consent.photos = true;
              if (customer.ageGroup === "child") customer.consent.guardian = Object.assign({ name: customer.consent.guardian.name || t("Recorded at capture") }, customer.consent.guardian, { given: true });
              await SM.customers.save(customer);
            }
            try {
              await SM.db.put("photos", photo); saved = true; captured.push(photo); viewsBar();
              await SM.db.log(`Photo saved: ${customer.name} · ${SM.overlays.VIEWS[photo.view].name}`, photo.id);
              U.toast(t("Saved to {n} on this device.", { n: customer.name }));
              s.close();
              if (req) { const next = req.find((k) => !captured.some((c) => c.view === k)); if (next) { st.view = next; aspectCache = null; title(); viewsBar(); drawOverlay(); } }
            } catch (err) { U.toast(t("Could not save: ") + err.message + " " + t("The device may be out of storage."), "err"); }
          } else if (act === "gallery") { const x = await exportBlob(); const r = await PX.toGallery(x.b, x.name); U.toast(r.message); }
          else if (act === "download") { const x = await exportBlob(); const r = await PX.download(x.b, x.name); U.toast(r.message); }
          else if (act === "share") { const x = await exportBlob(); const r = await PX.share(x.b, x.name); U.toast(r.message, r.done ? "" : "err"); }
          else if (act === "retake" || act === "delete") { s.close(); if (act === "delete") U.toast(t("Photo discarded. Nothing was stored.")); }
          else if (act === "edit") {
            s.root.hidden = true;
            await SM.editor.open(photo, { customer, temporary: !saved, onSaveToCustomer: async () => { s.root.hidden = false; } });
            s.root.hidden = false; await drawPrev();
          }
        });
      });
    }

    /* wiring */
    $("[data-close]").onclick = () => close();
    $("[data-flip]").onclick = async () => { st.info = await SM.camera.flip(video).catch((e) => { U.toast(e.message, "err"); return st.info; }); applyMirror(); layout(); };
    $("[data-torch]").onclick = async (e) => { const on = e.currentTarget.getAttribute("aria-pressed") !== "true"; const ok = await SM.camera.setTorch(on); if (ok) e.currentTarget.setAttribute("aria-pressed", on); else U.toast(t("Torch is not available on this camera.")); };
    $("[data-panel]").onclick = () => { st.panel = !st.panel; panel(); };
    $("[data-timer]").onclick = () => { const seq = [0, 3, 5, 10]; st.timer = seq[(seq.indexOf(st.timer) + 1) % seq.length]; SM.settings.set("countdown", st.timer); title(); U.toast(st.timer ? t("Countdown {n} seconds", { n: st.timer }) : t("Countdown off")); };
    $("[data-shutter]").onclick = shoot;
    $("[data-import]").onclick = () => $("[data-file]").click();
    $("[data-file]").onchange = (e) => { const f = e.target.files[0]; e.target.value = ""; importFile(f); };
    $("[data-views]").onclick = (e) => { const b = e.target.closest("[data-v]"); if (!b) return; st.view = b.dataset.v; aspectCache = null; title(); viewsBar(); drawOverlay(); panel(); };
    $("[data-done]").onclick = () => close();
    const onResize = () => layout();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    video.addEventListener("loadedmetadata", layout);
    root.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); if (e.key === " " && e.target === document.body) shoot(); });

    let closed = false, resolveClose;
    const done = new Promise((r) => (resolveClose = r));
    function close() {
      if (closed) return; closed = true;
      clearInterval(guideTimer); SM.camera.stop();
      window.removeEventListener("resize", onResize); window.removeEventListener("orientationchange", onResize); window.removeEventListener("deviceorientation", onTilt);
      root.remove(); if (!document.querySelector(".sheet-wrap")) document.body.classList.remove("no-scroll");
      if (opts.onClose) opts.onClose(captured);
      resolveClose(captured);
    }

    title(); viewsBar();
    if (await explainFirst()) await startCam();
    return done;
  }

  SM.cameraUI = { open };

  /* route: #/camera opens the camera for the selected customer; closing returns to the previous screen */
  SM.views.camera = async function (el) {
    el.innerHTML = `<div class="empty">${SM.icon("camera")}<p>${t("Camera closed.")}</p><a class="btn" href="#/">${t("Dashboard")}</a></div>`;
    const back = app.state.customerId ? "#/customer/" + app.state.customerId : "#/";
    await open({ customerId: app.state.customerId });
    if (location.hash === "#/camera") app.go(back);
  };
})();

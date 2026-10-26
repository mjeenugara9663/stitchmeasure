/* 12-step guided scanning workflow. State survives reloads (stored locally). */
(function () {
  "use strict";
  const SM = window.SM, U = SM.util, t = SM.t, app = SM.app, E = SM.engine;

  const STEPS = ["Select customer", "Measurement type", "Reference pose", "Calibration", "Position camera", "Check positioning", "Capture photos", "Review photos", "Calculate", "Verify values", "Save record", "Export"];
  const TYPES = {
    full: { name: "Full body", views: ["front", "right", "back"], tpl: "u_body_basic", desc: "Front, side and back photos" },
    upper: { name: "Upper body", views: ["upper", "back"], tpl: "w_western_top", desc: "Chest, waist, shoulders" },
    lower: { name: "Lower body", views: ["lower", "right"], tpl: "m_trousers", desc: "Waist to feet" },
    arms: { name: "Arms", views: ["sleeve", "extended"], tpl: "u_body_basic", desc: "Arm lengths, span" },
    sleeves: { name: "Sleeves", views: ["sleeve"], tpl: "u_body_basic", desc: "Shoulder to wrist" },
    garment: { name: "Garment-specific", views: null, tpl: null, desc: "Views from the garment checklist" }
  };
  const POSE_FOR = { front: "fullFront", back: "fullBack", right: "fullRight", left: "fullLeft", upper: "upperFront", lower: "inseam", sleeve: "sleeve", extended: "armExtended" };

  let W = null;
  async function load() { W = await SM.db.setting("wizard", null); return W; }
  async function persist() { await SM.db.setSetting("wizard", W); }

  async function start(o) {
    o = o || {};
    W = { step: o.customerId ? 1 : 0, customerId: o.customerId || null, sessionId: o.sessionId || null, type: null, templateId: null, cal: "height", checks: {}, photoIds: [] };
    if (o.sessionId) { const s = await SM.db.get("sessions", o.sessionId); if (s) { W.templateId = s.templateId; } }
    await persist();
    app.go("#/scan");
  }

  async function viewsFor() {
    if (W.type && TYPES[W.type].views) return TYPES[W.type].views;
    const tpl = await app.resolveTemplate(W.templateId);
    const v = new Set();
    SM.templates.items(tpl).forEach((id) => { const e = SM.catalog.get(id); if (e) v.add(e.view === "side" ? "right" : e.view); });
    return v.size ? Array.from(v) : ["front"];
  }

  SM.views.scan = async function (el) {
    await load();
    if (!W) { W = { step: 0, customerId: app.state.customerId || null, sessionId: null, type: null, templateId: null, cal: "height", checks: {}, photoIds: [] }; if (W.customerId) W.step = 1; await persist(); }
    const c = W.customerId ? await SM.customers.get(W.customerId) : null;
    if (!c && W.step > 0) W.step = 0;
    if (c) app.state.customerId = c.id;
    const views = W.step >= 2 ? await viewsFor() : [];
    const photos = c ? (await SM.customers.photos(c.id)).filter((p) => W.photoIds.includes(p.id)) : [];
    const unit = app.unit(c);
    const n = W.step;

    const bar = `<div class="wiz-progress"><div class="wiz-bar">${STEPS.map((_, i) => `<span class="${i < n ? "done" : i === n ? "on" : ""}"></span>`).join("")}</div>
      <div class="wiz-step-name"><span>${t("Step {a} of 12", { a: n + 1 })} · ${t(STEPS[n])}</span>${c ? `<span>${U.esc(c.name)}</span>` : ""}</div></div>`;
    let body = "", nextLabel = t("Continue"), canNext = true;

    if (n === 0) {
      body = `<h2>${t("Who are you measuring?")}</h2><p class="lead">${t("Create a profile or choose a saved one.")}</p>
        <div class="tiles"><button class="tile" data-pick>${SM.icon("users")}<span>${t("Choose saved customer")}</span></button><a class="tile" href="#/new-customer/scan">${SM.icon("userPlus")}<span>${t("New customer")}</span></a></div>`;
      canNext = false;
    } else if (n === 1) {
      const templates = await app.templatesAll();
      body = `<h2>${t("What do you want to measure?")}</h2>
        <div class="choice-grid">${Object.entries(TYPES).map(([k, ty]) => `<button class="choice" data-type="${k}" aria-pressed="${W.type === k}"><b>${t(ty.name)}</b><small>${t(ty.desc)}</small></button>`).join("")}</div>
        ${W.type === "garment" ? `<label class="field">${t("Garment")}<select id="wTpl"><option value="">${t("Choose…")}</option>${SM.templates.GROUPS.map((g) => { const l = templates.filter((x) => x.group === g); return l.length ? `<optgroup label="${t(g)}">${l.map((x) => `<option value="${x.id}" ${W.templateId === x.id ? "selected" : ""}>${U.esc(x.name)}</option>`).join("")}</optgroup>` : ""; }).join("")}</select></label>` : ""}`;
      canNext = !!W.type && (W.type !== "garment" || !!W.templateId);
    } else if (n === 2) {
      body = `<h2>${t("Show the customer the pose")}</h2><p class="lead">${t("You will take {k} photo(s): {v}.", { k: views.length, v: views.map((v) => t(SM.overlays.VIEWS[v].name)).join(", ") })}</p>
        <div class="grid-2">${views.map((v) => { const p = SM.catalog.POSES[POSE_FOR[v]]; return `<section class="card stack-sm"><div class="ref-fig">${SM.figure.forPose(POSE_FOR[v], c && c.ageGroup === "child" ? "child" : "adult")}</div><h2>${t(SM.overlays.VIEWS[v].name)}</h2>
          <dl class="kv"><dt>${t("Camera")}</dt><dd>${t(p.camera)}</dd><dt>${t("Posture")}</dt><dd>${t(p.posture)}</dd><dt>${t("Hands & feet")}</dt><dd>${t(p.limbs)}</dd></dl>
          <div class="notice warn">${SM.icon("warn")}<div><b>${t("Avoid")}</b>: ${p.mistakes.map((m) => t(m)).join("; ")}.</div></div>
          ${"speechSynthesis" in window ? `<button class="btn sm" data-speak="${POSE_FOR[v]}">${t("Read aloud")}</button>` : ""}</section>`; }).join("")}</div>`;
    } else if (n === 3) {
      const opts = [["height", "Known height", c && c.heightCm ? t("Uses {h}. Vertical lengths only.", { h: E.format(c.heightCm, unit) + " " + E.unitLabel(unit) }) : t("Enter the customer's height first.")], ["a4", "A4 sheet", t("Held flat against the body at measurement level.")], ["marker", "Printed marker", t("Most reliable. Print at 100 %.")], ["known", "Known-length object", t("Ruler or rigid stick held flat.")], ["none", "No calibration", t("Photos for reference only; enter values by tape.")], ["depth", "Depth sensor", t("Not available in the web version.")]];
      body = `<h2>${t("How will the photos be scaled?")}</h2><p class="lead">${t("A photo has no size information. Without calibration the app shows pixels only and you enter measurements by tape.")}</p>
        <div class="choice-grid">${opts.map(([k, name, d]) => `<button class="choice" data-cal="${k}" aria-pressed="${W.cal === k}" ${k === "depth" ? "disabled style=\"opacity:.5\"" : ""}><b>${t(name)}</b><small>${d}</small></button>`).join("")}</div>
        ${W.cal === "height" && c && !c.heightCm ? `<label class="field">${t("Standing height")} (${unit})<input type="number" step="any" id="wH"></label>` : ""}
        ${W.cal !== "none" ? `<div class="notice">${SM.icon("info")}<div>${t(SM.calibration.METHODS[W.cal] ? SM.calibration.METHODS[W.cal].hint : "")}</div></div>` : ""}`;
      canNext = W.cal !== "height" || !!(c && c.heightCm);
    } else if (n === 4) {
      body = `<h2>${t("Set up the camera")}</h2>
        <div class="grid-2"><div class="stack-sm">
          <div class="notice">${SM.icon("camera")}<div><ul style="margin:0">
            <li>${t("Hold or mount the phone upright (portrait), not tilted up or down.")}</li>
            <li>${t("Lens at about the person's waist height for full-body photos; chest height for upper body; knee height for lower body.")}</li>
            <li>${t("Starting distance about 2–3 m for full body. Then adjust until the head and feet sit between the gold lines of the outline. The right distance depends on the person's height, the lens and the room.")}</li>
            <li>${t("Plain wall behind, even light from the front, no window behind the person.")}</li>
            <li>${t("Fitted clothing, hair tied up, no shoes (unless measuring garment length with shoes).")}</li>
            ${W.cal === "a4" || W.cal === "marker" || W.cal === "known" ? `<li>${t("Have the reference ready and hold it flat against the body at the level to measure.")}</li>` : ""}
          </ul></div></div></div>
          <div class="ref-fig">${SM.figure.svg({ view: "front", markers: true, age: c && c.ageGroup === "child" ? "child" : "adult" })}</div></div>`;
    } else if (n === 5) {
      const items = [["visible", "The whole body (or the required part) fits in the frame"], ["upright", "The phone is upright and level"], ["light", "Lighting is even and bright enough"], ["clothes", "Clothing is fitted and does not hide the body line"], ["still", "The customer can stand still in the pose"], ["consent", "The customer (or guardian) agrees to the photos"]];
      body = `<h2>${t("Check before capturing")}</h2><p class="lead">${t("The camera screen also checks lighting, movement and tilt (if allowed) while you shoot.")}</p>
        <div class="stack-sm">${items.map(([k, s]) => `<label class="check"><input type="checkbox" data-chk="${k}" ${W.checks[k] ? "checked" : ""}><span>${t(s)}</span></label>`).join("")}</div>`;
      canNext = items.every(([k]) => W.checks[k]);
    } else if (n === 6) {
      body = `<h2>${t("Capture the photos")}</h2>
        <div class="photo-grid" data-req>${views.map((v) => { const p = photos.find((x) => x.view === v); return p ? `<div class="photo-card" data-pid="${p.id}"><img alt="" data-src="${p.id}"><span class="cap">✓ ${t(SM.overlays.VIEWS[v].name)}</span></div>` : `<button class="photo-card need" data-shoot="${v}">${SM.icon("camera")}<br>${t(SM.overlays.VIEWS[v].name)}</button>`; }).join("")}</div>
        <div class="btn-row"><button class="btn primary" data-open>${SM.icon("camera")}${t("Open camera")}</button><label class="btn">${SM.icon("image")}${t("Import photos")}<input type="file" accept="image/*" multiple hidden data-imp></label></div>
        ${c && !c.consent.photos ? `<div class="notice warn">${SM.icon("shield")}<div>${t("Photo consent is not recorded for this customer. You will be asked to confirm it before a photo is stored.")}</div></div>` : ""}
        ${!app.settings.keepPhotos ? `<div class="notice">${SM.icon("shield")}<div>${t("Photo storage is off (Settings). Photos can be analysed in the editor but are not kept, so this guided flow cannot store them.")}</div></div>` : ""}`;
      canNext = photos.length > 0;
      nextLabel = photos.length < views.length ? t("Continue with {a} of {b}", { a: photos.length, b: views.length }) : t("Continue");
    } else if (n === 7) {
      body = `<h2>${t("Review photos")}</h2><p class="lead">${t("Open each photo to check it, place landmark points and calibrate it. Retake any photo that is blurred, tilted or cut off.")}</p>
        <div class="list">${photos.map((p) => { const cal = p.ann && p.ann.cal && p.ann.cal.result; return `<div class="list-item" style="cursor:default"><span class="avatar"><img alt="" data-src="${p.id}"></span><span class="main"><span class="t">${t(SM.overlays.VIEWS[p.view] ? SM.overlays.VIEWS[p.view].name : "Photo")}</span><span class="s">${cal ? (cal.valid ? t("Calibrated") : t("Calibration rejected")) : W.cal === "none" ? t("Reference only") : t("Not calibrated yet")} · ${(p.ann && p.ann.points || []).length} ${t("points")}</span></span>
          <button class="btn sm" data-edit="${p.id}">${t("Open")}</button><button class="btn sm ghost" data-retake="${p.view}" data-old="${p.id}">${t("Retake")}</button></div>`; }).join("")}</div>`;
    } else if (n === 8) {
      const s = await ensureSession(c);
      const tpl = await app.resolveTemplate(s.templateId);
      const camIds = app.sessionIds(s, tpl).filter((id) => SM.catalog.get(id) && SM.catalog.get(id).camera);
      body = `<h2>${t("Calculate supported measurements")}</h2>
        <p class="lead">${W.cal === "none" ? t("No calibration was chosen, so no physical values can be calculated from the photos. Enter values by tape in the next step.") : t("Only straight lengths in the photo plane can be calculated, and only from a calibrated photo. Draw the line in the editor and tap “Use”.")}</p>
        ${W.cal !== "none" ? `<div class="list">${camIds.map((id) => { const it = s.items[id]; const camR = it && it.readings.filter((r) => r.method === "camera"); return `<div class="list-item" style="cursor:default"><span class="main"><span class="t">${U.esc(SM.catalog.name(id))}</span><span class="s">${camR && camR.length ? t("Camera reading") + ": " + E.format(camR[camR.length - 1].v, unit, id) + " " + E.unitLabel(unit, id) : t("Not measured on a photo yet")}</span></span><button class="btn sm" data-mphoto="${id}">${SM.icon("ruler")}${t("Measure")}</button></div>`; }).join("") || `<p class="muted">${t("This checklist has no photo-measurable items.")}</p>`}</div>` : ""}
        <div class="notice">${SM.icon("info")}<div>${t("Circumferences (chest, waist, hip, etc.) are never calculated from photos. They are entered with a tape in the next step.")}</div></div>`;
    } else if (n === 9) {
      const s = await ensureSession(c);
      const tpl = await app.resolveTemplate(s.templateId);
      const ids = app.sessionIds(s, tpl);
      const todo = ids.filter((id) => { const it = s.items[id]; return !it || it.value == null; });
      const verify = ids.filter((id) => { const it = s.items[id]; return it && it.value != null && !it.verified && E.needsVerification(it, SM.catalog.get(id)); });
      body = `<h2>${t("Verify with a tape")}</h2>
        <div class="kpis"><div class="kpi ${verify.length ? "attn" : ""}"><b>${verify.length}</b><span>${t("need tape check")}</span></div><div class="kpi"><b>${todo.length}</b><span>${t("still empty")}</span></div></div>
        ${verify.length ? `<div class="list">${verify.map((id) => `<div class="list-item" style="cursor:default"><span class="main"><span class="t">${U.esc(app.itemName(id, s, tpl))}</span><span class="s">${t("Camera value")} ${E.format(s.items[id].value, unit, id)} ${E.unitLabel(unit, id)}</span></span><input type="number" step="any" inputmode="decimal" placeholder="${t("Tape")}" style="width:96px" data-tape="${id}"><button class="btn sm primary" data-vok="${id}">${t("Verify")}</button></div>`).join("")}</div>` : `<p class="muted">${t("No camera values are waiting for verification.")}</p>`}
        <a class="btn" href="#/session/${s.id}">${SM.icon("edit")}${t("Open full measurement record")}</a>`;
    } else if (n === 10) {
      const s = await ensureSession(c);
      const tpl = await app.resolveTemplate(s.templateId);
      const sum = E.summary(s, app.sessionIds(s, tpl));
      body = `<h2>${t("Save the record")}</h2>
        <div class="notice ok">${SM.icon("check")}<div>${t("Values are saved on this device automatically as you enter them. {a} of {b} recorded, {v} verified.", { a: sum.done, b: sum.total, v: sum.verified })}</div></div>
        <label class="field">${t("Tailor remarks")}<textarea id="wRemarks">${U.esc(s.remarks)}</textarea></label>`;
      nextLabel = t("Save and continue");
    } else if (n === 11) {
      const s = await ensureSession(c);
      body = `<h2>${t("Export")}</h2><p class="lead">${t("Create the measurement sheet, or save the photos to the phone.")}</p>
        <div class="tiles"><a class="tile" href="#/report/${s.id}">${SM.icon("report")}<span>${t("Measurement report")}<small>PDF · CSV · JSON · ${t("Print")}</small></span></a>
        <a class="tile" href="#/customer/${c.id}">${SM.icon("image")}<span>${t("Photos")}<small>${t("Gallery / Photos, download, share")}</small></span></a>
        <a class="tile" href="#/settings#backup">${SM.icon("download")}<span>${t("Back up")}<small>${t("Keep a copy off the device")}</small></span></a></div>`;
      nextLabel = t("Finish");
    }

    el.innerHTML = app.head({ eyebrow: t("Body scanner"), title: t("Guided measurement") }) + bar + `<section class="card pad-lg stack">${body}</section>
      <div class="btn-row between" style="margin-top:14px;justify-content:space-between"><button class="btn" data-back ${n === 0 ? "disabled" : ""}>${SM.icon("back")}${t("Back")}</button>${n > 0 ? `<button class="btn primary" data-next ${canNext ? "" : "disabled"}>${nextLabel} ${SM.icon("chevron")}</button>` : ""}</div>
      <p class="muted small" style="margin-top:10px"><button class="btn sm ghost" data-reset>${t("Start over")}</button></p>`;

    // thumbnails
    U.$$("img[data-src]", el).forEach((im) => { const p = photos.find((x) => x.id === im.dataset.src); if (p) im.src = URL.createObjectURL(p.thumb || p.blob); });

    const go = async (k) => { W.step = U.clamp(k, 0, 11); await persist(); app.rerender(); };
    U.$("[data-back]", el).onclick = () => go(n - 1);
    U.$("[data-reset]", el).onclick = async () => { W = null; await SM.db.setSetting("wizard", null); app.rerender(); };
    const nx = U.$("[data-next]", el);
    if (nx) nx.onclick = async () => {
      if (n === 3) { const h = U.$("#wH"); if (h && h.value) { c.heightCm = E.parse(h.value, unit); await SM.customers.save(c); } }
      if (n === 10) { const s = await ensureSession(c); s.remarks = U.$("#wRemarks").value; await app.saveSession(s); await SM.db.log("Guided measurement saved for " + c.name, s.id); }
      if (n === 11) { const sid = W.sessionId; W = null; await SM.db.setSetting("wizard", null); U.toast(t("Guided measurement finished.")); app.go("#/session/" + sid); return; }
      go(n + 1);
    };
    const pick = U.$("[data-pick]", el);
    if (pick) pick.onclick = async () => { const cc = await app.pickCustomer({ returnTo: "scan" }); if (cc) { W.customerId = cc.id; go(1); } };
    U.$$("[data-type]", el).forEach((b) => (b.onclick = async () => { W.type = b.dataset.type; if (W.type !== "garment") W.templateId = W.templateId || (c && c.garment) || TYPES[W.type].tpl; await persist(); app.rerender(); }));
    const wt = U.$("#wTpl", el); if (wt) wt.onchange = async (e) => { W.templateId = e.target.value; await persist(); app.rerender(); };
    U.$$("[data-speak]", el).forEach((b) => (b.onclick = () => SM.bodymap.speakPose(b.dataset.speak)));
    U.$$("[data-cal]", el).forEach((b) => (b.onclick = async () => { W.cal = b.dataset.cal; await persist(); app.rerender(); }));
    const wh = U.$("#wH", el); if (wh) wh.oninput = () => { nx.disabled = !wh.value; };
    U.$$("[data-chk]", el).forEach((b) => (b.onchange = async () => { W.checks[b.dataset.chk] = b.checked; await persist(); nx.disabled = !["visible", "upright", "light", "clothes", "still", "consent"].every((k) => W.checks[k]); }));
    const shoot = async (only) => {
      const s = await ensureSession(c);
      const remaining = views.filter((v) => !photos.some((p) => p.view === v));
      const shots = await SM.cameraUI.open({ customerId: c.id, sessionId: s.id, views: only ? [only] : (remaining.length ? remaining : views), view: only || remaining[0] });
      if (shots && shots.length) { W.photoIds = W.photoIds.concat(shots.map((p) => p.id)); await persist(); }
      app.rerender();
    };
    const op = U.$("[data-open]", el); if (op) op.onclick = () => shoot();
    U.$$("[data-shoot]", el).forEach((b) => (b.onclick = () => shoot(b.dataset.shoot)));
    const imp = U.$("[data-imp]", el);
    if (imp) imp.onchange = async (e) => {
      const s = await ensureSession(c);
      if (!app.settings.keepPhotos) { U.toast(t("Photo storage is off in Settings."), "err"); return; }
      if (!c.consent.photos) { const ok = await U.confirm({ title: t("Photo consent"), message: c.ageGroup === "child" ? t("Confirm the guardian consents to storing these photos.") : t("Confirm the customer consents to storing these photos."), ok: t("Consent given") }); if (!ok) return; c.consent.photos = true; if (c.ageGroup === "child") c.consent.guardian.given = true; await SM.customers.save(c); }
      const remaining = views.filter((v) => !photos.some((p) => p.view === v));
      let i = 0;
      for (const f of e.target.files) {
        try {
          const img = await U.blobToImage(f); const cv = document.createElement("canvas"); cv.width = img.naturalWidth; cv.height = img.naturalHeight; cv.getContext("2d").drawImage(img, 0, 0);
          const { blob, w, h } = await SM.photoExport.compress(cv); const thumb = await SM.photoExport.makeThumb(cv);
          const view = remaining[i++] || views[0];
          const p = { schema: "stitchmeasure.photo/1", id: U.uid("pho"), customerId: c.id, sessionId: s.id, view, blob, thumb, w, h, overlay: { view, age: c.ageGroup === "child" ? "child" : "adult", scale: 1, x: 0, y: 0, opacity: 0.7 }, ann: { grid: { show: false, density: 8, opacity: 0.5 }, points: [], lines: [], cal: null, crop: null, rotation: 0 }, source: "import", createdAt: new Date().toISOString() };
          await SM.db.put("photos", p); W.photoIds.push(p.id);
        } catch (err) { U.toast(t("Skipped a file that is not an image."), "err"); }
      }
      await persist(); U.toast(t("Imported. Check each photo's view in the review step.")); app.rerender();
    };
    U.$$("[data-edit]", el).forEach((b) => (b.onclick = async () => { const p = photos.find((x) => x.id === b.dataset.edit); await SM.editor.open(p, { customer: c, sessionId: W.sessionId, calMethod: W.cal !== "none" ? W.cal : undefined, tool: W.cal !== "none" ? "cal" : "point" }); app.rerender(); }));
    U.$$("[data-retake]", el).forEach((b) => (b.onclick = async () => {
      const s = await ensureSession(c);
      const shots = await SM.cameraUI.open({ customerId: c.id, sessionId: s.id, views: [b.dataset.retake], view: b.dataset.retake });
      if (shots && shots.length) {
        if (await U.confirm({ title: t("Replace the old photo?"), message: t("Delete the previous photo for this view?"), ok: t("Delete old photo"), cancel: t("Keep both") })) { await SM.db.del("photos", b.dataset.old); W.photoIds = W.photoIds.filter((x) => x !== b.dataset.old); }
        W.photoIds = W.photoIds.concat(shots.map((p) => p.id)); await persist();
      }
      app.rerender();
    }));
    U.$$("[data-mphoto]", el).forEach((b) => (b.onclick = async () => {
      const s = await ensureSession(c);
      const id = b.dataset.mphoto, entry = SM.catalog.get(id);
      const want = entry.view === "side" ? ["right", "left"] : entry.view === "back" ? ["back"] : ["front", "upper", "lower", "sleeve", "extended"];
      const p = photos.find((x) => want.includes(x.view)) || photos[0];
      if (!p) { U.toast(t("Capture a photo first."), "err"); return; }
      await SM.editor.open(p, { customer: c, sessionId: s.id, measureId: id, calMethod: W.cal, tool: p.ann && p.ann.cal && p.ann.cal.result && p.ann.cal.result.valid ? "line" : "cal" });
      app.rerender();
    }));
    U.$$("[data-vok]", el).forEach((b) => (b.onclick = async () => {
      const s = await ensureSession(c); const id = b.dataset.vok; const inp = U.$(`[data-tape="${id}"]`, el);
      const v = E.parse(inp.value, unit, id); if (v == null) { U.toast(t("Enter the tape value."), "err"); return; }
      const it = s.items[id]; E.addReading(it, v, "manual", { by: s.designer }); E.verify(it, s.designer || app.settings.designer);
      await app.saveSession(s); U.toast(t("{n} verified with tape", { n: SM.catalog.name(id) })); app.rerender();
    }));
  };

  async function ensureSession(c) {
    if (W.sessionId) { const s = await SM.db.get("sessions", W.sessionId); if (s) return s; }
    const tplId = W.templateId || (c && c.garment) || "u_body_basic";
    const s = await app.ensureSession(c.id, tplId);
    W.sessionId = s.id; await persist();
    return s;
  }

  SM.wizard = { start, STEPS };
})();

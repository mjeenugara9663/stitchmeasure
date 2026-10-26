/* Interactive body map, measurement library, measurement detail and the pose
 * reference library. Illustrations are generated from SM.figure (original SVG). */
(function () {
  "use strict";
  const SM = window.SM, U = SM.util, t = SM.t, app = SM.app;

  const st = { view: "front", age: "adult", region: "shoulders", q: "" };

  SM.views.library = async function (el) {
    el.innerHTML = app.head({ title: t("Measurement library"), sub: t("{n} head-to-toe measurements. Tap the body to choose a region, then a measurement for instructions.", { n: SM.catalog.all.length }), actions: `<a class="btn" href="#/poses">${SM.icon("body")}${t("Pose references")}</a>` }) + `
      <div class="bodymap">
        <div class="map-stage">
          <div class="row between">
            <div class="seg" role="group" aria-label="${t("View")}">${["front", "side", "back"].map((v) => `<button data-view="${v}" aria-pressed="${st.view === v}">${t(v[0].toUpperCase() + v.slice(1))}</button>`).join("")}</div>
            <div class="seg" role="group" aria-label="${t("Figure")}">${[["adult", "Adult"], ["child", "Child"]].map(([v, n]) => `<button data-age="${v}" aria-pressed="${st.age === v}">${t(n)}</button>`).join("")}</div>
          </div>
          <div class="map-svg" id="mapSvg" role="img" aria-label="${t("Body map. Tap a body region.")}"></div>
          <div class="filters">${SM.catalog.REGIONS.map((r) => `<button class="btn sm ${st.region === r.id ? "navy" : ""}" data-region="${r.id}">${t(r.name)}</button>`).join("")}</div>
        </div>
        <div class="stack">
          <div class="search">${SM.icon("search")}<input type="search" id="libQ" placeholder="${t("Search all measurements")}" value="${U.esc(st.q)}"></div>
          <div id="libList" class="list"></div>
        </div>
      </div>`;
    drawMap(); drawList();
    U.$$("[data-view]", el).forEach((b) => (b.onclick = () => { st.view = b.dataset.view; U.$$("[data-view]", el).forEach((x) => x.setAttribute("aria-pressed", x === b)); drawMap(); }));
    U.$$("[data-age]", el).forEach((b) => (b.onclick = () => { st.age = b.dataset.age; U.$$("[data-age]", el).forEach((x) => x.setAttribute("aria-pressed", x === b)); drawMap(); drawList(); }));
    U.$$("[data-region]", el).forEach((b) => (b.onclick = () => setRegion(b.dataset.region)));
    U.$("#libQ").oninput = (e) => { st.q = e.target.value; drawList(); };
    U.$("#mapSvg").onclick = (e) => {
      const svg = U.$("#mapSvg svg"); if (!svg) return;
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      const r = SM.figure.regionAt(st.view, st.age, p.x, p.y);
      if (r) setRegion(r);
    };
    function setRegion(r) { st.region = r; st.q = ""; U.$("#libQ").value = ""; U.$$("[data-region]", el).forEach((b) => b.classList.toggle("navy", b.dataset.region === r)); drawMap(); drawList(); }
  };
  function drawMap() { U.$("#mapSvg").innerHTML = SM.figure.svg({ view: st.view, age: st.age, arms: st.view === "side" ? "down" : "a", mode: "map", region: st.region === "full" ? null : st.region }); }
  function drawList() {
    const q = st.q.toLowerCase();
    const list = q ? SM.catalog.all.filter((e) => (SM.catalog.name(e.id) + " " + e.desc).toLowerCase().includes(q)) : SM.catalog.byRegion(st.region);
    const reg = SM.catalog.REGIONS.find((r) => r.id === st.region);
    U.$("#libList").innerHTML = (q ? `<h3>${list.length} ${t("results")}</h3>` : `<h3>${t(reg ? reg.name : "")} · ${list.length}</h3>`) + list.map((e) => `
      <a class="list-item lib-item" href="#/measure/${e.id}"><span class="lib-thumb">${SM.figure.forEntry(e, st.age)}</span><span class="main"><span class="t">${U.esc(SM.catalog.name(e.id))}</span><span class="s">${t(SM.catalog.KIND_LABEL[e.kind])} · ${e.camera ? t("Tape or calibrated photo") : t("Tape only")}${e.critical ? " · " + t("fit-critical") : ""}</span></span>${SM.icon("chevron")}</a>`).join("");
  }

  function entryHTML(e, age) {
    const pose = SM.catalog.POSES[e.pose] || {};
    const method = e.camera
      ? t("Manual tape measurement, or a calibrated photo measurement (marker, A4 or known length; height calibration for vertical lines only).")
      : t("Manual tape measurement only. A photo cannot give a reliable value for this measurement.");
    const verify = e.critical
      ? t("Fit-critical. Any value from a photo must be confirmed with a tape before cutting.")
      : e.camera ? t("Photo values are marked “Requires verification” until checked, if used for fit.") : t("Record with a tape; mark as verified once double-checked.");
    return `
      <div class="ref-fig lg">${SM.figure.forEntry(e, age)}</div>
      <p class="lead">${U.esc(SM.i18n.catalog(e.id, "desc", e.desc))}</p>
      <div class="card stack-sm"><h3>${t("How to measure")}</h3><p>${U.esc(SM.i18n.catalog(e.id, "how", e.how))}</p></div>
      <dl class="kv">
        <dt>${t("Type")}</dt><dd>${t(SM.catalog.KIND_LABEL[e.kind])} · ${e.kind === "angle" ? t("degrees") : t("cm / mm / in")}</dd>
        <dt>${t("Landmarks")}</dt><dd>${t("Highlighted in gold on the illustration")}</dd>
        <dt>${t("Recommended pose")}</dt><dd><a href="#/poses/${e.pose}">${U.esc(t(pose.name || ""))}</a></dd>
        <dt>${t("Camera view")}</dt><dd>${t(e.view === "side" ? "Side" : e.view === "back" ? "Back" : "Front")}</dd>
        <dt>${t("Method")}</dt><dd>${method}</dd>
        <dt>${t("Verification")}</dt><dd>${verify}</dd>
      </dl>`;
  }

  SM.views.measure = async function (el, args) {
    const e = SM.catalog.get(args[0]); if (!e) return app.go("#/library");
    el.innerHTML = app.head({ eyebrow: t((SM.catalog.REGIONS.find((r) => r.id === e.region) || {}).name || ""), title: SM.catalog.name(e.id),
      actions: `<a class="btn" href="#/library">${SM.icon("back")}${t("Library")}</a>` }) +
      `<div class="grid-2"><div class="stack">${entryHTML(e, st.age)}</div>
      <div class="stack"><section class="card stack"><h2>${t("Record this measurement")}</h2>
        <p class="muted">${t("Choose a customer to enter the value by hand, or measure it on a calibrated photo.")}</p>
        <div class="btn-row"><button class="btn primary" data-manual>${SM.icon("edit")}${t("Enter manually")}</button>${e.camera ? `<button class="btn" data-photo>${SM.icon("ruler")}${t("Measure on photo")}</button>` : ""}</div>
        ${!e.camera ? `<div class="notice">${SM.icon("info")}<div>${t("Camera-assisted measurement is not offered here because a photo cannot capture the full girth or depth.")}</div></div>` : ""}
      </section></div></div>`;
    U.$("[data-manual]", el).onclick = () => recordFor(e.id, "manual");
    const ph = U.$("[data-photo]", el); if (ph) ph.onclick = () => recordFor(e.id, "photo");
  };

  /* open (or create) a record for a chosen customer that contains this measurement */
  async function recordFor(id, mode, ctx) {
    let s = ctx && ctx.sessionId ? await SM.db.get("sessions", ctx.sessionId) : null;
    if (!s) {
      const c = app.state.customerId ? await SM.customers.get(app.state.customerId) : null;
      const cust = c && (await U.confirm({ title: t("Use {n}?", { n: c.name }), message: t("Record this measurement for the selected customer?"), ok: t("Yes"), cancel: t("Choose another") })) ? c : await app.pickCustomer();
      if (!cust) return;
      const list = await SM.customers.sessions(cust.id);
      s = list[0] || (await app.ensureSession(cust.id, cust.garment || "u_body_basic"));
    }
    const tpl = await app.resolveTemplate(s.templateId);
    const ids = app.sessionIds(s, tpl);
    if (!ids.includes(id)) { s.order = ids.concat([id]); await app.saveSession(s); }
    app._sesUI = { id: s.id, filter: "all", open: { [id]: true } };
    if (mode === "photo") SM.photosView.pickForMeasure(s, id);
    else app.go("#/session/" + s.id);
  }

  function showEntry(id, ctx) {
    const e = SM.catalog.get(id);
    if (!e) { U.toast(t("Custom measurement: no library entry.")); return; }
    const s = U.sheet({ title: SM.catalog.name(id), wide: true, html: entryHTML(e, st.age) + `<div class="btn-row end">${e.camera ? `<button class="btn" data-photo>${SM.icon("ruler")}${t("Measure on photo")}</button>` : ""}<button class="btn primary" data-close>${t("Done")}</button></div>` });
    const ph = s.el.querySelector("[data-photo]"); if (ph) ph.onclick = () => { s.close(); recordFor(id, "photo", ctx); };
  }

  /* ---------- pose references ---------- */
  SM.views.poses = async function (el, args) {
    const focus = args[0];
    const canSpeak = "speechSynthesis" in window;
    el.innerHTML = app.head({ title: t("Pose references"), sub: t("Show the customer the pose before opening the camera. Text guidance is always shown; spoken guidance uses the device's built-in voices where available."), actions: `<a class="btn" href="#/library">${SM.icon("back")}${t("Library")}</a>` }) +
      `<div class="stack">${Object.entries(SM.catalog.POSES).map(([id, p]) => `
        <section class="card" id="pose-${id}" ${focus === id ? 'style="border-color:var(--teal);box-shadow:0 0 0 3px var(--teal-soft)"' : ""}>
          <div class="grid-2" style="align-items:start">
            <div class="ref-fig">${SM.figure.forPose(id, "adult")}</div>
            <div class="stack-sm">
              <h2>${U.esc(t(p.name))}</h2>
              <dl class="kv"><dt>${t("Camera")}</dt><dd>${U.esc(t(p.camera))}</dd><dt>${t("Posture")}</dt><dd>${U.esc(t(p.posture))}</dd><dt>${t("Hands & feet")}</dt><dd>${U.esc(t(p.limbs))}</dd><dt>${t("Landmarks")}</dt><dd>${p.landmarks.map((x) => U.esc(t(x))).join(", ")}</dd></dl>
              <div class="notice warn">${SM.icon("warn")}<div><b>${t("Common mistakes")}</b><ul>${p.mistakes.map((m) => `<li>${U.esc(t(m))}</li>`).join("")}</ul></div></div>
              ${canSpeak ? `<div><button class="btn sm" data-speak="${id}">${SM.icon("info")}${t("Read aloud")}</button></div>` : ""}
            </div>
          </div>
        </section>`).join("")}</div>`;
    if (focus) setTimeout(() => { const n = U.$("#pose-" + focus); n && n.scrollIntoView({ block: "start" }); }, 50);
    U.$$("[data-speak]", el).forEach((b) => (b.onclick = () => speakPose(b.dataset.speak)));
  };
  function speakPose(id) {
    const p = SM.catalog.POSES[id]; if (!p || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance([t(p.name), t(p.camera), t(p.posture), t(p.limbs)].join(". "));
    u.lang = "en"; speechSynthesis.speak(u);
  }

  SM.bodymap = { showEntry, recordFor, speakPose, entryHTML };
})();

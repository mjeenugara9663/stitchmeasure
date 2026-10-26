/* Dashboard and "More" screens. All numbers come from local data. */
(function () {
  "use strict";
  const SM = window.SM, U = SM.util, t = SM.t, app = SM.app;

  SM.views.dashboard = async function (el) {
    const [customers, sessions, photos, activity, templatesAll] = await Promise.all([
      SM.db.all("customers"), SM.db.all("sessions"), SM.db.all("photos"), SM.db.all("activity"), app.templatesAll()
    ]);
    let complete = 0, incomplete = 0, pending = 0;
    const pendingRows = [];
    const custById = Object.fromEntries(customers.map((c) => [c.id, c]));
    const latest = {};
    sessions.forEach((s) => { const k = s.customerId; if (!latest[k] || (s.date + s.updatedAt) > (latest[k].date + latest[k].updatedAt)) latest[k] = s; });
    for (const s of Object.values(latest)) {
      const tpl = templatesAll.find((x) => x.id === s.templateId);
      const ids = app.sessionIds(s, tpl);
      const sum = SM.engine.summary(s, ids);
      if (sum.complete) complete++; else incomplete++;
      if (sum.verify) { pending += sum.verify; pendingRows.push({ s, n: sum.verify, c: custById[s.customerId] }); }
    }
    const status = await app.offlineStatus();
    const est = await SM.db.estimate();
    const fileWarn = location.protocol === "file:";
    const recentPhotos = photos.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
    const recentAct = activity.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
    const backupAge = app.settings.lastBackupAt ? Math.floor((Date.now() - new Date(app.settings.lastBackupAt)) / 86400000) : null;

    el.innerHTML = `
      ${fileWarn ? `<div class="notice warn" style="margin-bottom:14px">${SM.icon("warn")}<div><b>${t("Opened directly as a file.")}</b> ${t("Camera access, offline installation and the service worker need the app to be served over https:// or localhost. Manual measurement entry, photo import, reports and backups still work. See docs/installation.md.")}</div></div>` : ""}
      ${SM.db.inMemory ? `<div class="notice danger" style="margin-bottom:14px">${SM.icon("warn")}<div>${t("This browser is blocking storage (private mode?). Nothing will be kept after you close the app.")}</div></div>` : ""}
      <section class="hero">
        <div>
          <div class="eyebrow">${t("Offline measurement studio")}</div>
          <h1>${t("Measure with care, cut with confidence.")}</h1>
          <p>${t("Guided photos, tape-verified values and clean measurement sheets. Everything stays on this device.")}</p>
          <div class="btn-row"><a class="btn primary" href="#/scan">${SM.icon("scan")}${t("Start new measurement")}</a><a class="btn gold" href="#/camera">${SM.icon("camera")}${t("Open camera")}</a></div>
        </div>
        <div class="hero-fig">${SM.figure.svg({ view: "front", markers: false })}</div>
      </section>

      <div class="stack" style="margin-top:16px">
        <div class="kpis">
          <a class="kpi" href="#/customers"><b>${customers.length}</b><span>${t("Customers")}</span></a>
          <a class="kpi" href="#/customers"><b>${complete}</b><span>${t("Completed profiles")}</span></a>
          <a class="kpi" href="#/customers"><b>${incomplete}</b><span>${t("Incomplete measurements")}</span></a>
          <a class="kpi ${pending ? "attn" : ""}" href="#pending"><b>${pending}</b><span>${t("Pending verification")}</span></a>
        </div>

        <div class="tiles">
          <a class="tile" href="#/new-customer">${SM.icon("userPlus")}<span>${t("New customer")}<small>${t("Create a profile")}</small></span></a>
          <button class="tile" data-select>${SM.icon("users")}<span>${t("Select customer")}<small>${t("Open a saved profile")}</small></span></button>
          <a class="tile" href="#/templates">${SM.icon("hanger")}<span>${t("Garment templates")}<small>${templatesAll.length} ${t("checklists")}</small></span></a>
          <a class="tile" href="#/reports">${SM.icon("report")}<span>${t("Measurement reports")}<small>${t("PDF · CSV · JSON · Print")}</small></span></a>
          <a class="tile" href="#/library">${SM.icon("body")}<span>${t("Body map")}<small>${SM.catalog.all.length} ${t("measurements")}</small></span></a>
          <a class="tile" href="#/settings#calibration">${SM.icon("ruler")}<span>${t("Calibration settings")}<small>${t("Marker, A4, height")}</small></span></a>
        </div>

        ${customers.length === 0 ? `<div class="card pad-lg"><div class="empty">${SM.icon("tape")}<h2>${t("No customers yet")}</h2><p>${t("Create your first customer, or load three sample profiles to explore the app. Samples are clearly marked and can be deleted.")}</p><div class="btn-row" style="justify-content:center"><a class="btn primary" href="#/new-customer">${t("New customer")}</a><button class="btn" data-samples>${t("Load sample profiles")}</button></div></div></div>` : ""}

        <div class="grid-2">
          <section class="card" id="pending">
            <div class="card-head"><h2>${t("Pending verification")}</h2><span class="chip ${pending ? "st-requires_verification" : "st-verified"}">${pending} ${t("values")}</span></div>
            ${pendingRows.length ? `<div class="list">${pendingRows.slice(0, 6).map((r) => `<a class="list-item" href="#/session/${r.s.id}"><span class="avatar">${U.esc(app.initials(r.c && r.c.name))}</span><span class="main"><span class="t">${U.esc(r.c ? r.c.name : "?")}</span><span class="s">${r.n} ${t("need a tape check")} · ${U.esc(U.fmtDate(r.s.date))}</span></span>${SM.icon("chevron")}</a>`).join("")}</div>` : `<p class="muted">${t("Nothing waiting. Camera values and estimates appear here until a tape check confirms them.")}</p>`}
          </section>
          <section class="card">
            <div class="card-head"><h2>${t("Offline status")}</h2><span class="chip ${status.ready ? "teal" : "gold"}">${status.ready ? t("Ready") : status.sw === "file" ? t("File mode") : t("Not cached")}</span></div>
            <dl class="kv">
              <dt>${t("App files")}</dt><dd>${status.ready ? t("Cached for offline use") : status.sw === "file" ? t("Not cached (opened as a file)") : status.sw === "unsupported" ? t("This browser cannot cache the app") : t("Caching… reopen once while online")}</dd>
              <dt>${t("Connection")}</dt><dd>${status.online ? t("Online") : t("Offline")}</dd>
              <dt>${t("Storage used")}</dt><dd>${est ? U.bytes(est.usage) + " " + t("of") + " " + U.bytes(est.quota) : t("Unknown")}</dd>
              <dt>${t("Last backup")}</dt><dd>${backupAge == null ? `<span style="color:var(--warn)">${t("Never")}</span>` : backupAge === 0 ? t("Today") : backupAge + " " + t("days ago")}</dd>
            </dl>
            ${backupAge == null || backupAge > 7 ? `<a class="btn sm gold" style="margin-top:12px" href="#/settings#backup">${SM.icon("download")}${t("Back up now")}</a>` : ""}
          </section>
        </div>

        <section class="card">
          <div class="card-head"><h2>${t("Recently captured photos")}</h2><a class="btn sm ghost" href="#/photos">${t("All photos")}</a></div>
          ${recentPhotos.length ? `<div class="photo-grid" data-photos></div>` : `<p class="muted">${t("Photos you save to a customer appear here.")}</p>`}
        </section>

        <section class="card">
          <div class="card-head"><h2>${t("Recent activity")}</h2></div>
          ${recentAct.length ? `<div class="stack-sm">${recentAct.map((a) => `<div class="row between"><span>${U.esc(a.text)}</span><span class="muted small">${U.esc(U.fmtDateTime(a.at))}</span></div>`).join("")}</div>` : `<p class="muted">${t("No activity yet.")}</p>`}
        </section>
      </div>`;

    const grid = U.$("[data-photos]", el);
    if (grid) {
      for (const p of recentPhotos) {
        const url = URL.createObjectURL(p.thumb || p.blob);
        const c = custById[p.customerId];
        const a = document.createElement("a");
        a.className = "photo-card"; a.href = "#/photos/" + p.id;
        a.innerHTML = `<img src="${url}" alt=""><span class="cap">${U.esc(c ? c.name : "")} · ${t(SM.overlays.VIEWS[p.view] ? SM.overlays.VIEWS[p.view].name : "Photo")}</span>`;
        grid.appendChild(a);
      }
    }
    const sel = U.$("[data-select]", el);
    sel.onclick = async () => { const c = await app.pickCustomer(); if (c) app.go("#/customer/" + c.id); };
    const sm = U.$("[data-samples]", el);
    if (sm) sm.onclick = async () => { sm.disabled = true; await SM.samples.load(); U.toast(t("Three sample profiles added.")); app.rerender(); };
    const pend = U.$('a[href="#pending"]', el);
    if (pend) pend.onclick = (e) => { e.preventDefault(); U.$("#pending").scrollIntoView({ behavior: "smooth" }); };
  };

  SM.views.more = async function (el) {
    el.innerHTML = app.head({ title: t("More") }) + `<div class="list">
      ${[["#/new-customer", "userPlus", "New customer", "Create a customer profile"], ["#/templates", "hanger", "Garment templates", "Checklists for every garment"], ["#/reports", "report", "Reports", "Measurement sheets and exports"], ["#/photos", "image", "Photo library", "Saved photos by customer and view"], ["#/poses", "body", "Pose references", "How to stand for each photo"], ["#/settings", "settings", "Settings", "Units, privacy, backup, calibration"]]
      .map(([h, i, n, s]) => `<a class="list-item" href="${h}"><span class="avatar">${SM.icon(i)}</span><span class="main"><span class="t">${t(n)}</span><span class="s">${t(s)}</span></span>${SM.icon("chevron")}</a>`).join("")}
    </div>`;
  };
})();

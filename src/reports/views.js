/* Reports screens: list of measurement records and the measurement sheet. */
(function () {
  "use strict";
  const SM = window.SM, U = SM.util, t = SM.t, app = SM.app, PX = SM.photoExport;

  SM.views.reports = async function (el) {
    const [sessions, customers, templates] = await Promise.all([SM.db.all("sessions"), SM.db.all("customers"), app.templatesAll()]);
    const cmap = Object.fromEntries(customers.map((c) => [c.id, c]));
    const q = (app._repQ = app._repQ || { q: "" });
    el.innerHTML = app.head({ title: t("Reports"), sub: t("Choose a measurement record to view its sheet and export it as PDF, CSV, JSON or a printable page.") }) + `
      <div class="stack"><div class="search">${SM.icon("search")}<input type="search" id="repQ" placeholder="${t("Search customer or garment")}" value="${U.esc(q.q)}"></div><div class="list" id="repList"></div></div>`;
    const draw = () => {
      const s = q.q.toLowerCase();
      const rows = sessions.filter((x) => cmap[x.customerId]).map((x) => ({ x, c: cmap[x.customerId], tp: templates.find((tp) => tp.id === x.templateId) }))
        .filter((r) => !s || [r.c.name, r.c.code, r.tp ? r.tp.name : ""].join(" ").toLowerCase().includes(s))
        .sort((a, b) => (b.x.date + b.x.updatedAt).localeCompare(a.x.date + a.x.updatedAt));
      U.$("#repList").innerHTML = rows.length ? rows.map((r) => { const sum = SM.engine.summary(r.x, app.sessionIds(r.x, r.tp)); return `<a class="list-item" href="#/report/${r.x.id}"><span class="avatar">${SM.icon("report")}</span><span class="main"><span class="t">${U.esc(r.c.name)} · ${U.esc(r.tp ? r.tp.name : t("Custom"))}</span><span class="s">${U.esc(r.c.code)} · ${U.esc(U.fmtDate(r.x.date))} · ${sum.done}/${sum.total}${sum.verify ? " · " + sum.verify + " " + t("to verify") : ""}</span></span>${SM.icon("chevron")}</a>`; }).join("") : `<div class="empty">${SM.icon("report")}<p>${t("No measurement records yet.")}</p></div>`;
    };
    draw();
    U.$("#repQ").oninput = (e) => { q.q = e.target.value; draw(); };
  };

  SM.views.report = async function (el, args) {
    let r;
    try { r = await SM.reports.build(args[0]); } catch (e) { el.innerHTML = `<div class="empty">${U.esc(e.message)}</div>`; return; }
    const photos = r.customer ? await SM.customers.photos(r.customer.id) : [];
    const sel = (app._repSel && app._repSel.id === args[0]) ? app._repSel : (app._repSel = { id: args[0], ids: photos.filter((p) => p.sessionId === r.session.id).slice(0, 4).map((p) => p.id), version: "lines" });
    const base = U.safeName(((r.customer && r.customer.code) || "Customer") + "_" + (r.template ? r.template.name : "Measurements") + "_" + r.session.date);
    el.innerHTML = app.head({ eyebrow: r.customer ? r.customer.name : "", title: t("Measurement sheet"), actions: `<a class="btn no-print" href="#/session/${r.session.id}">${SM.icon("edit")}${t("Edit values")}</a>` }) + `
      <div class="stack">
        <section class="card stack no-print">
          <div class="btn-row">
            <button class="btn primary" data-x="pdf">${SM.icon("download")}PDF</button>
            <button class="btn" data-x="csv">${SM.icon("download")}CSV</button>
            <button class="btn" data-x="json">${SM.icon("download")}JSON</button>
            <button class="btn" data-x="print">${SM.icon("print")}${t("Print / A4")}</button>
            <button class="btn" data-x="sharepdf">${SM.icon("share")}${t("Share PDF")}</button>
          </div>
          ${photos.length ? `<details><summary style="cursor:pointer;font-weight:600">${t("Reference photographs in the report")} (${sel.ids.length})</summary>
            <div class="stack-sm" style="margin-top:10px">
              <label class="field">${t("Photo version")}<select id="repVer">${Object.entries(PX.VERSIONS).map(([k, v]) => `<option value="${k}" ${sel.version === k ? "selected" : ""}>${t(v)}</option>`).join("")}</select></label>
              <div class="photo-grid">${photos.map((p) => `<label class="photo-card" style="cursor:pointer"><img src="${URL.createObjectURL(p.thumb || p.blob)}" alt=""><span class="cap"><input type="checkbox" data-ph="${p.id}" ${sel.ids.includes(p.id) ? "checked" : ""}> ${t(SM.overlays.VIEWS[p.view] ? SM.overlays.VIEWS[p.view].name : "Photo")}</span></label>`).join("")}</div>
            </div></details>` : ""}
          <p class="muted small">${t("Exports are created on this device and work offline.")}</p>
        </section>
        <div id="repBody"></div>
      </div>`;
    async function photoAssets(max) {
      const out = [];
      for (const id of sel.ids) {
        const p = photos.find((x) => x.id === id); if (!p) continue;
        const c = await PX.render(p, sel.version, r.unit);
        const k = Math.min(1, (max || 1200) / Math.max(c.width, c.height));
        const s = document.createElement("canvas"); s.width = Math.round(c.width * k); s.height = Math.round(c.height * k); s.getContext("2d").drawImage(c, 0, 0, s.width, s.height);
        out.push({ dataURL: s.toDataURL("image/jpeg", 0.85), url: s.toDataURL("image/jpeg", 0.85), w: s.width, h: s.height, caption: t(SM.overlays.VIEWS[p.view] ? SM.overlays.VIEWS[p.view].name : "Photo") + " · " + U.fmtDate(p.createdAt) });
      }
      return out;
    }
    const drawBody = async () => { U.$("#repBody").innerHTML = await SM.reports.html(r, await photoAssets(700)); };
    await drawBody();
    U.$$("[data-ph]", el).forEach((cb) => (cb.onchange = async () => { sel.ids = U.$$("[data-ph]", el).filter((x) => x.checked).map((x) => x.dataset.ph); await drawBody(); }));
    const rv = U.$("#repVer"); if (rv) rv.onchange = async (e) => { sel.version = e.target.value; await drawBody(); };
    U.$$("[data-x]", el).forEach((b) => (b.onclick = async () => {
      const x = b.dataset.x;
      try {
        if (x === "csv") await app.deliver(new Blob([SM.reports.csv(r)], { type: "text/csv;charset=utf-8" }), base + ".csv", "saveas");
        else if (x === "json") await app.deliver(new Blob([SM.reports.json(r)], { type: "application/json" }), base + ".json", "saveas");
        else if (x === "print") window.print();
        else { b.disabled = true; const blob = await SM.reports.pdf(r, await photoAssets(1400)); b.disabled = false; await app.deliver(blob, base + ".pdf", x === "sharepdf" ? "share" : "saveas"); }
        if (x !== "print") await SM.db.log(`Exported ${x.replace("share", "").toUpperCase()} report for ${r.customer ? r.customer.name : ""}`, r.session.id);
      } catch (e) { b.disabled = false; U.toast(t("Export failed: ") + e.message, "err"); }
    }));
  };
})();

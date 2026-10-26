/* Measurement record editor: manual entry, repeat readings, verification,
 * allowances, custom measurements. Saves automatically. */
(function () {
  "use strict";
  const SM = window.SM, U = SM.util, t = SM.t, app = SM.app, E = SM.engine;

  SM.views.session = async function (el, args) {
    const s = await SM.db.get("sessions", args[0]);
    if (!s) { el.innerHTML = `<div class="empty">${t("Measurement record not found.")}</div>`; return; }
    const c = await SM.customers.get(s.customerId);
    const tpl = await app.resolveTemplate(s.templateId);
    const unit = app.unit(c);
    const tol = (app.settings.tolerance || E.DEFAULT_TOL)[(tpl && tpl.fit) || "semi"] || 1;
    const ui = (app._sesUI = app._sesUI && app._sesUI.id === s.id ? app._sesUI : { id: s.id, filter: "all", open: {} });
    app.state.customerId = s.customerId;

    const save = U.debounce(() => app.saveSession(s), 250);
    const ids = () => app.sessionIds(s, tpl);
    const item = (id) => (s.items[id] = s.items[id] || E.newItem());
    const name = (id) => app.itemName(id, s, tpl);

    el.innerHTML = app.head({ eyebrow: (c ? c.name + " · " + c.code : "") , title: tpl ? tpl.name : t("Measurements"),
      actions: `<a class="btn" href="#/customer/${s.customerId}">${SM.icon("back")}${t("Profile")}</a><a class="btn" href="#/report/${s.id}">${SM.icon("report")}${t("Report")}</a><button class="btn primary" data-scan>${SM.icon("scan")}${t("Scan")}</button>` }) + `
      <div class="stack">
        <section class="card stack" id="sesSummary"></section>
        <div class="row between">
          <div class="filters" role="group" aria-label="${t("Show")}">${[["all", "All"], ["todo", "To do"], ["verify", "Needs tape check"], ["verified", "Verified"]].map(([k, n]) => `<button class="btn sm ${ui.filter === k ? "navy" : ""}" data-filter="${k}">${t(n)}</button>`).join("")}</div>
          <button class="btn sm" data-add>${SM.icon("plus")}${t("Add measurement")}</button>
        </div>
        <div class="m-list" id="mList"></div>
        <section class="card stack">
          <h3>${t("Record details")}</h3>
          <div class="form-grid">
            <label class="field">${t("Measurement date")}<input type="date" id="sDate" value="${U.esc(s.date)}"></label>
            <label class="field">${t("Tailor / designer")}<input type="text" id="sDesigner" value="${U.esc(s.designer)}"></label>
            <label class="field">${t("Seam allowance")} (${E.unitLabel(unit)})<input type="number" step="any" inputmode="decimal" id="sSeam" value="${s.seamAllowanceCm != null ? E.format(s.seamAllowanceCm, unit) : ""}"><span class="hint">${t("Recorded for the pattern. Never added to body or finished values.")}</span></label>
          </div>
          <label class="field">${t("Tailor remarks")}<textarea id="sRemarks">${U.esc(s.remarks)}</textarea></label>
          <div class="btn-row"><button class="btn danger sm" data-delses>${SM.icon("trash")}${t("Delete this record")}</button></div>
        </section>
      </div>`;

    function summary() {
      const sum = E.summary(s, ids());
      const incons = ids().filter((id) => s.items[id] && E.inconsistent(s.items[id], tol)).length;
      U.$("#sesSummary").innerHTML = `
        <div class="row between"><div><b class="tnum" style="font:700 26px/1 var(--body)">${sum.done}<span class="muted" style="font-size:18px"> / ${sum.total}</span></b> <span class="muted">${t("recorded")}</span></div>
        <div class="row">${sum.verified ? `<span class="chip st-verified">${sum.verified} ${t("verified")}</span>` : ""}${sum.verify ? `<span class="chip st-requires_verification">${sum.verify} ${t("need tape check")}</span>` : ""}${incons ? `<span class="chip st-rejected">${incons} ${t("inconsistent")}</span>` : ""}</div></div>
        <div class="progress"><span style="width:${sum.total ? Math.round(sum.done / sum.total * 100) : 0}%"></span></div>
        <p class="muted small">${t("Units")}: ${E.unitLabel(unit)} · ${t("Repeat-reading tolerance")}: ${E.format(tol, unit)} ${E.unitLabel(unit)} (${t(SM.templates.FIT[(tpl && tpl.fit) || "semi"])}) · ${t("Changes save automatically.")}</p>`;
    }

    function rowHTML(id) {
      const it = s.items[id] || E.newItem(), entry = SM.catalog.get(id);
      const st = E.status(it, entry), need = it.value != null && !it.verified && E.needsVerification(it, entry);
      const inc = E.inconsistent(it, tol), open = ui.open[id];
      const isAngle = E.isAngle(id);
      const fin = E.finished(it);
      return `<div class="m-row ${need || inc ? "flag" : ""} ${it.verified ? "verified" : ""}" data-id="${id}">
        <button class="m-name" data-info style="border:0;background:none;padding:0;text-align:left;color:inherit;font:inherit;cursor:pointer;font-weight:600">${U.esc(name(id))}<small>${entry ? t(SM.catalog.KIND_LABEL[entry.kind]) + (entry.camera ? " · " + t("photo-measurable") : " · " + t("tape only")) : t("Custom measurement")}${entry && entry.critical ? " · " + t("fit-critical") : ""}</small></button>
        <div class="m-val"><input type="number" inputmode="decimal" step="any" data-val value="${it.value != null ? E.format(it.value, unit, id).replace("°", "") : ""}" aria-label="${U.esc(name(id))}" ${it.verified ? 'data-verified="1"' : ""}><span class="u">${isAngle ? "°" : E.unitLabel(unit)}</span></div>
        <div class="m-meta">${app.statusChip(st)}${it.value != null || it.method === "unavailable" ? `<span class="chip">${U.esc(t(E.classification(it)))}</span>` : ""}${it.readings.length > 1 ? `<span class="chip">${it.readings.length} ${t("readings")}</span>` : ""}${inc ? `<span class="chip st-rejected">${t("Readings differ by")} ${E.format(E.spread(it), unit, id)}</span>` : ""}${fin != null ? `<span class="chip teal">${t("Finished")} ${E.format(fin, unit, id)}</span>` : ""}
          <button class="btn sm ghost" data-toggle style="margin-left:auto">${open ? t("Less") : t("More")}</button></div>
        ${open ? `<div class="m-more">
          <div class="form-grid">
            <label class="field">${t("Method")}<select data-method>${Object.entries(E.METHODS).map(([k, v]) => `<option value="${k}" ${(it.method || "manual") === k ? "selected" : ""} ${k === "ai" ? "disabled" : ""}>${t(v)}${k === "ai" ? " (" + t("Phase 2") + ")" : ""}</option>`).join("")}</select></label>
            <label class="field">${t("Add a reading")}<span class="row" style="flex-wrap:nowrap"><input type="number" inputmode="decimal" step="any" data-newread placeholder="${isAngle ? "°" : E.unitLabel(unit)}"><button class="btn sm" data-addread>${t("Add")}</button></span></label>
          </div>
          ${it.readings.length ? `<div><div class="muted small" style="margin-bottom:6px">${t("Readings (value = average of readings with the current method)")}</div><div class="readings">${it.readings.map((r, i) => `<span class="reading" title="${U.esc(t(E.METHODS[r.method] || r.method))} · ${U.esc(U.fmtDateTime(r.at))}">${E.format(r.v, unit, id)} <small class="muted">${r.method === "camera" ? t("cam") : r.method === "ai" ? t("AI") : t("tape")}</small><button data-rmread="${i}" aria-label="${t("Remove reading")}">${SM.icon("x")}</button></span>`).join("")}</div></div>` : ""}
          ${!isAngle ? `<div class="form-grid">
            <label class="field">${t("Garment ease")} (${E.unitLabel(unit)})<input type="number" step="any" inputmode="decimal" data-ease value="${it.ease != null ? E.format(it.ease, unit) : ""}"></label>
            <label class="field">${t("Design allowance")} (${E.unitLabel(unit)})<input type="number" step="any" inputmode="decimal" data-design value="${it.design != null ? E.format(it.design, unit) : ""}"></label>
            <div class="field">${t("Finished measurement")}<div style="padding:12px 0;font-weight:700" class="tnum">${fin != null ? E.format(fin, unit) + " " + E.unitLabel(unit) : "–"}</div></div>
          </div>` : ""}
          <label class="field">${t("Note")}<input type="text" data-note value="${U.esc(it.note || "")}" placeholder="${t("e.g. measured over thin kurta")}"></label>
          <div class="btn-row">
            ${it.verified ? `<button class="btn sm" data-unverify>${t("Remove verification")}</button>` : `<button class="btn sm primary" data-verify ${it.value == null ? "disabled" : ""}>${SM.icon("check")}${t("Mark tape-verified")}</button>`}
            <button class="btn sm danger" data-reject ${it.value == null ? "disabled" : ""}>${t("Reject value")}</button>
            ${entry && entry.camera ? `<button class="btn sm" data-photo>${SM.icon("ruler")}${t("Measure on photo")}</button>` : ""}
            ${(s.customDefs || []).some((d) => d.id === id) || (s.order && s.order.includes(id) && !SM.templates.items(tpl).includes(id)) ? `<button class="btn sm ghost" data-remove>${t("Remove from list")}</button>` : ""}
          </div>
          ${it.verified ? `<p class="muted small">${t("Verified")} ${it.verified.by ? t("by") + " " + U.esc(it.verified.by) + " " : ""}${U.esc(U.fmtDateTime(it.verified.at))}. ${t("Verified values cannot be changed without confirmation.")}</p>` : ""}
          ${it.rejected ? `<p class="small" style="color:var(--danger)">${t("Rejected")}: ${U.esc(it.rejected.reason || "")}</p>` : ""}
        </div>` : ""}
      </div>`;
    }

    function list() {
      const all = ids();
      const shown = all.filter((id) => {
        const it = s.items[id], entry = SM.catalog.get(id);
        if (ui.filter === "todo") return !it || it.value == null;
        if (ui.filter === "verify") return it && it.value != null && !it.verified && E.needsVerification(it, entry);
        if (ui.filter === "verified") return it && it.verified;
        return true;
      });
      U.$("#mList").innerHTML = shown.length ? shown.map(rowHTML).join("") : `<div class="empty">${t("Nothing in this filter.")}</div>`;
    }
    function refreshRow(id) {
      const old = U.$(`.m-row[data-id="${CSS.escape(id)}"]`);
      if (old) { const tmp = document.createElement("div"); tmp.innerHTML = rowHTML(id); old.replaceWith(tmp.firstElementChild); }
      summary();
    }

    async function guardVerified(id) {
      const it = item(id);
      if (!it.verified) return true;
      return U.confirm({ title: t("Replace a verified value?"), message: t("{n} was verified with a tape. Replacing it removes the verification.", { n: name(id) }), ok: t("Replace"), danger: true });
    }

    summary(); list();

    const mlist = U.$("#mList");
    mlist.addEventListener("change", async (e) => {
      const row = e.target.closest(".m-row"); if (!row) return;
      const id = row.dataset.id, it = item(id);
      if (e.target.matches("[data-val]")) {
        const txt = e.target.value.trim();
        if (!txt) {
          if (it.verified && !(await guardVerified(id))) { refreshRow(id); return; }
          it.readings = []; it.value = null; it.method = null; it.verified = null; save(); refreshRow(id); return;
        }
        const v = E.parse(txt, unit, id);
        if (v == null) { U.toast(t("Enter a number greater than zero."), "err"); refreshRow(id); return; }
        const force = it.verified ? await guardVerified(id) : false;
        if (it.verified && !force) { refreshRow(id); return; }
        const r = E.setValue(it, v, "manual", { force, by: s.designer });
        if (!r.ok) U.toast(t("Not saved."), "err");
        save(); refreshRow(id);
      } else if (e.target.matches("[data-method]")) {
        if (it.value == null) { it.method = e.target.value; if (e.target.value === "unavailable") it.method = "unavailable"; save(); refreshRow(id); return; }
        if (it.verified && !(await guardVerified(id))) { refreshRow(id); return; }
        it.method = e.target.value; it.verified = null;
        if (it.method === "unavailable") { it.readings = []; it.value = null; }
        else it.readings.forEach((r) => (r.method = it.method));
        save(); refreshRow(id);
      } else if (e.target.matches("[data-ease],[data-design]")) {
        const v = e.target.value.trim(); const k = e.target.matches("[data-ease]") ? "ease" : "design";
        it[k] = v === "" ? null : E.fromUnit(parseFloat(v), unit);
        if (it[k] != null && !isFinite(it[k])) it[k] = null;
        save(); refreshRow(id);
      } else if (e.target.matches("[data-note]")) { it.note = e.target.value.trim(); save(); }
    });
    mlist.addEventListener("click", async (e) => {
      const row = e.target.closest(".m-row"); if (!row) return;
      const id = row.dataset.id, it = item(id);
      if (e.target.closest("[data-toggle]")) { ui.open[id] = !ui.open[id]; refreshRow(id); }
      else if (e.target.closest("[data-info]")) SM.bodymap.showEntry(id, { sessionId: s.id });
      else if (e.target.closest("[data-addread]")) {
        const inp = row.querySelector("[data-newread]"); const v = E.parse(inp.value, unit, id);
        if (v == null) { U.toast(t("Enter a reading greater than zero."), "err"); return; }
        let force = false; if (it.verified) { force = await guardVerified(id); if (!force) return; }
        const method = row.querySelector("[data-method]").value === "unavailable" ? "manual" : row.querySelector("[data-method]").value;
        E.addReading(it, v, method, { force, by: s.designer });
        save(); refreshRow(id);
        if (E.inconsistent(it, tol)) U.toast(t("Readings differ by more than the tolerance. Measure again."), "err");
      } else if (e.target.closest("[data-rmread]")) {
        const i = +e.target.closest("[data-rmread]").dataset.rmread;
        let force = false; if (it.verified) { force = await guardVerified(id); if (!force) return; }
        E.removeReading(it, i, { force }); save(); refreshRow(id);
      } else if (e.target.closest("[data-verify]")) {
        if (E.inconsistent(it, tol) && !(await U.confirm({ title: t("Readings are inconsistent"), message: t("The readings differ by more than the tolerance. Verify anyway?"), ok: t("Verify anyway") }))) return;
        E.verify(it, s.designer || app.settings.designer); save(); refreshRow(id); U.toast(t("{n} marked as tape-verified", { n: name(id) }));
      } else if (e.target.closest("[data-unverify]")) { E.unverify(it); save(); refreshRow(id); }
      else if (e.target.closest("[data-reject]")) {
        const reason = await U.prompt({ title: t("Reject value"), label: t("Reason (shown in the report)"), value: "", ok: t("Reject") });
        if (reason == null) return; E.reject(it, reason); save(); refreshRow(id);
      } else if (e.target.closest("[data-photo]")) SM.photosView.pickForMeasure(s, id);
      else if (e.target.closest("[data-remove]")) {
        s.customDefs = (s.customDefs || []).filter((d) => d.id !== id);
        if (s.order) s.order = s.order.filter((x) => x !== id);
        delete s.items[id]; save(); list(); summary();
      }
    });
    U.$$("[data-filter]", el).forEach((b) => (b.onclick = () => { ui.filter = b.dataset.filter; app.rerender(); }));
    U.$("[data-scan]", el).onclick = () => SM.wizard.start({ customerId: s.customerId, sessionId: s.id });
    U.$("[data-add]", el).onclick = () => addMeasurement();
    U.$("#sDate").onchange = (e) => { s.date = e.target.value || s.date; save(); };
    U.$("#sDesigner").onchange = (e) => { s.designer = e.target.value.trim(); save(); };
    U.$("#sSeam").onchange = (e) => { const v = e.target.value.trim(); s.seamAllowanceCm = v === "" ? null : E.fromUnit(parseFloat(v), unit); save(); };
    U.$("#sRemarks").onchange = (e) => { s.remarks = e.target.value; save(); };
    U.$("[data-delses]", el).onclick = async () => {
      if (!(await U.confirm({ title: t("Delete this record?"), message: t("All values in this measurement record will be removed. Photos stay in the customer's library."), ok: t("Delete"), danger: true }))) return;
      await SM.db.del("sessions", s.id); U.toast(t("Record deleted")); app.go("#/customer/" + s.customerId);
    };

    function addMeasurement() {
      const have = new Set(ids());
      const sh = U.sheet({ title: t("Add measurement"), html: `
        <form class="row" data-custom style="flex-wrap:nowrap"><input type="text" placeholder="${t("Custom measurement name")}" data-cname><button class="btn primary">${t("Add")}</button></form>
        <div class="search">${SM.icon("search")}<input type="search" placeholder="${t("Search the library")}" data-q></div>
        <div class="list" data-list></div>` });
      const draw = (q) => {
        q = (q || "").toLowerCase();
        sh.el.querySelector("[data-list]").innerHTML = SM.catalog.all.filter((e) => !have.has(e.id) && (!q || SM.catalog.name(e.id).toLowerCase().includes(q))).slice(0, 60)
          .map((e) => `<button class="list-item" data-pick="${e.id}"><span class="main"><span class="t">${U.esc(SM.catalog.name(e.id))}</span><span class="s">${t((SM.catalog.REGIONS.find((r) => r.id === e.region) || {}).name || "")} · ${t(SM.catalog.KIND_LABEL[e.kind])}</span></span>${SM.icon("plus")}</button>`).join("");
      };
      draw("");
      sh.el.querySelector("[data-q]").oninput = (e) => draw(e.target.value);
      sh.el.querySelector("[data-list]").onclick = (e) => {
        const b = e.target.closest("[data-pick]"); if (!b) return;
        s.order = ids(); s.order.push(b.dataset.pick); save(); sh.close(); list(); summary();
      };
      sh.el.querySelector("[data-custom]").onsubmit = (e) => {
        e.preventDefault(); const n = sh.el.querySelector("[data-cname]").value.trim(); if (!n) return;
        const id = "c_" + U.uid("m").slice(2);
        s.customDefs = (s.customDefs || []).concat([{ id, name: n }]); save(); sh.close(); list(); summary();
      };
    }
  };
})();

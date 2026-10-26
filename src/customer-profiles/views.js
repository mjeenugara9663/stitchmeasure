/* Customer screens: list, create/edit form, profile detail, history comparison. */
(function () {
  "use strict";
  const SM = window.SM, U = SM.util, t = SM.t, app = SM.app;
  const E = SM.engine;

  /* ---------- list ---------- */
  SM.views.customers = async function (el) {
    const all = await SM.customers.list();
    const sessions = await SM.db.all("sessions");
    const last = {};
    sessions.forEach((s) => { if (!last[s.customerId] || s.date > last[s.customerId].date) last[s.customerId] = s; });
    const f = (app._custFilter = app._custFilter || { q: "", group: "all" });
    el.innerHTML = app.head({ title: t("Saved profiles"), sub: t("{n} customers stored on this device.", { n: all.length }), actions: `<button class="btn" data-import>${SM.icon("upload")}${t("Import profile")}</button><a class="btn primary" href="#/new-customer">${SM.icon("userPlus")}${t("New customer")}</a>` }) +
      `<div class="stack">
        <div class="search">${SM.icon("search")}<input type="search" id="custSearch" placeholder="${t("Search name, ID or phone")}" value="${U.esc(f.q)}"></div>
        <div class="filters" role="group" aria-label="${t("Filter")}">${[["all", "All"], ["women", "Women"], ["men", "Men"], ["girls", "Girls"], ["boys", "Boys"], ["unisex", "Unisex"], ["custom", "Custom"], ["child", "Children"], ["sample", "Samples"]].map(([k, n]) => `<button class="btn sm ${f.group === k ? "navy" : ""}" data-f="${k}">${t(n)}</button>`).join("")}</div>
        <div class="list" id="custList"></div>
      </div>
      <input type="file" id="impFile" accept=".json,application/json" hidden>`;
    const draw = () => {
      const q = f.q.toLowerCase();
      const rows = all.filter((c) => (!q || [c.name, c.code, c.phone].join(" ").toLowerCase().includes(q)) &&
        (f.group === "all" || c.template === f.group || (f.group === "child" && c.ageGroup === "child") || (f.group === "sample" && c.sample)));
      U.$("#custList").innerHTML = rows.length ? rows.map((c) => {
        const s = last[c.id];
        return `<a class="list-item" href="#/customer/${c.id}"><span class="avatar">${U.esc(app.initials(c.name))}</span><span class="main"><span class="t">${U.esc(c.name)} ${c.sample ? `<span class="chip sample">${t("Sample")}</span>` : ""}</span>
          <span class="s">${U.esc(c.code)} · ${t(SM.customers.TEMPLATES[c.template] || "")}${c.ageGroup === "child" ? " · " + t("Child") : ""} · ${s ? t("Measured") + " " + U.esc(U.fmtDate(s.date)) : t("No measurements yet")}</span></span>${SM.icon("chevron")}</a>`;
      }).join("") : `<div class="empty">${SM.icon("users")}<p>${all.length ? t("No customers match this search.") : t("No customers yet.")}</p></div>`;
    };
    draw();
    U.$("#custSearch").oninput = (e) => { f.q = e.target.value; draw(); };
    U.$$("[data-f]", el).forEach((b) => (b.onclick = () => { f.group = b.dataset.f; app.rerender(); }));
    U.$("[data-import]", el).onclick = () => U.$("#impFile").click();
    U.$("#impFile").onchange = (e) => importFile(e.target.files[0]);
  };

  async function importFile(file) {
    if (!file) return;
    try {
      let data = JSON.parse(await U.readFileAsText(file));
      if (data.schema === "stitchmeasure.encrypted/1") {
        const pw = await U.prompt({ title: t("Encrypted file"), label: t("Password"), type: "password", ok: t("Unlock") });
        if (!pw) return;
        data = await SM.backup.decrypt(data, pw);
      }
      const n = await SM.backup.restore(data);
      await SM.db.log(`Imported ${n.customers} profile(s)`);
      U.toast(t("Imported {c} customer(s), {s} measurement record(s), {p} photo(s).", { c: n.customers, s: n.sessions, p: n.photos }));
      app.rerender();
    } catch (e) { U.toast(t("Import failed: ") + e.message, "err"); }
  }
  SM.app.importFile = importFile;

  /* ---------- create / edit ---------- */
  async function form(el, c, isNew, returnTo) {
    const unit = c.unit || app.settings.unit;
    const templates = await app.templatesAll();
    el.innerHTML = app.head({ eyebrow: isNew ? t("Step 1 · Customer") : c.code, title: isNew ? t("New customer") : t("Edit customer"), sub: t("Only the name is required. Collect no more personal information than the job needs.") }) + `
      <form class="stack" id="custForm" novalidate>
        <section class="card stack">
          <h3>${t("Profile")}</h3>
          <div class="form-grid">
            <label class="field">${t("Customer name")}<input type="text" id="cName" value="${U.esc(c.name)}" autocomplete="off" required></label>
            <label class="field">${t("Customer ID")}<input type="text" id="cCode" value="${U.esc(c.code)}" placeholder="${t("Assigned on save")}" autocomplete="off"><span class="hint">${t("Leave blank to auto-number (SM-0001…)")}</span></label>
            <label class="field">${t("Phone (optional)")}<input type="tel" id="cPhone" value="${U.esc(c.phone)}" autocomplete="off"></label>
            <label class="field">${t("Tailor / designer")}<input type="text" id="cDesigner" value="${U.esc(c.designer || app.settings.designer)}"></label>
          </div>
          <div class="form-grid">
            <label class="field">${t("Adult or child")}<select id="cAge">${Object.entries(SM.customers.AGE_GROUPS).map(([k, v]) => `<option value="${k}" ${c.ageGroup === k ? "selected" : ""}>${t(v)}</option>`).join("")}</select></label>
            <label class="field">${t("Age or age group (optional)")}<input type="text" id="cAgeVal" value="${U.esc(c.age)}" placeholder="${t("e.g. 34 or 8–10")}"></label>
            <label class="field">${t("Measurement template")}<select id="cTpl">${Object.entries(SM.customers.TEMPLATES).map(([k, v]) => `<option value="${k}" ${c.template === k ? "selected" : ""}>${t(v)}</option>`).join("")}</select><span class="hint">${t("Only orders the garment list. Body values are never assumed from it.")}</span></label>
          </div>
          <div class="form-grid">
            <label class="field">${t("Known standing height")} (${unit})<input type="number" id="cHeight" inputmode="decimal" step="any" value="${c.heightCm ? E.format(c.heightCm, unit).replace(/\.0+$/, "") : ""}"><span class="hint">${t("Measured barefoot against a wall. Used for height calibration.")}</span></label>
            <label class="field">${t("Preferred unit")}<select id="cUnit"><option value="">${t("App default")} (${app.settings.unit})</option>${Object.keys(E.UNITS).map((u) => `<option value="${u}" ${c.unit === u ? "selected" : ""}>${u}</option>`).join("")}</select></label>
            <label class="field">${t("Garment category")}<select id="cGarment"><option value="">${t("Choose later")}</option>${SM.templates.GROUPS.map((g) => { const list = templates.filter((x) => x.group === g); return list.length ? `<optgroup label="${t(g)}">${list.map((x) => `<option value="${x.id}" ${c.garment === x.id ? "selected" : ""}>${U.esc(x.name)}</option>`).join("")}</optgroup>` : ""; }).join("")}</select></label>
          </div>
          <label class="field">${t("Measurement notes")}<textarea id="cNotes" placeholder="${t("Fit preferences, posture notes, fabric…")}">${U.esc(c.notes)}</textarea></label>
        </section>
        <section class="card stack">
          <h3>${t("Consent & privacy")}</h3>
          <label class="check"><input type="checkbox" id="cConsent" ${c.consent.photos ? "checked" : ""}><span>${t("The customer agrees to body photographs being taken and stored on this device for measurement.")}</span></label>
          <div class="stack-sm" id="guardianBox" ${c.ageGroup === "child" ? "" : "hidden"}>
            <div class="notice">${SM.icon("shield")}<div>${t("For a child, a parent or guardian must give consent. Store only what the garment needs.")}</div></div>
            <label class="field">${t("Guardian name")}<input type="text" id="gName" value="${U.esc(c.consent.guardian.name)}"></label>
            <label class="check"><input type="checkbox" id="gGiven" ${c.consent.guardian.given ? "checked" : ""}><span>${t("The guardian has given consent for measurements and photographs.")}</span></label>
          </div>
          <p class="muted small">${t("Without photo consent you can still record tape measurements and analyse a photo without keeping it.")}</p>
        </section>
        <div class="notice danger" id="formErr" hidden></div>
        <div class="btn-row end">
          <a class="btn ghost" href="${isNew ? "#/customers" : "#/customer/" + c.id}">${t("Cancel")}</a>
          <button class="btn primary" type="submit">${SM.icon("check")}${isNew ? t("Create profile") : t("Save changes")}</button>
        </div>
      </form>`;
    U.$("#cAge").onchange = (e) => (U.$("#guardianBox").hidden = e.target.value !== "child");
    U.$("#custForm").onsubmit = async (e) => {
      e.preventDefault();
      const u = U.$("#cUnit").value || app.settings.unit;
      const h = U.$("#cHeight").value.trim();
      Object.assign(c, {
        name: U.$("#cName").value.trim(), code: U.$("#cCode").value.trim(), phone: U.$("#cPhone").value.trim(), designer: U.$("#cDesigner").value.trim(),
        ageGroup: U.$("#cAge").value, age: U.$("#cAgeVal").value.trim(), template: U.$("#cTpl").value, unit: U.$("#cUnit").value,
        heightCm: h ? E.parse(h, u) : null, garment: U.$("#cGarment").value, notes: U.$("#cNotes").value.trim()
      });
      c.consent.photos = U.$("#cConsent").checked;
      c.consent.guardian = { name: U.$("#gName") ? U.$("#gName").value.trim() : "", given: U.$("#gGiven") ? U.$("#gGiven").checked : false };
      if (c.ageGroup !== "child") c.consent.guardian = { name: "", given: false };
      const errs = SM.customers.validate(c);
      if (c.code) { const dup = (await SM.customers.list()).find((x) => x.code === c.code && x.id !== c.id); if (dup) errs.push(t("Customer ID {id} is already used by {n}.", { id: c.code, n: dup.name })); }
      if (errs.length) { const b = U.$("#formErr"); b.hidden = false; b.innerHTML = `${SM.icon("warn")}<div>${errs.map(U.esc).join("<br>")}</div>`; b.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
      await SM.customers.save(c);
      await SM.db.log((isNew ? "Created " : "Updated ") + c.name, c.id);
      app.state.customerId = c.id;
      U.toast(isNew ? t("Profile created: {code}", { code: c.code }) : t("Changes saved"));
      if (returnTo === "scan") { const w = await SM.db.setting("wizard", null); if (w) { w.customerId = c.id; w.step = Math.max(1, w.step); await SM.db.setSetting("wizard", w); } app.go("#/scan"); } else app.go("#/customer/" + c.id);
    };
  }
  SM.views["new-customer"] = async (el, args) => form(el, SM.customers.blank(), true, args[0]);
  SM.views["edit-customer"] = async (el, args) => { const c = await SM.customers.get(args[0]); if (!c) return app.go("#/customers"); form(el, c, false); };

  /* ---------- detail ---------- */
  SM.views.customer = async function (el, args) {
    const c = await SM.customers.get(args[0]);
    if (!c) { el.innerHTML = `<div class="empty">${t("Customer not found.")}</div>`; return; }
    app.state.customerId = c.id;
    const [sessions, photos, templates] = await Promise.all([SM.customers.sessions(c.id), SM.customers.photos(c.id), app.templatesAll()]);
    const unit = app.unit(c);
    el.innerHTML = app.head({ eyebrow: c.code + (c.sample ? " · " + t("Sample") : ""), title: c.name, sub: [t(SM.customers.TEMPLATES[c.template] || ""), c.ageGroup === "child" ? t("Child") + (c.age ? " · " + U.esc(c.age) : "") : (c.age ? U.esc(c.age) : ""), c.heightCm ? t("Height") + " " + E.format(c.heightCm, unit) + " " + E.unitLabel(unit) : "", c.phone ? U.esc(c.phone) : ""].filter(Boolean).join(" · "),
      actions: `<a class="btn" href="#/edit-customer/${c.id}">${SM.icon("edit")}${t("Edit")}</a><button class="btn primary" data-newm>${SM.icon("plus")}${t("New measurement")}</button>` }) + `
      <div class="stack">
        ${!c.consent.photos ? `<div class="notice">${SM.icon("shield")}<div>${t("No photo consent recorded. Photos can be analysed but will not be stored for this customer.")} <a href="#/edit-customer/${c.id}">${t("Update consent")}</a></div></div>` : ""}
        <div class="tiles">
          <button class="tile" data-scan>${SM.icon("scan")}<span>${t("Guided scan")}<small>${t("Camera with body outline")}</small></span></button>
          <button class="tile" data-cam>${SM.icon("camera")}<span>${t("Take photo")}<small>${t("Quick capture")}</small></span></button>
          <button class="tile" data-dup>${SM.icon("copy")}<span>${t("Duplicate")}<small>${t("Copy profile & latest values")}</small></span></button>
          <button class="tile" data-exp>${SM.icon("download")}<span>${t("Export profile")}<small>${t("JSON with photos")}</small></span></button>
        </div>
        <section class="card">
          <div class="card-head"><h2>${t("Measurement history")}</h2>${sessions.length > 1 ? `<a class="btn sm" href="#/compare/${c.id}">${SM.icon("compare")}${t("Compare")}</a>` : ""}</div>
          ${sessions.length ? `<div class="list">${sessions.map((s) => {
            const tpl = templates.find((x) => x.id === s.templateId);
            const sum = E.summary(s, app.sessionIds(s, tpl));
            return `<a class="list-item" href="#/session/${s.id}"><span class="avatar">${SM.icon("tape")}</span><span class="main"><span class="t">${U.esc(tpl ? tpl.name : t("Custom"))} · ${U.esc(U.fmtDate(s.date))}</span>
              <span class="s">${sum.done}/${sum.total} ${t("recorded")}${sum.verify ? " · " + sum.verify + " " + t("to verify") : ""}${sum.verified ? " · " + sum.verified + " " + t("verified") : ""}</span>
              <span class="progress" style="margin-top:6px"><span style="width:${sum.total ? Math.round(sum.done / sum.total * 100) : 0}%"></span></span></span>${SM.icon("chevron")}</a>`;
          }).join("")}</div>` : `<div class="empty">${SM.icon("tape")}<p>${t("No measurements yet. Start with a garment template.")}</p></div>`}
        </section>
        <section class="card">
          <div class="card-head"><h2>${t("Photos")}</h2><span class="muted small">${photos.length}</span></div>
          ${photos.length ? `<div class="photo-grid" data-photos></div>` : `<p class="muted">${t("No photos stored for this customer.")}</p>`}
        </section>
        ${c.notes ? `<section class="card"><h3>${t("Notes")}</h3><p style="margin-top:8px">${U.esc(c.notes)}</p></section>` : ""}
        <section class="card">
          <div class="card-head"><h2>${t("Delete customer")}</h2></div>
          <p class="muted small">${t("Removes this profile, all measurement records and all stored photos from this device. This cannot be undone. Export a copy first if you may need it.")}</p>
          <div class="btn-row" style="margin-top:10px"><button class="btn danger" data-del>${SM.icon("trash")}${t("Delete customer and data")}</button></div>
        </section>
      </div>`;
    const grid = U.$("[data-photos]", el);
    if (grid) photos.forEach((p) => {
      const a = document.createElement("a"); a.className = "photo-card"; a.href = "#/photos/" + p.id;
      a.innerHTML = `<img src="${URL.createObjectURL(p.thumb || p.blob)}" alt=""><span class="cap">${t(SM.overlays.VIEWS[p.view] ? SM.overlays.VIEWS[p.view].name : "Photo")} · ${U.esc(U.fmtDate(p.createdAt))}</span>`;
      grid.appendChild(a);
    });
    U.$("[data-newm]", el).onclick = () => chooseTemplate(c);
    U.$("[data-scan]", el).onclick = () => { app.state.customerId = c.id; SM.wizard.start({ customerId: c.id }); };
    U.$("[data-cam]", el).onclick = () => { app.state.customerId = c.id; app.go("#/camera"); };
    U.$("[data-dup]", el).onclick = async () => { const d = await SM.customers.duplicate(c.id); await SM.db.log("Duplicated " + c.name, d.id); U.toast(t("Duplicate created: {code}", { code: d.code })); app.go("#/customer/" + d.id); };
    U.$("[data-exp]", el).onclick = async () => {
      const data = await SM.backup.build({ customerId: c.id });
      const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
      await app.deliver(blob, U.safeName(c.code + "_" + c.name) + "_profile.json", "saveas");
    };
    U.$("[data-del]", el).onclick = async () => {
      if (!(await U.confirm({ title: t("Delete {n}?", { n: c.name }), message: t("This permanently removes the profile, {s} measurement record(s) and {p} photo(s) from this device.", { s: sessions.length, p: photos.length }), ok: t("Delete permanently"), danger: true }))) return;
      await SM.customers.remove(c.id); await SM.db.log("Deleted customer " + c.code);
      U.toast(t("Customer deleted")); app.go("#/customers");
    };
  };

  /* choose a garment template then open a session */
  async function chooseTemplate(c, then) {
    const templates = await app.templatesAll();
    const group = SM.templates.suggestedGroup(c.template);
    const order = [group].concat(SM.templates.GROUPS.filter((g) => g !== group));
    const s = U.sheet({
      title: t("Choose garment"), html: `${c.garment ? `<button class="list-item" data-t="${c.garment}"><span class="avatar">${SM.icon("star")}</span><span class="main"><span class="t">${U.esc((templates.find((x) => x.id === c.garment) || {}).name || "")}</span><span class="s">${t("Customer's garment category")}</span></span></button>` : ""}
      ${order.map((g) => { const list = templates.filter((x) => x.group === g); return list.length ? `<h3>${t(g)}</h3><div class="choice-grid">${list.map((x) => `<button class="choice" data-t="${x.id}"><b>${U.esc(x.name)}</b><small>${SM.templates.items(x).length} ${t("measurements")}</small></button>`).join("")}</div>` : ""; }).join("")}`
    });
    s.el.onclick = async (e) => {
      const b = e.target.closest("[data-t]"); if (!b) return;
      s.close();
      const ses = await app.ensureSession(c.id, b.dataset.t);
      if (then) then(ses); else app.go("#/session/" + ses.id);
    };
  }
  SM.app.chooseTemplate = chooseTemplate;

  /* ---------- compare history ---------- */
  SM.views.compare = async function (el, args) {
    const c = await SM.customers.get(args[0]); if (!c) return app.go("#/customers");
    const sessions = await SM.customers.sessions(c.id);
    if (sessions.length < 2) { el.innerHTML = app.head({ title: t("Compare") }) + `<div class="empty">${t("At least two measurement records are needed.")}</div>`; return; }
    const unit = app.unit(c);
    const st = app._cmp && app._cmp.cid === c.id ? app._cmp : (app._cmp = { cid: c.id, a: sessions[1].id, b: sessions[0].id });
    const A = sessions.find((s) => s.id === st.a) || sessions[1], B = sessions.find((s) => s.id === st.b) || sessions[0];
    const ids = Array.from(new Set(Object.keys(A.items).concat(Object.keys(B.items)))).filter((id) => (A.items[id] && A.items[id].value != null) || (B.items[id] && B.items[id].value != null));
    const rows = E.compare(A, B, ids);
    const opt = (sel) => sessions.map((s) => `<option value="${s.id}" ${s.id === sel ? "selected" : ""}>${U.esc(U.fmtDate(s.date))} · ${U.esc(((SM.templates.builtin.find((x) => x.id === s.templateId)) || {}).name || t("Custom"))}</option>`).join("");
    el.innerHTML = app.head({ eyebrow: c.name, title: t("Compare measurements"), actions: `<a class="btn" href="#/customer/${c.id}">${SM.icon("back")}${t("Back")}</a>` }) + `
      <div class="card stack">
        <div class="form-grid"><label class="field">${t("Older record")}<select id="cmpA">${opt(A.id)}</select></label><label class="field">${t("Newer record")}<select id="cmpB">${opt(B.id)}</select></label></div>
        <div class="rep-scroll"><table class="rep-table" style="color:var(--ink)"><thead><tr><th>${t("Measurement")}</th><th class="num">${U.esc(U.fmtDate(A.date))}</th><th class="num">${U.esc(U.fmtDate(B.date))}</th><th class="num">${t("Change")} (${E.unitLabel(unit)})</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>${U.esc(SM.catalog.name(r.id))}</td><td class="num">${E.format(r.a, unit, r.id)}</td><td class="num">${E.format(r.b, unit, r.id)}</td><td class="num" style="color:${r.diff > 0 ? "var(--warn)" : r.diff < 0 ? "var(--teal)" : "inherit"}">${r.diff == null ? "–" : (r.diff > 0 ? "+" : "") + E.format(Math.abs(r.diff), unit, r.id).replace(/^/, r.diff < 0 ? "−" : "")}</td></tr>`).join("")}</tbody></table></div>
      </div>`;
    U.$("#cmpA").onchange = (e) => { st.a = e.target.value; app.rerender(); };
    U.$("#cmpB").onchange = (e) => { st.b = e.target.value; app.rerender(); };
  };
})();

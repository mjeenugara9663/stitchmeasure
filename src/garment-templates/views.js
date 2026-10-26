/* Garment template screens: browse built-ins, customise copies, edit custom templates. */
(function () {
  "use strict";
  const SM = window.SM, U = SM.util, t = SM.t, app = SM.app;

  SM.views.templates = async function (el) {
    const all = await app.templatesAll();
    el.innerHTML = app.head({ title: t("Garment templates"), sub: t("Each template generates a measurement checklist. Built-in templates can be copied and customised: add, remove, rename and reorder measurements."), actions: `<button class="btn primary" data-new>${SM.icon("plus")}${t("New custom template")}</button>` }) +
      `<div class="stack">${SM.templates.GROUPS.map((g) => { const list = all.filter((x) => x.group === g); return list.length ? `<section class="stack-sm"><h3>${t(g)}</h3><div class="choice-grid">${list.map((x) => `<a class="choice" href="#/template/${x.id}" style="text-decoration:none"><b>${U.esc(x.name)}</b><small>${SM.templates.items(x).length} ${t("measurements")} · ${t(SM.templates.FIT[x.fit] || "")}${x.builtin ? "" : " · " + t("custom")}</small></a>`).join("")}</div></section>` : ""; }).join("")}</div>`;
    U.$("[data-new]", el).onclick = async () => {
      const name = await U.prompt({ title: t("New custom template"), label: t("Template name"), ok: t("Create") });
      if (!name) return;
      const tp = { schema: "stitchmeasure.template/1", id: U.uid("tpl"), group: "Custom", name: name.trim(), fit: "semi", items: ["height", "full_chest", "waist", "hip"], labels: {}, customDefs: [], builtin: false };
      await SM.db.put("templates", tp); app.go("#/template/" + tp.id);
    };
  };

  SM.views.template = async function (el, args) {
    const tp = await app.resolveTemplate(args[0]);
    if (!tp) return app.go("#/templates");
    const items = SM.templates.items(tp);
    const name = (id) => (tp.labels && tp.labels[id]) || ((tp.customDefs || []).find((d) => d.id === id) || {}).name || SM.catalog.name(id);
    const editable = !tp.builtin;
    el.innerHTML = app.head({ eyebrow: t(tp.group) + " · " + t(SM.templates.FIT[tp.fit] || ""), title: tp.name, sub: editable ? t("Custom template. Changes save immediately and apply to new and existing records that use it.") : t("Built-in template. Make a copy to change it."),
      actions: `<a class="btn" href="#/templates">${SM.icon("back")}${t("Templates")}</a>${editable ? "" : `<button class="btn" data-copy>${SM.icon("copy")}${t("Customise a copy")}</button>`}<button class="btn primary" data-use>${SM.icon("users")}${t("Use for a customer")}</button>` }) + `
      <div class="stack">
        ${editable ? `<section class="card form-grid"><label class="field">${t("Template name")}<input type="text" id="tpName" value="${U.esc(tp.name)}"></label>
          <label class="field">${t("Fit")}<select id="tpFit">${Object.entries(SM.templates.FIT).map(([k, v]) => `<option value="${k}" ${tp.fit === k ? "selected" : ""}>${t(v)}</option>`).join("")}</select><span class="hint">${t("Sets the repeat-reading tolerance (Settings).")}</span></label></section>` : ""}
        <div class="notice">${SM.icon("info")}<div>${t("Templates list body measurements only. Ease, design and seam allowances are entered separately in each record and are never merged into body values.")}</div></div>
        <div class="list" id="tpList">${items.map((id, i) => `<div class="list-item" style="cursor:default" data-id="${id}">
          <span class="lib-thumb">${SM.catalog.get(id) ? SM.figure.forEntry(SM.catalog.get(id), "adult") : SM.icon("tape")}</span>
          <span class="main"><span class="t">${i + 1}. ${U.esc(name(id))}</span><span class="s">${SM.catalog.get(id) ? t(SM.catalog.KIND_LABEL[SM.catalog.get(id).kind]) + (tp.labels && tp.labels[id] ? " · " + t("library:") + " " + U.esc(SM.catalog.name(id)) : "") : t("Custom measurement")}</span></span>
          ${editable ? `<span class="row" style="flex-wrap:nowrap;gap:2px"><button class="icon-btn" data-up ${i === 0 ? "disabled" : ""} aria-label="${t("Move up")}" style="transform:rotate(-90deg)">${SM.icon("chevron")}</button><button class="icon-btn" data-down ${i === items.length - 1 ? "disabled" : ""} aria-label="${t("Move down")}" style="transform:rotate(90deg)">${SM.icon("chevron")}</button><button class="icon-btn" data-rename aria-label="${t("Rename")}">${SM.icon("edit")}</button><button class="icon-btn" data-rm aria-label="${t("Remove")}">${SM.icon("trash")}</button></span>` : SM.catalog.get(id) ? `<a class="icon-btn" href="#/measure/${id}" aria-label="${t("Instructions")}">${SM.icon("info")}</a>` : ""}
        </div>`).join("")}</div>
        ${editable ? `<div class="btn-row"><button class="btn" data-add>${SM.icon("plus")}${t("Add from library")}</button><button class="btn" data-addc>${SM.icon("plus")}${t("Add custom measurement")}</button><button class="btn danger" data-del>${SM.icon("trash")}${t("Delete template")}</button></div>` : ""}
      </div>`;
    const save = async () => { await SM.db.put("templates", tp); app.rerender(); };
    if (editable) {
      U.$("#tpName").onchange = (e) => { tp.name = e.target.value.trim() || tp.name; SM.db.put("templates", tp); };
      U.$("#tpFit").onchange = (e) => { tp.fit = e.target.value; SM.db.put("templates", tp); };
      U.$("#tpList").onclick = async (e) => {
        const row = e.target.closest("[data-id]"); if (!row) return;
        const id = row.dataset.id, i = tp.items.indexOf(id);
        if (e.target.closest("[data-up]") && i > 0) { tp.items.splice(i, 1); tp.items.splice(i - 1, 0, id); save(); }
        else if (e.target.closest("[data-down]") && i < tp.items.length - 1) { tp.items.splice(i, 1); tp.items.splice(i + 1, 0, id); save(); }
        else if (e.target.closest("[data-rm]")) { tp.items.splice(i, 1); save(); }
        else if (e.target.closest("[data-rename]")) {
          const n = await U.prompt({ title: t("Rename measurement"), label: t("Name shown in this template"), value: name(id) });
          if (n == null) return; tp.labels = tp.labels || {};
          const cd = (tp.customDefs || []).find((d) => d.id === id);
          if (cd) cd.name = n.trim(); else if (n.trim() && n.trim() !== SM.catalog.name(id)) tp.labels[id] = n.trim(); else delete tp.labels[id];
          save();
        }
      };
      U.$("[data-add]", el).onclick = () => {
        const sh = U.sheet({ title: t("Add from library"), html: `<div class="search">${SM.icon("search")}<input type="search" data-q placeholder="${t("Search")}"></div><div class="list" data-l></div>` });
        const draw = (q) => { q = (q || "").toLowerCase(); sh.el.querySelector("[data-l]").innerHTML = SM.catalog.all.filter((x) => !tp.items.includes(x.id) && (!q || SM.catalog.name(x.id).toLowerCase().includes(q))).map((x) => `<button class="list-item" data-p="${x.id}"><span class="main"><span class="t">${U.esc(SM.catalog.name(x.id))}</span><span class="s">${t((SM.catalog.REGIONS.find((r) => r.id === x.region) || {}).name)}</span></span>${SM.icon("plus")}</button>`).join(""); };
        draw(""); sh.el.querySelector("[data-q]").oninput = (e) => draw(e.target.value);
        sh.el.querySelector("[data-l]").onclick = (e) => { const b = e.target.closest("[data-p]"); if (!b) return; tp.items.push(b.dataset.p); b.remove(); SM.db.put("templates", tp); };
        sh.root.addEventListener("click", (e) => { if (e.target === sh.root || e.target.closest("[data-close]")) app.rerender(); });
      };
      U.$("[data-addc]", el).onclick = async () => {
        const n = await U.prompt({ title: t("Custom measurement"), label: t("Measurement name"), ok: t("Add") });
        if (!n || !n.trim()) return;
        const id = "c_" + U.uid("m").slice(2);
        tp.customDefs = (tp.customDefs || []).concat([{ id, name: n.trim() }]); tp.items.push(id); save();
      };
      U.$("[data-del]", el).onclick = async () => {
        if (!(await U.confirm({ title: t("Delete template?"), message: t("Existing measurement records keep their values; they will show items from the library list."), ok: t("Delete"), danger: true }))) return;
        await SM.db.del("templates", tp.id); app.go("#/templates");
      };
    } else {
      U.$("[data-copy]", el).onclick = async () => {
        const cp = { schema: "stitchmeasure.template/1", id: U.uid("tpl"), group: "Custom", name: tp.name + " (custom)", fit: tp.fit, items: items.slice(), labels: {}, customDefs: [], builtin: false, basedOn: tp.id };
        await SM.db.put("templates", cp); U.toast(t("Copy created. You can now edit it.")); app.go("#/template/" + cp.id);
      };
    }
    U.$("[data-use]", el).onclick = async () => {
      const c = await app.pickCustomer(); if (!c) return;
      const s = await app.ensureSession(c.id, tp.id); app.go("#/session/" + s.id);
    };
  };
})();

/* App shell: router, navigation, shared helpers. Screens register in SM.views. */
(function (root) {
  "use strict";
  const SM = root.SM;
  const U = SM.util, t = SM.t;
  SM.views = SM.views || {};

  const TITLES = {
    dashboard: "Dashboard", "new-customer": "New customer", customers: "Saved profiles", customer: "Customer", "edit-customer": "Edit customer",
    session: "Measurements", scan: "Body scanner", library: "Measurement library", measure: "Measurement", templates: "Garment templates",
    template: "Template", reports: "Reports", report: "Report", settings: "Settings", more: "More", photos: "Photo library", compare: "Compare", poses: "Pose references"
  };

  const app = {
    get settings() { return SM.settings.values; },
    route: { name: "dashboard", args: [] },
    state: { customerId: null }, // currently selected customer (for camera saves)

    /* templates: built-in + custom (IndexedDB) */
    async templatesAll() {
      const custom = await SM.db.all("templates");
      return SM.templates.builtin.concat(custom.sort((a, b) => (a.name || "").localeCompare(b.name || "")));
    },
    async resolveTemplate(id) {
      if (!id) return null;
      const b = SM.templates.builtin.find((x) => x.id === id);
      return b || (await SM.db.get("templates", id));
    },
    /* ordered measurement ids for a session (template list + session custom items) */
    sessionIds(session, template) {
      let ids = session.order && session.order.length ? session.order.slice() : SM.templates.items(template).slice();
      (session.customDefs || []).forEach((d) => { if (!ids.includes(d.id)) ids.push(d.id); });
      Object.keys(session.items || {}).forEach((id) => { if (!ids.includes(id) && session.items[id].value != null) ids.push(id); });
      return ids;
    },
    itemName(id, session, template) {
      if (template && template.labels && template.labels[id]) return template.labels[id];
      const d = session && (session.customDefs || []).find((x) => x.id === id);
      if (d) return d.name;
      const tdef = template && (template.customDefs || []).find((x) => x.id === id);
      if (tdef) return tdef.name;
      return SM.catalog.name(id);
    },
    unit(customer) { return (customer && customer.unit) || app.settings.unit || "cm"; },
    initials(name) { return (name || "?").split(/\s+/).filter((w) => /^\p{L}/u.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join(""); },

    go(hash) { if (location.hash === hash) app.render(); else location.hash = hash; },
    async render() {
      const raw = (location.hash || "#/").replace(/^#\/?/, "").split("#")[0];
      const parts = raw.split("/").filter(Boolean).map(decodeURIComponent);
      const name = parts[0] || "dashboard";
      const view = SM.views[name] ? name : "dashboard";
      app.route = { name: view, args: parts.slice(1) };
      U.$$("[data-nav]").forEach((a) => {
        const n = a.getAttribute("data-nav");
        const on = n === view || (n === "customers" && ["customer", "edit-customer", "session", "compare"].includes(view)) ||
          (n === "library" && ["measure", "poses"].includes(view)) || (n === "templates" && view === "template") ||
          (n === "reports" && view === "report") || (n === "more" && ["more", "templates", "template", "reports", "report", "settings", "photos", "new-customer"].includes(view) && !U.$(".sidebar").offsetParent);
        a.classList.toggle("on", on);
        if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
      });
      U.$("#topTitle").textContent = t(TITLES[view] || "StitchMeasure AI");
      const el = U.$("#view");
      el.innerHTML = "";
      try { await SM.views[view](el, app.route.args); }
      catch (e) { console.error(e); el.innerHTML = `<div class="notice danger">${SM.icon("warn")}<div><b>${t("Something went wrong on this screen.")}</b><br>${U.esc(e.message)}</div></div>`; }
      if (!app._noScroll) root.scrollTo(0, 0);
      app._noScroll = false;
    },
    rerender() { app._noScroll = true; return app.render(); },

    statusChip(status) { return `<span class="chip st-${status}">${t(SM.engine.STATUS[status] || status)}</span>`; },

    /* page header helper */
    head(opts) {
      return `<header class="page-head"><div>${opts.eyebrow ? `<div class="eyebrow">${U.esc(opts.eyebrow)}</div>` : ""}<h1>${U.esc(opts.title)}</h1>${opts.sub ? `<p>${opts.sub}</p>` : ""}</div>${opts.actions ? `<div class="btn-row">${opts.actions}</div>` : ""}</header>`;
    },

    /* offline readiness */
    async offlineStatus() {
      const s = { protocol: location.protocol, sw: "unsupported", online: navigator.onLine, secure: !!root.isSecureContext };
      if (location.protocol === "file:" || window.SM_SINGLE_FILE) s.sw = "file";
      else if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration().catch(() => null);
        s.sw = reg && reg.active ? (navigator.serviceWorker.controller ? "ready" : "installed") : "installing";
      }
      s.ready = s.sw === "ready" || s.sw === "installed";
      return s;
    },
    async updateStatusPills() {
      const s = await app.offlineStatus();
      const pill = U.$("#topStatus"), side = U.$("#sideStatus");
      let cls = "", text;
      if (s.sw === "file") { cls = "off"; text = t("Opened as file"); }
      else if (s.ready) { cls = "ready"; text = s.online ? t("Offline ready") : t("Offline mode"); }
      else if (s.sw === "unsupported") { cls = "off"; text = t("No offline cache"); }
      else text = t("Preparing offline");
      if (pill) { pill.className = "status-pill " + cls; pill.innerHTML = `<span class="dot"></span><span>${text}</span>`; }
      if (side) side.innerHTML = `<span class="status-pill ${cls}"><span class="dot"></span><span>${text}</span></span><div style="margin-top:8px">${t("Data stays on this device.")}</div>`;
    },

    /* pick a customer (sheet). Resolves to customer or null */
    pickCustomer(opts) {
      opts = opts || {};
      return new Promise(async (resolve) => {
        const list = await SM.customers.list();
        let chosen = null;
        const s = U.sheet({
          title: opts.title || t("Select customer"),
          html: `<div class="search">${SM.icon("search")}<input type="search" placeholder="${t("Search name, ID or phone")}" data-q></div>
            <div class="list" data-list></div>
            <a class="btn primary" href="#/new-customer${opts.returnTo ? "/" + encodeURIComponent(opts.returnTo) : ""}" data-new>${SM.icon("userPlus")}${t("New customer")}</a>`,
          onClose: () => resolve(chosen)
        });
        const draw = (q) => {
          q = (q || "").toLowerCase();
          const rows = list.filter((c) => !q || [c.name, c.code, c.phone].join(" ").toLowerCase().includes(q));
          s.el.querySelector("[data-list]").innerHTML = rows.length ? rows.map((c) => `<button class="list-item" data-id="${c.id}"><span class="avatar">${U.esc(app.initials(c.name))}</span><span class="main"><span class="t">${U.esc(c.name)}</span><span class="s">${U.esc(c.code)} · ${t(SM.customers.TEMPLATES[c.template] || "")}</span></span>${SM.icon("chevron")}</button>`).join("") : `<div class="empty">${t("No saved customers yet.")}</div>`;
        };
        draw("");
        s.el.querySelector("[data-q]").oninput = (e) => draw(e.target.value);
        s.el.querySelector("[data-list]").onclick = (e) => { const b = e.target.closest("[data-id]"); if (!b) return; chosen = list.find((c) => c.id === b.dataset.id); s.close(); };
        s.el.querySelector("[data-new]").onclick = () => s.close();
      });
    },

    /* create or reuse the latest open session for a customer + template */
    async ensureSession(customerId, templateId) {
      const list = await SM.customers.sessions(customerId);
      const today = U.todayISO();
      let s = list.find((x) => x.templateId === templateId && x.date === today);
      if (!s) { s = SM.engine.newSession(customerId, templateId, app.settings.designer); s.seamAllowanceCm = app.settings.seamAllowanceCm; await SM.db.put("sessions", s); }
      return s;
    },

    async saveSession(s) { s.updatedAt = new Date().toISOString(); await SM.db.put("sessions", s); const c = await SM.db.get("customers", s.customerId); if (c) { c.updatedAt = s.updatedAt; await SM.db.put("customers", c); } },

    /* save a blob (report, backup) with the honest platform message */
    async deliver(blob, name, mode) {
      let r;
      if (mode === "share") r = await SM.photoExport.share(blob, name);
      else if (mode === "saveas") { r = await SM.photoExport.saveAs(blob, name); if (r.unsupported) r = await SM.photoExport.download(blob, name); }
      else r = await SM.photoExport.download(blob, name);
      U.toast(r.message, r.done ? "" : r.unsupported ? "err" : "");
      return r;
    }
  };
  SM.app = app;
})(window);

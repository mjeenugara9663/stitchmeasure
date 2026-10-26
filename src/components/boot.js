/* Start-up: settings, app lock, privacy notice, service worker, router. */
(function () {
  "use strict";
  const SM = window.SM, U = SM.util, t = SM.t, app = SM.app;

  U.$$("[data-ic]").forEach((n) => { n.outerHTML = SM.icon(n.getAttribute("data-ic")); });

  function lockScreen() {
    return new Promise((resolve) => {
      const d = document.createElement("div");
      d.className = "lock";
      d.innerHTML = `<form><img src="public/icons/icon-192.png" alt="" width="72" height="72"><h1 style="color:#fff">StitchMeasure</h1><p style="color:#58F0C5;font-weight:700;letter-spacing:.24em;font-size:11px">BY VRISAMA</p><p style="color:#B9C0E1">${t("Enter your PIN")}</p>
        <input type="password" inputmode="numeric" autocomplete="off" maxlength="8" aria-label="PIN" required><button class="btn primary block">${t("Unlock")}</button><p data-err style="color:#EE7B72" hidden>${t("Wrong PIN.")}</p></form>`;
      document.body.appendChild(d);
      const inp = d.querySelector("input"); setTimeout(() => inp.focus(), 50);
      d.querySelector("form").onsubmit = async (e) => {
        e.preventDefault();
        if (await SM.settings.checkPin(inp.value)) { d.remove(); resolve(); }
        else { d.querySelector("[data-err]").hidden = false; inp.value = ""; }
      };
    });
  }

  function privacyFirstRun() {
    return new Promise((resolve) => {
      const s = U.sheet({ title: t("Welcome to StitchMeasure by Vrisama"), html: `
        <p class="lead">${t("A measurement studio that works offline. Before you start:")}</p>
        <ul class="stack-sm" style="margin:0;padding-left:18px">${SM.PRIVACY.map((p) => `<li>${t(p)}</li>`).join("")}</ul>
        <div class="notice warn">${SM.icon("warn")}<div>${t("A phone camera cannot guarantee exact measurements. Values from photos are approximate and fit-critical measurements must be checked with a measuring tape.")}</div></div>
        <div class="btn-row end"><button class="btn primary" data-ok>${t("I understand")}</button></div>`, onClose: resolve });
      s.el.querySelector("[data-ok]").onclick = async () => { await SM.settings.set("privacyAccepted", true); s.close(); };
    });
  }

  SM.privacyFirstRun = privacyFirstRun;
  async function boot() {
    await SM.db.open();
    await SM.settings.load();
    SM.i18n.set(app.settings.language || "en");
    if (app.settings.pinEnabled) await lockScreen();
    window.addEventListener("hashchange", () => app.render());
    await app.render();

    if (!window.SM_SINGLE_FILE && "serviceWorker" in navigator && location.protocol !== "file:") {
      try {
        await navigator.serviceWorker.register("service-worker.js");
        navigator.serviceWorker.addEventListener("controllerchange", () => app.updateStatusPills());
        navigator.serviceWorker.ready.then(() => app.updateStatusPills());
      } catch (e) { console.warn("Service worker registration failed", e); }
    }
    app.updateStatusPills();
    window.addEventListener("online", () => app.updateStatusPills());
    window.addEventListener("offline", () => app.updateStatusPills());
    window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); app.installPrompt = e; });
    window.addEventListener("appinstalled", () => { SM.db.persist(); U.toast(t("Installed. StitchMeasure now opens without internet.")); });
    if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => SM.settings.applyTheme());
  }
  boot().catch((e) => {
    console.error(e);
    document.getElementById("view").innerHTML = `<div class="notice danger">${SM.icon("warn")}<div><b>StitchMeasure by Vrisama could not start.</b><br>${U.esc(e.message)}</div></div>`;
  });
})();

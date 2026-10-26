/* Settings screen: preferences, calibration defaults, privacy, storage, backup. */
(function () {
  "use strict";
  const SM = window.SM, U = SM.util, t = SM.t, app = SM.app, S = SM.settings;

  const PRIVACY = [
    "All customer data, measurements and photos are stored only in this browser on this device.",
    "Photos are processed on the device. Nothing is uploaded, and there is no analytics or tracking.",
    "The camera is used only while the camera screen is open.",
    "Browser storage can be cleared by you, the browser or the operating system (for example when space runs low). Make regular backups.",
    "Browser storage is not encrypted by the app. Anyone who can unlock this device and open the browser could see the data. The optional app lock only deters casual access; use the phone's own screen lock.",
    "Backups can be encrypted with a password. Without the password an encrypted backup cannot be restored."
  ];
  SM.PRIVACY = PRIVACY;

  SM.views.settings = async function (el) {
    const v = S.values;
    const est = await SM.db.estimate();
    const persisted = await SM.db.persisted();
    const pose = await SM.pose.check();
    const counts = { customers: (await SM.db.all("customers")).length, photos: (await SM.db.all("photos")).length, sessions: (await SM.db.all("sessions")).length, samples: (await SM.db.all("customers")).filter((c) => c.sample).length };
    const status = await app.offlineStatus();
    el.innerHTML = app.head({ title: t("Settings") }) + `
      <div class="stack">
        <section class="card stack" id="general"><h2>${t("General")}</h2>
          <div class="form-grid">
            <label class="field">${t("Default unit")}<select data-s="unit">${Object.keys(SM.engine.UNITS).map((u) => `<option value="${u}" ${v.unit === u ? "selected" : ""}>${u === "cm" ? t("Centimetres (cm)") : u === "mm" ? t("Millimetres (mm)") : t("Inches (in)")}</option>`).join("")}</select></label>
            <label class="field">${t("Theme")}<select data-s="theme">${[["system", "Match device"], ["light", "Light"], ["dark", "Dark"]].map(([k, n]) => `<option value="${k}" ${v.theme === k ? "selected" : ""}>${t(n)}</option>`).join("")}</select></label>
            <label class="field">${t("Language")}<select data-s="language">${SM.i18n.languages().map((l) => `<option value="${l}" ${v.language === l ? "selected" : ""}>${l === "en" ? "English" : l}</option>`).join("")}</select><span class="hint">${t("Kannada, Hindi, Telugu and Tamil can be added as translation files.")}</span></label>
            <label class="field">${t("Tailor / designer name")}<input type="text" data-s="designer" value="${U.esc(v.designer)}"></label>
          </div>
        </section>

        <section class="card stack" id="camera"><h2>${t("Camera & overlay defaults")}</h2>
          <div class="form-grid">
            <label class="field">${t("Countdown timer")}<select data-s="countdown" data-num>${[0, 3, 5, 10].map((n) => `<option value="${n}" ${+v.countdown === n ? "selected" : ""}>${n ? n + " s" : t("Off")}</option>`).join("")}</select></label>
            <label class="field">${t("Grid density")} (${t("columns")})<input type="number" min="3" max="24" data-s="gridDensity" data-num value="${v.gridDensity}"></label>
            <label class="field">${t("Outline opacity")} (%)<input type="number" min="5" max="100" data-s="overlayOpacity" data-pct value="${Math.round(v.overlayOpacity * 100)}"></label>
          </div>
          <label class="check"><input type="checkbox" data-s="mirrorFront" ${v.mirrorFront ? "checked" : ""}><span>${t("Mirror the preview when using the front (selfie) camera. Saved photos are never mirrored.")}</span></label>
          <p class="muted small">${t("Camera")}: ${SM.camera.support().ok ? t("available in this context") : U.esc(SM.camera.support().reason)}</p>
        </section>

        <section class="card stack" id="calibration"><h2>${t("Calibration & tolerances")}</h2>
          <p class="lead">${t("Photo values are shown in physical units only after a photo passes calibration. Methods:")}</p>
          <dl class="kv">${Object.entries(SM.calibration.METHODS).map(([k, m]) => `<dt>${t(m.name)}</dt><dd>${t(m.hint)}</dd>`).join("")}</dl>
          <div class="btn-row"><button class="btn" data-marker>${SM.icon("download")}${t("Printable 100 mm marker")}</button></div>
          <h3>${t("Repeat-reading tolerance")}</h3>
          <p class="muted small">${t("If repeated readings of one measurement differ by more than this, the value is flagged as inconsistent.")}</p>
          <div class="form-grid">${Object.entries(SM.templates.FIT).map(([k, n]) => `<label class="field">${t(n)} (cm)<input type="number" step="0.1" min="0.1" data-tol="${k}" value="${v.tolerance[k]}"></label>`).join("")}
            <label class="field">${t("Default seam allowance")} (cm)<input type="number" step="0.1" min="0" data-s="seamAllowanceCm" data-num value="${v.seamAllowanceCm}"><span class="hint">${t("Recorded separately; never added to body values.")}</span></label></div>
        </section>

        <section class="card stack" id="privacy"><h2>${t("Privacy & security")}</h2>
          <ul class="stack-sm" style="margin:0;padding-left:18px;color:var(--ink-2)">${PRIVACY.map((p) => `<li>${t(p)}</li>`).join("")}</ul>
          <label class="check"><input type="checkbox" data-s="keepPhotos" ${v.keepPhotos ? "checked" : ""}><span>${t("Store photos with customer profiles. Turn off to analyse photos without keeping them.")}</span></label>
          <div class="row"><b>${t("App lock")}</b> <span class="chip ${v.pinEnabled ? "teal" : ""}">${v.pinEnabled ? t("On") : t("Off")}</span>
            <button class="btn sm" data-pin>${v.pinEnabled ? t("Change PIN") : t("Set a PIN")}</button>${v.pinEnabled ? `<button class="btn sm ghost" data-nopin>${t("Remove PIN")}</button>` : ""}</div>
          <p class="muted small">${t("The PIN is checked when the app opens. It deters casual access only; it does not encrypt stored data.")}</p>
        </section>

        <section class="card stack" id="backup"><h2>${t("Storage & backup")}</h2>
          <dl class="kv">
            <dt>${t("Records")}</dt><dd>${counts.customers} ${t("customers")} · ${counts.sessions} ${t("measurement records")} · ${counts.photos} ${t("photos")}</dd>
            <dt>${t("Space used")}</dt><dd>${est ? U.bytes(est.usage) + " " + t("of about") + " " + U.bytes(est.quota) + " " + t("available to this app") : t("Unknown in this browser")}</dd>
            <dt>${t("Protected storage")}</dt><dd>${persisted ? t("Yes: the browser will not clear it automatically") : t("No: the browser may clear it when space is low")} ${!persisted ? `<button class="btn sm" data-persist>${t("Request protection")}</button>` : ""}</dd>
            <dt>${t("Last backup")}</dt><dd>${v.lastBackupAt ? U.esc(U.fmtDateTime(v.lastBackupAt)) : `<span style="color:var(--warn)">${t("Never")}</span>`}</dd>
          </dl>
          ${est && est.quota && est.usage / est.quota > 0.8 ? `<div class="notice warn">${SM.icon("warn")}<div>${t("Storage is over 80 % full. Back up, then delete old photos.")}</div></div>` : ""}
          <div class="form-grid">
            <label class="check"><input type="checkbox" id="bkPhotos" checked><span>${t("Include photos")}</span></label>
            <label class="field">${t("Password to encrypt (optional)")}<input type="password" id="bkPw" autocomplete="new-password"></label>
          </div>
          <div class="btn-row"><button class="btn primary" data-backup>${SM.icon("download")}${t("Back up to a file")}</button><button class="btn" data-restore>${SM.icon("upload")}${t("Restore from backup")}</button></div>
          <input type="file" id="rsFile" accept=".json,application/json" hidden>
          <div class="divider"></div>
          <div class="btn-row">${counts.samples ? `<button class="btn" data-rmsamples>${t("Remove sample profiles")} (${counts.samples})</button>` : `<button class="btn" data-samples>${t("Load sample profiles")}</button>`}<button class="btn danger" data-wipe>${SM.icon("trash")}${t("Delete all local data")}</button></div>
        </section>

        <section class="card stack" id="about"><h2>${t("Offline app & AI")}</h2>
          <dl class="kv">
            <dt>${t("Offline")}</dt><dd>${status.ready ? t("App files cached; works without internet.") : status.sw === "file" ? t("Opened as a file: not installable. Serve over https or localhost.") : t("Not cached yet. Open the app once while online over https.")}</dd>
            <dt>${t("Install")}</dt><dd><span id="installHint">${t("Android Chrome: menu ⋮ › Install app. iPhone Safari: Share › Add to Home Screen.")}</span> <button class="btn sm" data-install hidden>${t("Install now")}</button></dd>
            <dt>${t("AI body detection")}</dt><dd>${U.esc(t(pose.reason))}</dd>
            <dt>${t("Version")}</dt><dd>${SM.backup.VERSION} · ${t("Phase 1")}</dd>
          </dl>
          <div class="notice">${SM.icon("info")}<div>${t("Measurements from photos are approximate. Circumferences and depths always need a measuring tape. No accuracy figures are claimed until the validation study in docs/measurement-validation.md has been carried out.")}</div></div>
        </section>
      </div>`;

    if (location.hash.includes("#calibration") || location.hash.includes("#backup")) {
      const id = location.hash.split("#").pop(); const n = U.$("#" + id); if (n) setTimeout(() => n.scrollIntoView({ block: "start" }), 50);
    }
    el.addEventListener("change", async (e) => {
      const k = e.target.dataset.s;
      if (k) {
        let val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
        if (e.target.hasAttribute("data-num")) val = +val;
        if (e.target.hasAttribute("data-pct")) val = U.clamp(+val, 5, 100) / 100;
        await S.set(k, val);
        if (k === "language") { SM.i18n.set(val); }
        U.toast(t("Saved"));
      }
      if (e.target.dataset.tol) { const tol = Object.assign({}, S.values.tolerance, { [e.target.dataset.tol]: Math.max(0.1, +e.target.value) }); await S.set("tolerance", tol); U.toast(t("Saved")); }
    });
    U.$("[data-marker]", el).onclick = () => markerDownload(100);
    U.$("[data-pin]", el).onclick = async () => {
      const p1 = await U.prompt({ title: t("Set app PIN"), label: t("4–8 digits"), type: "password" }); if (!p1) return;
      if (!/^\d{4,8}$/.test(p1)) { U.toast(t("Use 4 to 8 digits."), "err"); return; }
      const p2 = await U.prompt({ title: t("Confirm PIN"), label: t("Enter the PIN again"), type: "password" }); if (p1 !== p2) { U.toast(t("PINs did not match."), "err"); return; }
      await S.setPin(p1); U.toast(t("App lock is on.")); app.rerender();
    };
    const np = U.$("[data-nopin]", el); if (np) np.onclick = async () => { await S.setPin(null); U.toast(t("App lock removed.")); app.rerender(); };
    const ps = U.$("[data-persist]", el); if (ps) ps.onclick = async () => { const ok = await SM.db.persist(); U.toast(ok ? t("Storage is now protected.") : t("The browser declined. Installing the app usually allows it.")); app.rerender(); };
    U.$("[data-backup]", el).onclick = async () => {
      const data = await SM.backup.build({ includePhotos: U.$("#bkPhotos").checked });
      const pw = U.$("#bkPw").value;
      let out = data, suffix = "";
      try { if (pw) { out = await SM.backup.encrypt(data, pw); suffix = "_encrypted"; } } catch (e) { U.toast(e.message, "err"); return; }
      const blob = new Blob([JSON.stringify(out)], { type: "application/json" });
      const r = await app.deliver(blob, `StitchMeasure_backup_${U.todayISO()}${suffix}.json`, "saveas");
      if (r.done) { await S.set("lastBackupAt", new Date().toISOString()); await SM.db.log("Backup created"); app.rerender(); }
    };
    U.$("[data-restore]", el).onclick = () => U.$("#rsFile").click();
    U.$("#rsFile").onchange = (e) => app.importFile(e.target.files[0]);
    const sm = U.$("[data-samples]", el); if (sm) sm.onclick = async () => { await SM.samples.load(); U.toast(t("Three sample profiles added.")); app.rerender(); };
    const rs = U.$("[data-rmsamples]", el); if (rs) rs.onclick = async () => { for (const c of (await SM.db.all("customers")).filter((x) => x.sample)) await SM.customers.remove(c.id); U.toast(t("Sample profiles removed.")); app.rerender(); };
    U.$("[data-wipe]", el).onclick = async () => {
      if (!(await U.confirm({ title: t("Delete all local data?"), message: t("Every customer, measurement, photo, template and setting on this device will be erased. Back up first if you need anything."), ok: t("Erase everything"), danger: true }))) return;
      const word = await U.prompt({ title: t("Type DELETE to confirm"), label: t("This cannot be undone."), ok: t("Erase") });
      if (word !== "DELETE") { U.toast(t("Nothing was deleted.")); return; }
      await SM.db.clearAll(); S.values = JSON.parse(JSON.stringify(S.DEFAULTS)); S.applyTheme();
      U.toast(t("All local data deleted.")); app.go("#/");
    };
    const ib = U.$("[data-install]", el);
    if (app.installPrompt) { ib.hidden = false; ib.onclick = async () => { app.installPrompt.prompt(); const r = await app.installPrompt.userChoice; U.toast(r.outcome === "accepted" ? t("Installing…") : t("Install cancelled.")); app.installPrompt = null; ib.hidden = true; }; }
  };

  async function markerDownload(mm) {
    const dpi = 300, px = Math.round(mm / 25.4 * dpi), pad = Math.round(15 / 25.4 * dpi);
    const c = document.createElement("canvas"); c.width = px + pad * 2; c.height = px + pad * 2 + Math.round(20 / 25.4 * dpi);
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = "#000"; x.fillRect(pad, pad, px, px); x.fillStyle = "#fff"; const q = px / 5;
    x.fillRect(pad + q, pad + q, q, q); x.fillRect(pad + 3 * q, pad + q, q, q); x.fillRect(pad + q, pad + 3 * q, 3 * q, q * 0.6);
    x.fillStyle = "#000"; x.font = `${Math.round(dpi / 7)}px sans-serif`;
    x.fillText(`StitchMeasure calibration marker · ${mm} × ${mm} mm · print at 100 % (actual size), check with a ruler`, pad, pad + px + Math.round(dpi / 4));
    const b = await U.canvasToBlob(c, "image/png");
    const r = await SM.photoExport.download(b, `StitchMeasure_marker_${mm}mm_300dpi.png`);
    U.toast(r.message);
  }
})();

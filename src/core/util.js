/* Shared helpers (pure where possible, so tests can load them in Node). */
(function (root) {
  "use strict";
  const SM = (root.SM = root.SM || {});
  const U = (SM.util = {});

  U.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  U.uid = (p) => (p || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  U.pad = (n, l) => String(n).padStart(l || 2, "0");
  U.todayISO = () => { const d = new Date(); return d.getFullYear() + "-" + U.pad(d.getMonth() + 1) + "-" + U.pad(d.getDate()); };
  U.nowISO = () => new Date().toISOString();
  U.fmtDate = (iso) => {
    if (!iso) return "–";
    const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  };
  U.fmtDateTime = (iso) => { const d = new Date(iso); return isNaN(d) ? "–" : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); };
  U.debounce = (fn, ms) => { let t; return function () { clearTimeout(t); const a = arguments; t = setTimeout(() => fn.apply(this, a), ms); }; };
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.bytes = (n) => (n == null ? "–" : n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(0) + " KB" : n < 1073741824 ? (n / 1048576).toFixed(1) + " MB" : (n / 1073741824).toFixed(2) + " GB");
  U.safeName = (s) => String(s || "file").replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "file";
  U.csvCell = (v) => { const s = v == null ? "" : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

  if (typeof document === "undefined") return;

  U.$ = (sel, ctx) => (ctx || document).querySelector(sel);
  U.$$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  /* toast: short status line, never used to claim something that did not happen */
  let toastTimer;
  U.toast = function (msg, kind) {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.className = "toast " + (kind || ""); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3200);
  };

  /* modal sheet. Returns {el, close}. content is HTML string. */
  U.sheet = function (opts) {
    const wrap = document.createElement("div");
    wrap.className = "sheet-wrap";
    wrap.innerHTML = `<div class="sheet ${opts.wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${U.esc(opts.title || "")}">
      <header class="sheet-head"><h2>${U.esc(opts.title || "")}</h2><button class="icon-btn" data-close aria-label="${SM.t("Close")}">${SM.icon("x")}</button></header>
      <div class="sheet-body">${opts.html || ""}</div></div>`;
    document.body.appendChild(wrap);
    document.body.classList.add("no-scroll");
    const close = () => { wrap.remove(); if (!document.querySelector(".sheet-wrap")) document.body.classList.remove("no-scroll"); opts.onClose && opts.onClose(); };
    wrap.addEventListener("click", (e) => { if (e.target === wrap || e.target.closest("[data-close]")) close(); });
    wrap.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    setTimeout(() => { const f = wrap.querySelector("input,select,textarea,button:not([data-close])"); f && f.focus({ preventScroll: true }); }, 30);
    return { el: wrap.querySelector(".sheet-body"), root: wrap, close };
  };

  /* in-page confirmation (browsers' confirm() is avoided for consistent styling) */
  U.confirm = function (opts) {
    return new Promise((resolve) => {
      const s = U.sheet({
        title: opts.title || SM.t("Please confirm"),
        html: `<p class="lead">${U.esc(opts.message || "")}</p>
          <div class="btn-row end"><button class="btn ghost" data-no>${U.esc(opts.cancel || SM.t("Cancel"))}</button>
          <button class="btn ${opts.danger ? "danger" : "primary"}" data-yes>${U.esc(opts.ok || SM.t("Confirm"))}</button></div>`,
        onClose: () => resolve(false)
      });
      s.el.querySelector("[data-no]").onclick = () => s.close();
      s.el.querySelector("[data-yes]").onclick = () => { s.root.remove(); document.body.classList.remove("no-scroll"); resolve(true); };
    });
  };

  U.prompt = function (opts) {
    return new Promise((resolve) => {
      let done = false;
      const s = U.sheet({
        title: opts.title,
        html: `<form class="stack" data-f><label class="field"><span>${U.esc(opts.label || "")}</span>
          <input type="${opts.type || "text"}" value="${U.esc(opts.value || "")}" ${opts.type === "number" ? 'step="any" inputmode="decimal"' : ""} required></label>
          <div class="btn-row end"><button type="button" class="btn ghost" data-close>${SM.t("Cancel")}</button><button class="btn primary">${U.esc(opts.ok || SM.t("Save"))}</button></div></form>`,
        onClose: () => { if (!done) resolve(null); }
      });
      s.el.querySelector("[data-f]").onsubmit = (e) => { e.preventDefault(); done = true; const v = s.el.querySelector("input").value; s.close(); resolve(v); };
    });
  };

  U.readFileAsText = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsText(file); });
  U.blobToDataURL = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  U.dataURLToBlob = (url) => { const [h, b] = url.split(","); const mime = (h.match(/data:([^;]+)/) || [])[1] || "application/octet-stream"; const bin = atob(b); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: mime }); };
  U.loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Image could not be decoded")); i.src = src; });
  U.blobToImage = async (blob) => { const url = URL.createObjectURL(blob); try { return await U.loadImage(url); } finally { setTimeout(() => URL.revokeObjectURL(url), 2000); } };
  U.canvasToBlob = (c, type, q) => new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not encode image"))), type || "image/jpeg", q == null ? 0.9 : q));
})(typeof window !== "undefined" ? window : globalThis);

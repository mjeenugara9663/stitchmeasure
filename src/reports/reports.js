/* Report Generation Service: measurement sheet as print-friendly HTML,
 * PDF (local jsPDF), CSV and JSON. All offline. Unverified camera values and
 * AI estimates are labelled in every format. */
(function (root) {
  "use strict";
  const SM = (root.SM = root.SM || {});
  const esc = (s) => SM.util.esc(s);

  /* gather everything a report needs */
  async function build(sessionId, opts) {
    opts = opts || {};
    const session = await SM.db.get("sessions", sessionId);
    if (!session) throw new Error("Measurement record not found.");
    const customer = await SM.db.get("customers", session.customerId);
    const template = await SM.app.resolveTemplate(session.templateId);
    const ids = SM.app.sessionIds(session, template);
    const unit = opts.unit || (customer && customer.unit) || SM.app.settings.unit || "cm";
    const rows = ids.map((id) => {
      const entry = SM.catalog.get(id);
      const cdef = (session.customDefs || []).find((d) => d.id === id);
      const it = session.items[id] || SM.engine.newItem();
      const label = (template && template.labels && template.labels[id]) || (cdef ? cdef.name : SM.catalog.name(id));
      return {
        id, name: label, kind: entry ? SM.catalog.KIND_LABEL[entry.kind] : "Custom",
        value: it.value, display: SM.engine.format(it.value, unit, id), unit: SM.engine.unitLabel(unit, id),
        source: SM.engine.classification(it), status: SM.engine.STATUS[SM.engine.status(it, entry)],
        needsTape: it.value != null && !it.verified && SM.engine.needsVerification(it, entry),
        readings: (it.readings || []).length,
        ease: it.ease, design: it.design, finished: SM.engine.finished(it),
        verifiedBy: it.verified ? it.verified.by : "", note: it.note || ""
      };
    });
    const history = (await SM.customers.sessions(session.customerId)).filter((s) => s.id !== session.id).slice(0, 4);
    const photos = (await SM.db.where("photos", "sessionId", session.id)).filter((p) => !opts.photoIds || opts.photoIds.includes(p.id));
    return { session, customer, template, rows, unit, history, photos, generatedAt: new Date().toISOString(), designer: session.designer || SM.app.settings.designer || "" };
  }

  function summaryLine(r) {
    const n = r.rows.filter((x) => x.value != null).length;
    const pending = r.rows.filter((x) => x.needsTape).length;
    return `${n} of ${r.rows.length} measurements recorded` + (pending ? ` · ${pending} need tape verification` : "");
  }

  /* HTML report (used on screen and for printing) */
  async function html(r, photoURLs) {
    const c = r.customer || {};
    const seam = r.session.seamAllowanceCm != null ? `${SM.engine.format(r.session.seamAllowanceCm, r.unit)} ${SM.engine.unitLabel(r.unit)}` : "Not set";
    const histIds = r.rows.slice(0, 8).map((x) => x.id);
    const histTable = r.history.length ? `<h3>Measurement history</h3><div class="rep-scroll"><table class="rep-table"><thead><tr><th>Measurement</th><th>This record</th>${r.history.map((h) => `<th>${esc(SM.util.fmtDate(h.date))}</th>`).join("")}</tr></thead><tbody>
      ${histIds.map((id) => { const row = r.rows.find((x) => x.id === id); return `<tr><td>${esc(row.name)}</td><td class="num">${row.display}</td>${r.history.map((h) => `<td class="num">${SM.engine.format(h.items[id] && h.items[id].value, r.unit, id)}</td>`).join("")}</tr>`; }).join("")}</tbody></table></div>` : "";
    return `<article class="report">
      <header class="rep-head">
        <div><div class="rep-brand">Vrisama / StitchMeasure</div><h1>Measurement sheet</h1></div>
        <dl class="rep-meta">
          <div><dt>Customer</dt><dd>${esc(c.name || "–")}</dd></div><div><dt>ID</dt><dd>${esc(c.code || "–")}</dd></div>
          <div><dt>Date</dt><dd>${esc(SM.util.fmtDate(r.session.date))}</dd></div><div><dt>Designer</dt><dd>${esc(r.designer || "–")}</dd></div>
          <div><dt>Garment</dt><dd>${esc(r.template ? r.template.name : "–")}</dd></div><div><dt>Units</dt><dd>${esc(SM.engine.unitLabel(r.unit))}</dd></div>
          ${c.heightCm ? `<div><dt>Height</dt><dd>${SM.engine.format(c.heightCm, r.unit)} ${SM.engine.unitLabel(r.unit)}</dd></div>` : ""}
          <div><dt>Seam allowance</dt><dd>${esc(seam)} <small>(pattern only, not added)</small></dd></div>
        </dl>
      </header>
      <p class="rep-summary">${esc(summaryLine(r))}</p>
      <div class="rep-scroll"><table class="rep-table">
        <thead><tr><th>Measurement</th><th class="num">Body</th><th>Source</th><th>Status</th><th class="num">Ease</th><th class="num">Design</th><th class="num">Finished</th></tr></thead>
        <tbody>${r.rows.map((x) => `<tr class="${x.needsTape ? "flag" : ""}">
          <td>${esc(x.name)}${x.note ? `<div class="rep-note">${esc(x.note)}</div>` : ""}</td>
          <td class="num">${x.display}${x.value != null ? " " + esc(x.unit) : ""}</td>
          <td>${esc(x.source)}${x.readings > 1 ? ` <small>(${x.readings} readings)</small>` : ""}</td>
          <td>${esc(x.status)}${x.needsTape ? ' <strong class="rep-flag">Tape check needed</strong>' : ""}</td>
          <td class="num">${x.ease != null ? SM.engine.format(x.ease, r.unit, x.id) : ""}</td>
          <td class="num">${x.design != null ? SM.engine.format(x.design, r.unit, x.id) : ""}</td>
          <td class="num">${x.finished != null ? SM.engine.format(x.finished, r.unit, x.id) : ""}</td></tr>`).join("")}</tbody>
      </table></div>
      <p class="rep-legend">Body = measurement of the body. Finished = body + ease + design allowance. Seam allowance is listed separately and is not included. Values marked “Tape check needed” come from a camera or an estimate and must be confirmed with a measuring tape before cutting.</p>
      ${r.session.remarks ? `<h3>Tailor remarks</h3><p>${esc(r.session.remarks)}</p>` : ""}
      ${photoURLs && photoURLs.length ? `<h3>Reference photographs</h3><div class="rep-photos">${photoURLs.map((p) => `<figure><img src="${p.url}" alt=""><figcaption>${esc(p.caption)}</figcaption></figure>`).join("")}</div>` : ""}
      ${histTable}
      <footer class="rep-foot">Generated ${esc(SM.util.fmtDateTime(r.generatedAt))} · Measurements from photographs are approximate unless verified with a tape. StitchMeasure by Vrisama · stitchmeasure.vrisama.in</footer>
    </article>`;
  }

  function csv(r) {
    const c = r.customer || {};
    const head = ["Customer", "Customer ID", "Date", "Garment", "Measurement", "Measurement ID", "Body value", "Unit", "Source", "Status", "Tape check needed", "Readings", "Ease", "Design allowance", "Finished", "Verified by", "Note"];
    const lines = [head.map(SM.util.csvCell).join(",")];
    r.rows.forEach((x) => {
      lines.push([c.name, c.code, r.session.date, r.template ? r.template.name : "", x.name, x.id, x.value != null ? SM.engine.format(x.value, r.unit, x.id).replace("°", "") : "", x.unit, x.source, x.status, x.needsTape ? "yes" : "no", x.readings,
        x.ease != null ? SM.engine.format(x.ease, r.unit, x.id) : "", x.design != null ? SM.engine.format(x.design, r.unit, x.id) : "", x.finished != null ? SM.engine.format(x.finished, r.unit, x.id) : "", x.verifiedBy, x.note].map(SM.util.csvCell).join(","));
    });
    return "﻿" + lines.join("\r\n");
  }

  function json(r) {
    return JSON.stringify({
      schema: "stitchmeasure.report/1", generatedAt: r.generatedAt, unitStored: "cm", displayUnit: r.unit,
      customer: r.customer ? { id: r.customer.id, code: r.customer.code, name: r.customer.name, ageGroup: r.customer.ageGroup, template: r.customer.template, heightCm: r.customer.heightCm } : null,
      session: r.session, garment: r.template ? { id: r.template.id, name: r.template.name } : null,
      rows: r.rows.map((x) => ({ id: x.id, name: x.name, valueCm: x.value, source: x.source, status: x.status, needsTapeVerification: x.needsTape, easeCm: x.ease, designCm: x.design, finishedCm: x.finished }))
    }, null, 2);
  }

  async function pdf(r, photoImgs) {
    const J = root.jspdf && root.jspdf.jsPDF;
    if (!J) throw new Error("The PDF library did not load.");
    const doc = new J({ unit: "mm", format: "a4" });
    const W = 210, M = 14; let y = 16;
    const c = r.customer || {};
    const ascii = (s) => String(s == null ? "" : s).replace(/[–—·]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/°/g, " deg").replace(/[^\x20-\x7E]/g, "?");
    doc.setFillColor(11, 16, 40); doc.rect(0, 0, W, 30, "F");
    doc.setTextColor(88, 240, 197); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("VRISAMA  /  STITCHMEASURE", M, 11);
    doc.setTextColor(255, 255, 255); doc.setFontSize(18); doc.text("Measurement sheet", M, 21);
    y = 38; doc.setTextColor(11, 16, 40); doc.setFontSize(9.5); doc.setFont("helvetica", "normal");
    const meta = [["Customer", c.name], ["ID", c.code], ["Date", r.session.date], ["Designer", r.designer || "-"], ["Garment", r.template ? r.template.name : "-"], ["Units", SM.engine.unitLabel(r.unit)], ["Height", c.heightCm ? SM.engine.format(c.heightCm, r.unit) + " " + SM.engine.unitLabel(r.unit) : "-"], ["Seam allowance", r.session.seamAllowanceCm != null ? SM.engine.format(r.session.seamAllowanceCm, r.unit) + " (not added)" : "Not set"]];
    meta.forEach((m, i) => { const col = i % 2, row = Math.floor(i / 2); doc.setFont("helvetica", "bold"); doc.text(ascii(m[0]) + ":", M + col * 92, y + row * 6); doc.setFont("helvetica", "normal"); doc.text(ascii(m[1] || "-"), M + 28 + col * 92, y + row * 6); });
    y += Math.ceil(meta.length / 2) * 6 + 3;
    doc.setFontSize(9); doc.setTextColor(106, 69, 218); doc.text(ascii(summaryLine(r)), M, y); y += 6;
    const cols = [["Measurement", 56], ["Body", 18], ["Source", 40], ["Status", 34], ["Ease", 12], ["Design", 12], ["Finished", 10]];
    const header = () => {
      doc.setFillColor(236, 234, 248); doc.rect(M, y - 4, W - 2 * M, 6.5, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(11, 16, 40);
      let x = M + 1.5; cols.forEach(([t, w]) => { doc.text(t, x, y); x += w; }); y += 6;
    };
    header();
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    r.rows.forEach((x) => {
      if (y > 280) { doc.addPage(); y = 18; header(); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); }
      if (x.needsTape) { doc.setFillColor(253, 243, 224); doc.rect(M, y - 4, W - 2 * M, 6, "F"); }
      const vals = [x.name, x.value != null ? x.display + " " + x.unit : "-", x.source, x.status + (x.needsTape ? " *" : ""), x.ease != null ? SM.engine.format(x.ease, r.unit, x.id) : "", x.design != null ? SM.engine.format(x.design, r.unit, x.id) : "", x.finished != null ? SM.engine.format(x.finished, r.unit, x.id) : ""];
      let cx = M + 1.5; doc.setTextColor(11, 16, 40);
      vals.forEach((v, i) => { const t = doc.splitTextToSize(ascii(v), cols[i][1] - 2)[0] || ""; doc.text(t, cx, y); cx += cols[i][1]; });
      doc.setDrawColor(225, 228, 226); doc.line(M, y + 2, W - M, y + 2); y += 6;
    });
    y += 3; doc.setFontSize(7.5); doc.setTextColor(90, 100, 110);
    doc.splitTextToSize("* Tape check needed: value from a camera or an estimate; confirm with a measuring tape before cutting. Finished = body + ease + design allowance. Seam allowance is not included.", W - 2 * M).forEach((l) => { doc.text(l, M, y); y += 4; });
    if (r.session.remarks) { y += 2; doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(11, 16, 40); doc.text("Tailor remarks", M, y); y += 5; doc.setFont("helvetica", "normal"); doc.splitTextToSize(ascii(r.session.remarks), W - 2 * M).forEach((l) => { if (y > 285) { doc.addPage(); y = 18; } doc.text(l, M, y); y += 4.5; }); }
    if (photoImgs && photoImgs.length) {
      doc.addPage(); y = 18; doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("Reference photographs", M, y); y += 6;
      let x = M; const cw = (W - 2 * M - 6) / 2;
      for (const p of photoImgs) {
        const h = Math.min(110, cw * p.h / p.w), w = h * p.w / p.h;
        if (y + h > 285) { doc.addPage(); y = 18; x = M; }
        doc.addImage(p.dataURL, "JPEG", x + (cw - w) / 2, y, w, h);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(ascii(p.caption), x, y + h + 4);
        if (x === M) x = M + cw + 6; else { x = M; y += h + 10; }
      }
    }
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.setFontSize(7); doc.setTextColor(120, 130, 140); doc.text(ascii(`${c.code || ""} ${c.name || ""} · generated ${new Date().toLocaleDateString()} · page ${i}/${pages}`), M, 292); }
    return doc.output("blob");
  }

  SM.reports = { build, html, csv, json, pdf, summaryLine };
})(typeof window !== "undefined" ? window : globalThis);

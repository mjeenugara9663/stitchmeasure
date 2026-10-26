/* Public landing page (stitchmeasure.vrisama.in with no #route).
 * Full-bleed illustrated hero (original SVG scene: a tailoring studio),
 * then short sections, then "Enter" into the app. */
(function () {
  "use strict";
  const SM = window.SM, U = SM.util, t = SM.t;
  const WA = "https://wa.me/918088648210?text=" + encodeURIComponent("Hi Vrisama, I would like to know more about StitchMeasure.\n(From stitchmeasure.vrisama.in)");

  /* ---------- original illustration: a tailoring studio ---------- */
  function scene() {
    const tick = [];
    for (let i = 0; i <= 60; i++) tick.push(i);
    return `<svg class="ld-scene" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="ceil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b2fc9"/><stop offset="1" stop-color="#8b46d6"/></linearGradient>
  <linearGradient id="back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2465f"/><stop offset="1" stop-color="#ff6a6c"/></linearGradient>
  <linearGradient id="lwall" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9324c"/><stop offset="1" stop-color="#f04b5f"/></linearGradient>
  <linearGradient id="rwall" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#d63a55"/><stop offset="1" stop-color="#ee4a5e"/></linearGradient>
  <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7d7a"/><stop offset="1" stop-color="#ff9e8c"/></linearGradient>
  <linearGradient id="win" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7c2"/><stop offset="1" stop-color="#ffc59a"/></linearGradient>
  <linearGradient id="ray" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe2b8" stop-opacity=".55"/><stop offset="1" stop-color="#ffe2b8" stop-opacity="0"/></linearGradient>
  <linearGradient id="blue" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6f7dff"/><stop offset=".55" stop-color="#3f4fe6"/><stop offset="1" stop-color="#2a33b8"/></linearGradient>
  <radialGradient id="dome" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#7d8bff"/><stop offset=".6" stop-color="#3b49e0"/><stop offset="1" stop-color="#232aa8"/></radialGradient>
  <linearGradient id="yel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe45c"/><stop offset="1" stop-color="#f6b800"/></linearGradient>
  <linearGradient id="soff" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6b78"/><stop offset="1" stop-color="#e94a5c"/></linearGradient>
  <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="30"/></filter>
</defs>
<!-- room -->
<polygon points="0,0 1600,0 1250,170 350,170" fill="url(#ceil)"/>
<polygon points="0,0 350,170 350,730 0,1000" fill="url(#lwall)"/>
<polygon points="1600,0 1250,170 1250,730 1600,1000" fill="url(#rwall)"/>
<rect x="350" y="170" width="900" height="560" fill="url(#back)"/>
<polygon points="0,1000 350,730 1250,730 1600,1000" fill="url(#floor)"/>
<!-- dropped ceiling beam -->
<polygon points="430,170 1170,170 1080,250 520,250" fill="url(#soff)" opacity=".95"/>
<polygon points="520,250 1080,250 1080,262 520,262" fill="#c93a52"/>
<!-- left windows + light -->
<polygon points="40,150 150,205 150,640 40,720" fill="url(#win)"/>
<polygon points="185,222 300,277 300,610 185,665" fill="url(#win)"/>
<polygon points="95,180 95,690" stroke="#e8a184" stroke-width="5"/><line x1="40" y1="430" x2="150" y2="420" stroke="#e8a184" stroke-width="5"/><line x1="185" y1="445" x2="300" y2="440" stroke="#e8a184" stroke-width="5"/>
<polygon points="150,300 300,330 760,1000 200,1000" fill="url(#ray)"/>
<!-- back wall frames -->
<rect x="395" y="300" width="120" height="150" rx="6" fill="none" stroke="#ff8a8a" stroke-width="6"/>
<rect x="415" y="320" width="80" height="110" rx="4" fill="#ff7f84"/>
<rect x="1090" y="290" width="110" height="80" rx="6" fill="none" stroke="#ff8a8a" stroke-width="6"/>
<!-- fabric shelving -->
<g>
  <rect x="700" y="270" width="330" height="390" rx="8" fill="#e23e58"/>
  ${[0, 1, 2, 3].map((r) => `<rect x="712" y="${300 + r * 92}" width="306" height="10" rx="3" fill="#c7334d"/>`).join("")}
  ${[0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4, 5, 6, 7].map((c) => {
    const pal = ["#ff8f8f", "#ff6f7d", "#ffb0a0", "#ff7a6b", "#ff9db0", "#f75a72", "#ffc0b0", "#ff8576"];
    const special = (r === 1 && c === 5) ? "#4b5cf0" : (r === 2 && c === 2) ? "#ffd43b" : (r === 3 && c === 6) ? "#58f0c5" : pal[(r * 3 + c) % pal.length];
    const h = 50 + ((r * 7 + c * 13) % 26);
    return `<rect x="${720 + c * 37}" y="${300 + r * 92 - h}" width="30" height="${h}" rx="6" fill="${special}"/><ellipse cx="${735 + c * 37}" cy="${300 + r * 92 - h}" rx="15" ry="4" fill="#ffffff" opacity=".25"/>`;
  }).join("")).join("")}
</g>
<!-- hanging lamp -->
<line x1="610" y1="250" x2="610" y2="330" stroke="#2a1f6e" stroke-width="3"/>
<ellipse cx="610" cy="430" rx="120" ry="60" fill="#ffd9a0" opacity=".35" filter="url(#glow)"/>
<path d="M520,400 A90,90 0 0 1 700,400 Z" fill="url(#dome)"/>
<ellipse cx="610" cy="400" rx="90" ry="14" fill="#1d238f"/>
<ellipse cx="610" cy="402" rx="40" ry="7" fill="#fff4c9"/>
<!-- measuring tape arc (like an arc lamp) -->
<path d="M1230,920 C1260,520 1060,250 760,300" fill="none" stroke="url(#yel)" stroke-width="22" stroke-linecap="round"/>
<path d="M1230,920 C1260,520 1060,250 760,300" fill="none" stroke="#7a5a00" stroke-width="10" stroke-dasharray="2 14" opacity=".55"/>
<path d="M1230,920 C1260,520 1060,250 760,300" fill="none" stroke="#7a5a00" stroke-width="16" stroke-dasharray="3 77" opacity=".7"/>
<rect x="1196" y="900" width="70" height="46" rx="12" fill="url(#yel)"/><circle cx="1231" cy="923" r="10" fill="#7a5a00" opacity=".6"/>
<!-- shadows -->
<ellipse cx="640" cy="905" rx="150" ry="26" fill="#b8323f" opacity=".45" filter="url(#soft)"/>
<ellipse cx="330" cy="920" rx="160" ry="30" fill="#b8323f" opacity=".45" filter="url(#soft)"/>
<ellipse cx="940" cy="955" rx="260" ry="30" fill="#b8323f" opacity=".4" filter="url(#soft)"/>
<!-- plant by the window -->
<g>
  <path d="M120,820 l26,0 l-6,120 l-60,0 l-6,-120 z" fill="url(#blue)" transform="translate(40 0)"/>
  ${[-70, -45, -20, 0, 20, 45, 70].map((a, i) => `<path d="M173,820 q${a * 1.2},-${120 + (i % 3) * 40} ${a * 2.2},-${170 + (i % 2) * 50}" fill="none" stroke="${i % 2 ? "#6f6dff" : "#4b52e8"}" stroke-width="${14 - (i % 3) * 3}" stroke-linecap="round"/>`).join("")}
</g>
<!-- yellow tailor's stool -->
<g>
  <path d="M250,760 q80,-40 170,0 l-8,40 q-77,25 -154,0 z" fill="url(#yel)"/>
  <path d="M258,800 q77,25 154,0 l0,14 q-77,25 -154,0 z" fill="#d79a00"/>
  <path d="M300,812 l-36,105 M370,816 l38,100 M335,818 l0,110" stroke="#f2b400" stroke-width="12" stroke-linecap="round"/>
  <ellipse cx="335" cy="870" rx="60" ry="10" fill="none" stroke="#e0a400" stroke-width="7"/>
</g>
<!-- dress form (mannequin) -->
<g>
  <line x1="640" y1="760" x2="640" y2="880" stroke="#f2b400" stroke-width="14" stroke-linecap="round"/>
  <path d="M640,880 l-70,24 M640,880 l70,24 M640,880 l0,30" stroke="#f2b400" stroke-width="12" stroke-linecap="round"/>
  <rect x="626" y="470" width="28" height="34" rx="10" fill="#2a33b8"/>
  <ellipse cx="640" cy="468" rx="22" ry="9" fill="url(#yel)"/>
  <path d="M640,500 C700,500 742,520 748,560 C756,610 712,640 716,690 C720,730 742,748 738,770 L542,770 C538,748 560,730 564,690 C568,640 524,610 532,560 C538,520 580,500 640,500 Z" fill="url(#blue)"/>
  <path d="M560,590 C600,610 680,610 720,590" fill="none" stroke="#8792ff" stroke-width="3" opacity=".6"/>
  <path d="M600,505 C590,560 600,640 616,770" fill="none" stroke="#ffd84a" stroke-width="10" stroke-linecap="round"/>
  <path d="M680,505 C690,560 676,600 668,640" fill="none" stroke="#ffd84a" stroke-width="10" stroke-linecap="round"/>
  <path d="M600,505 C620,520 660,520 680,505" fill="none" stroke="#ffd84a" stroke-width="10" stroke-linecap="round"/>
  <path d="M600,505 C590,560 600,640 616,770" fill="none" stroke="#7a5a00" stroke-width="6" stroke-dasharray="2 10" opacity=".5"/>
</g>
<!-- cutting table -->
<g>
  <polygon points="760,820 1150,820 1210,860 700,860" fill="url(#yel)"/>
  <rect x="700" y="860" width="510" height="16" fill="#e0a400"/>
  <path d="M720,876 l0,90 M1190,876 l0,90 M770,876 l0,60 M1140,876 l0,60" stroke="#f2b400" stroke-width="12" stroke-linecap="round"/>
  <polygon points="820,826 1010,826 1040,852 790,852" fill="#4b5cf0"/>
  <polygon points="830,830 960,830 975,848 812,848" fill="#6f7dff"/>
  <g transform="translate(1060 838) rotate(-18)"><circle cx="-14" cy="0" r="9" fill="none" stroke="#2a1f6e" stroke-width="5"/><circle cx="14" cy="0" r="9" fill="none" stroke="#2a1f6e" stroke-width="5"/><path d="M-6,-6 L40,-26 M6,-6 L42,-14" stroke="#c9cce8" stroke-width="5" stroke-linecap="round"/></g>
  <g transform="translate(1110 812)"><rect x="-12" y="-28" width="24" height="30" rx="5" fill="#58f0c5"/><rect x="-15" y="-32" width="30" height="7" rx="3" fill="#f2b400"/><rect x="-15" y="0" width="30" height="7" rx="3" fill="#f2b400"/></g>
</g>
<!-- right niche with spools -->
<polygon points="1330,420 1480,380 1480,520 1330,540" fill="#c93850"/>
${[0, 1, 2].map((i) => `<g transform="translate(${1362 + i * 40} ${500 - i * 12})"><rect x="-11" y="-36" width="22" height="34" rx="4" fill="${["#ffd43b", "#4b5cf0", "#58f0c5"][i]}"/><rect x="-14" y="-40" width="28" height="6" rx="3" fill="#ffe7c2"/><rect x="-14" y="-4" width="28" height="6" rx="3" fill="#ffe7c2"/></g>`).join("")}
</svg>`;
  }

  SM.views.welcome = async function (el) {
    const V = '<span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M15 17 31 49 49 17" fill="none" stroke="#fff" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/></svg></span>';
    el.innerHTML = `
      <section class="ld-hero" id="top">
        ${scene()}
        <div class="ld-scrim" aria-hidden="true"></div>
        <header class="ld-nav">
          <a class="ld-logo" href="#/" aria-label="StitchMeasure by Vrisama">${V}<span class="ld-logo-text">vrisama<small>STITCHMEASURE</small></span></a>
          <nav class="ld-links" aria-label="Page"><a href="#features" data-anchor>${t("Features")}</a><a href="#how" data-anchor>${t("How it works")}</a><a href="#privacy" data-anchor>${t("Privacy")}</a></nav>
          <div class="ld-actions"><a class="ld-pill ghost" href="#/">${t("Enter")}</a><a class="ld-pill solid" href="${WA}" target="_blank" rel="noopener">${SM.icon("share")}${t("Connect")}</a></div>
        </header>
        <div class="ld-copy">
          <h1>Stitch<br>Measure</h1>
          <p>${t("Measurement studio for tailors, boutiques and designers. Guided body photos, tape-verified values and clean measurement sheets, all working offline on your phone.")}</p>
          <a class="ld-cta" href="#/">${t("Start measuring")} <svg viewBox="0 0 32 12" aria-hidden="true"><path d="M0 6h30M24 1l6 5-6 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
        </div>
        <div class="ld-credit"><span class="ld-avatar">${V}</span><span>Vrisama <b>| Tailoring Studio Concept</b></span></div>
        <a class="ld-mouse" href="#features" data-anchor aria-label="${t("Scroll to features")}"><span></span></a>
      </section>

      <section class="ld-section" id="features">
        <div class="ld-wrap">
          <p class="ld-eyebrow">${t("What it does")}</p>
          <h2>${t("From first fitting to finished sheet")}</h2>
          <div class="ld-cards">
            <article class="ld-card c1"><span class="ld-ic">${SM.icon("scan")}</span><h3>${t("Guided body photos")}</h3><p>${t("A see-through body outline and grid on the live camera help the customer stand right, with warnings for tilt, low light and movement.")}</p></article>
            <article class="ld-card c2"><span class="ld-ic">${SM.icon("tape")}</span><h3>${t("Tape-verified values")}</h3><p>${t("80 head-to-toe measurements with how-to illustrations. Photo values stay marked until you confirm them with a tape.")}</p></article>
            <article class="ld-card c3"><span class="ld-ic">${SM.icon("report")}</span><h3>${t("Garment-ready sheets")}</h3><p>${t("34 garment checklists from saree blouse to sherwani. Export a measurement sheet as PDF, CSV or print, with ease kept separate.")}</p></article>
          </div>
        </div>
      </section>

      <section class="ld-section alt" id="how">
        <div class="ld-wrap">
          <p class="ld-eyebrow">${t("How it works")}</p>
          <h2>${t("Four steps, one phone")}</h2>
          <ol class="ld-steps">
            <li><b>01</b><h3>${t("Create the customer")}</h3><p>${t("Name, height and garment. Child profiles ask for guardian consent.")}</p></li>
            <li><b>02</b><h3>${t("Take guided photos")}</h3><p>${t("Front, side and back with the outline. Add an A4 sheet or printed marker for scale.")}</p></li>
            <li><b>03</b><h3>${t("Measure and verify")}</h3><p>${t("Draw lengths on calibrated photos, then confirm fit-critical values with a tape.")}</p></li>
            <li><b>04</b><h3>${t("Share the sheet")}</h3><p>${t("PDF, CSV or print. Save photos to Gallery or Photos.")}</p></li>
          </ol>
        </div>
      </section>

      <section class="ld-section" id="privacy">
        <div class="ld-wrap ld-privacy">
          <div><p class="ld-eyebrow">${t("Privacy")}</p><h2>${t("Your customers' data stays on your phone")}</h2>
          <p>${t("No accounts, no uploads, no tracking. Photos and measurements are stored only on the device, with encrypted backups when you want a copy. Install it once and it works without internet.")}</p></div>
          <a class="ld-pill big" href="#/">${t("Enter the studio")}</a>
        </div>
      </section>

      <footer class="ld-footer"><div class="ld-wrap">
        <span>${V} <b>vrisama</b> · Bengaluru, India</span>
        <span><a href="https://ads.vrisama.in" target="_blank" rel="noopener">ads.vrisama.in</a> · <a href="https://aicareers.vrisama.in" target="_blank" rel="noopener">aicareers.vrisama.in</a> · <a href="${WA}" target="_blank" rel="noopener">WhatsApp</a></span>
        <small>${t("Measurements from photos are approximate. Fit-critical values should always be confirmed with a measuring tape.")}</small>
      </div></footer>`;
    U.$$("[data-anchor]", el).forEach((a) => (a.onclick = (e) => { e.preventDefault(); const n = U.$(a.getAttribute("href")); if (n) n.scrollIntoView({ behavior: "smooth" }); }));
  };
})();

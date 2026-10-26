/* StitchMeasure by Vrisama service worker: precaches every app file so the app opens
 * and works with no network. No data ever leaves the device; this worker only
 * serves the app's own files. Bump VERSION (tools/build.js does it) on release. */
const VERSION = "sm-1.0.0-202610260934";
const ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "src/styles/app.css",
  "src/core/i18n.js",
  "src/core/util.js",
  "src/components/icons.js",
  "src/storage/db.js",
  "src/storage/backup.js",
  "src/settings/settings.js",
  "src/measurement-engine/catalog.js",
  "src/measurement-engine/engine.js",
  "src/calibration/calibration.js",
  "src/garment-templates/templates.js",
  "src/reference-images/figure.js",
  "src/overlays/overlays.js",
  "src/camera/camera.js",
  "src/pose-detection/pose.js",
  "src/photo-export/export.js",
  "src/reports/reports.js",
  "src/customer-profiles/customers.js",
  "src/customer-profiles/samples.js",
  "src/app.js",
  "src/components/dashboard.js",
  "src/customer-profiles/views.js",
  "src/measurement-engine/session-view.js",
  "src/body-map/bodymap.js",
  "src/garment-templates/views.js",
  "src/camera/camera-view.js",
  "src/photo-export/editor.js",
  "src/photo-export/photos-view.js",
  "src/reports/views.js",
  "src/settings/views.js",
  "src/components/wizard.js",
  "src/components/landing.js",
  "src/components/boot.js",
  "public/vendor/jspdf.umd.min.js",
  "public/fonts/outfit-latin-600-normal.woff2",
  "public/fonts/outfit-latin-700-normal.woff2",
  "public/fonts/outfit-latin-800-normal.woff2",
  "public/fonts/dm-sans-latin-400-normal.woff2",
  "public/fonts/dm-sans-latin-500-normal.woff2",
  "public/fonts/dm-sans-latin-600-normal.woff2",
  "public/fonts/dm-sans-latin-700-normal.woff2",
  "public/icons/icon-192.png",
  "public/icons/icon-512.png",
  "public/icons/icon-maskable-512.png",
  "public/icons/apple-touch-icon.png",
  "public/icons/favicon-64.png",
  "public/icons/favicon.svg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("sm-") && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

/* cache first for app files; never cache anything from other origins */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok && res.type === "basic") { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => (req.mode === "navigate" ? caches.match("index.html") : Response.error()));
    })
  );
});

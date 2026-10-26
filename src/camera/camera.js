/* Camera Service: getUserMedia wrapper with camera switching, torch, zoom,
 * capture and simple frame checks (brightness and movement).
 * Requires a secure context (HTTPS or localhost). */
(function (root) {
  "use strict";
  const SM = (root.SM = root.SM || {});
  let stream = null, track = null, facing = "environment", devices = [];

  function support() {
    if (!root.isSecureContext) return { ok: false, reason: "The camera needs a secure address (https:// or localhost). This page is opened from " + location.protocol + "//. You can still import photos and enter measurements." };
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return { ok: false, reason: "This browser does not allow camera access. Import photos instead, or enter measurements manually." };
    return { ok: true };
  }

  async function listCameras() {
    try { devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput"); } catch (e) { devices = []; }
    return devices;
  }

  function explain(err) {
    const n = err && err.name;
    if (n === "NotAllowedError" || n === "SecurityError") return "Camera permission was denied. Allow camera access for this site in the browser settings, then try again. You can still import photos.";
    if (n === "NotFoundError" || n === "OverconstrainedError") return "No suitable camera was found on this device. Import a photo instead.";
    if (n === "NotReadableError") return "The camera is being used by another app. Close it and try again.";
    return "The camera could not start (" + (err && err.message ? err.message : n || "unknown error") + ").";
  }

  async function start(video, opts) {
    opts = opts || {};
    const s = support(); if (!s.ok) throw new Error(s.reason);
    stop();
    if (opts.facing) facing = opts.facing;
    const base = { width: { ideal: 1920 }, height: { ideal: 1080 } };
    const tries = [
      { video: Object.assign({ facingMode: { ideal: facing } }, base), audio: false },
      { video: { facingMode: facing }, audio: false },
      { video: true, audio: false }
    ];
    let lastErr;
    for (const c of tries) {
      try { stream = await navigator.mediaDevices.getUserMedia(c); break; } catch (e) { lastErr = e; if (e.name === "NotAllowedError" || e.name === "SecurityError") break; }
    }
    if (!stream) throw new Error(explain(lastErr));
    track = stream.getVideoTracks()[0];
    video.srcObject = stream;
    video.setAttribute("playsinline", ""); video.muted = true;
    try { await video.play(); } catch (e) { /* autoplay blocked: the user can tap */ }
    await new Promise((r) => { if (video.videoWidth) return r(); video.onloadedmetadata = () => r(); setTimeout(r, 2500); });
    const settings = track.getSettings ? track.getSettings() : {};
    if (settings.facingMode) facing = settings.facingMode;
    await listCameras();
    return info(video);
  }

  function info(video) {
    const caps = track && track.getCapabilities ? track.getCapabilities() : {};
    const settings = track && track.getSettings ? track.getSettings() : {};
    return {
      width: video ? video.videoWidth : settings.width, height: video ? video.videoHeight : settings.height,
      facing, label: track ? track.label : "",
      torch: !!caps.torch, zoom: caps.zoom ? { min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1, value: settings.zoom || caps.zoom.min } : null,
      cameras: devices.length
    };
  }

  function stop() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null; track = null;
  }
  async function flip(video) { facing = facing === "environment" ? "user" : "environment"; return start(video, { facing }); }
  async function setTorch(on) { if (!track) return false; try { await track.applyConstraints({ advanced: [{ torch: !!on }] }); return true; } catch (e) { return false; } }
  async function setZoom(z) { if (!track) return false; try { await track.applyConstraints({ advanced: [{ zoom: z }] }); return true; } catch (e) { return false; } }

  /* capture the current frame at full sensor resolution of the stream */
  function capture(video, mirror) {
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) throw new Error("The camera image is not ready yet.");
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d");
    if (mirror) { g.translate(w, 0); g.scale(-1, 1); }
    g.drawImage(video, 0, 0, w, h);
    return c;
  }

  /* frame analysis for live guidance */
  const probe = document.createElement ? document.createElement("canvas") : null;
  let prev = null;
  function analyse(video) {
    if (!probe || !video.videoWidth) return null;
    const W = 48, H = Math.round(48 * video.videoHeight / video.videoWidth) || 64;
    probe.width = W; probe.height = H;
    const g = probe.getContext("2d", { willReadFrequently: true });
    g.drawImage(video, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data;
    let sum = 0, diff = 0; const lum = new Float32Array(W * H);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; lum[j] = l; sum += l; if (prev) diff += Math.abs(l - prev[j]); }
    const res = { brightness: sum / lum.length, motion: prev ? diff / lum.length : 0 };
    prev = lum;
    return res;
  }

  SM.camera = { support, start, stop, flip, setTorch, setZoom, capture, analyse, info: () => info(null), get facing() { return facing; }, get active() { return !!stream; }, listCameras };
})(typeof window !== "undefined" ? window : globalThis);

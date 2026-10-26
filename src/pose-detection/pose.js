/* Pose Detection Service — Phase 2 interface.
 *
 * Phase 1 ships WITHOUT an AI model, so this service reports itself as
 * unavailable and the app uses the manual alignment and landmark workflow.
 * Nothing in the app fabricates landmarks.
 *
 * To enable in Phase 2 (all files local, no CDN):
 *   public/local-models/vision_bundle.js        (MediaPipe Tasks Vision, UMD/IIFE build)
 *   public/local-models/wasm/                   (vision_wasm_internal.js / .wasm)
 *   public/local-models/pose_landmarker_lite.task
 * then implement detect() below and add the files to service-worker.js.
 * See docs/android-ios-integration.md and docs/measurement-validation.md.
 */
(function (root) {
  "use strict";
  const SM = (root.SM = root.SM || {});
  const MODEL = "public/local-models/pose_landmarker_lite.task";

  let state = { checked: false, available: false, reason: "Not checked yet." };

  async function check() {
    if (state.checked) return state;
    state.checked = true;
    if (!root.FilesetResolver && !(root.vision && root.vision.FilesetResolver)) {
      state.available = false;
      state.reason = "No local pose model is installed in this version (Phase 2 feature). Use manual alignment and landmark placement.";
      return state;
    }
    try {
      const r = await fetch(MODEL, { method: "HEAD" });
      state.available = r.ok;
      state.reason = r.ok ? "Local pose model found (experimental)." : "Pose model file is missing from public/local-models.";
    } catch (e) {
      state.available = false; state.reason = "Pose model could not be read: " + e.message;
    }
    return state;
  }

  SM.pose = {
    check,
    get status() { return state; },
    /* Phase 2: returns [{name, x, y, visibility}] in image pixels, or throws.
     * Results must always be presented as "Experimental AI" and be editable. */
    async detect() { throw new Error(state.reason || "Pose detection is not available."); }
  };
})(typeof window !== "undefined" ? window : globalThis);

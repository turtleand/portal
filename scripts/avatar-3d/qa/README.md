# Avatar browser QA

These scripts operate a locally served **production build**. They do not edit production assets. Install/locate Playwright separately and set `PLAYWRIGHT_MODULE` to its importable entry if it is not available through normal package resolution.

Use the same package installation and server pipeline for both the baseline checkout and the candidate. Set `PORTAL_QA_BASE_URL` to the actual local server and `PORTAL_QA_LABEL` to `baseline` or `candidate`. A development server must not be silently substituted for a production build.

Netlify's adapter does not support `astro preview`. The explicit `static.config.mjs` builds the real client sources with production Astro/Vite optimization and prerendered routes, using an isolated output directory. Use this identical config for both sides, then `serve-built.mjs` for matching gzip/cache behavior. This verifies client integration and lab performance; it does not emulate Netlify's request-time SSR. Run the repository's unmodified build separately to validate its actual adapter output.

Set `PORTAL_QA_PROJECT_ROOT` to the intended checkout and `PORTAL_QA_BUILD_DIR` to its separate QA output. Run the build from that checkout's own working directory. Use `astro build --config scripts/avatar-3d/qa/static.config.mjs` in the candidate. Copy that same config into the baseline checkout as `qa-static.config.mjs`, then run `astro build --config qa-static.config.mjs` there. Astro 7 resolves this CLI config argument relative to the working root. Keeping baseline output inside its checkout also lets prerender resolve packages through its shared `node_modules` ancestor. Start the server with `PORTAL_QA_BUILD_DIR` and `PORTAL_QA_PORT`. Avoid shared output directories between baseline and candidate.

```sh
node scripts/avatar-3d/qa/browser-inventory.mjs
node scripts/avatar-3d/qa/browser-matrix.mjs
node scripts/avatar-3d/qa/canonical-failure.mjs
node scripts/avatar-3d/qa/failures-and-lifecycle.mjs
node scripts/avatar-3d/qa/navigation-and-motion.mjs
node scripts/avatar-3d/qa/timeout-restart-proof.cjs
node scripts/avatar-3d/qa/timeline-regression.mjs
PORTAL_QA_BASE_URL=http://127.0.0.1:4390 PORTAL_QA_LABEL=baseline PORTAL_QA_SOURCE_ROOT=BASELINE_CHECKOUT node scripts/avatar-3d/qa/measure-pages.mjs
PORTAL_QA_BASE_URL=http://127.0.0.1:4391 PORTAL_QA_LABEL=candidate node scripts/avatar-3d/qa/measure-pages.mjs
PORTAL_QA_BASE_URL=http://127.0.0.1:4391 PORTAL_QA_LABEL=candidate node scripts/avatar-3d/qa/measure-viewer.mjs
PORTAL_QA_BASE_URL=http://127.0.0.1:4391 PORTAL_QA_LABEL=candidate node scripts/avatar-3d/qa/measure-motion.mjs
PORTAL_QA_LABEL=candidate node scripts/avatar-3d/qa/summarize-performance.mjs
```

The page measurement script takes ten fresh-context samples for each EN/ES and desktop/390px combination, records supported LCP/CLS/long-task metrics, and records all resource requests. Chrome with ANGLE Metal is used for these measurements on this host; viewport and DPR settings are laboratory conditions, not a physical phone claim. Keep both raw reports when comparing medians. The baseline uses its own build output and candidate uses its own build output.

Reports are written to `docs/avatar-3d-implementation/evidence/`. Set `PORTAL_QA_SOURCE_ROOT` to the baseline checkout during baseline measurements so source hashes refer to the tested snapshot. It defaults to the candidate repository. Record the baseline commit and same-toolchain build separately, and freeze/rebuild the candidate before final evidence collection. Unavailable engines or metrics must be reported explicitly.

The shared WebGL probe wraps actual WebGL drawing methods for optional idle/visibility checks. It counts draw submissions, not rAF callback cadence, GPU execution time, or GPU memory. It runs only in QA browser contexts and is never bundled into Portal.

`PORTAL_QA_ENGINES` selects a comma-separated browser list. `PORTAL_QA_PROFILE` filters matrix names such as `chromium/narrow/es`. Set `PORTAL_QA_CONTACT_SHEETS=1` to save all six real viewport captures per representation as labeled lineage sheets. `PORTAL_QA_SKIP_CHRONOLOGY=1` skips only the separately proven, unchanged 2D timed chronology; record that scope when using it. `PORTAL_QA_CASES` filters fault/lifecycle cases by a regular expression. Do not count a filtered run as the full suite.

On this macOS WebKit host, Option+Tab enables navigation through all controls. Plain Tab skips buttons identically in baseline and candidate; the matrix records that distinction. The helper waits for the modal's scheduled focus transfer before sending keyboard input. Touch input is emulated. Headless visibility can remain true even with a second tab, so the hidden-document branch is identified as synthetic when necessary.

The motion script separately records CPU draw-submission duration, animation-frame cadence and GPU draw-batch elapsed time if `EXT_disjoint_timer_query_webgl2` is available. Those metrics are not interchangeable, and none is native screen-presentation latency. Run performance scripts serially with other local browser/heavy workloads idle.

`canonical-failure.mjs` verifies that a failed canonical SVG cannot cover a ready 3D model or leave its accessible label unavailable. It also checks return to 2D, a failed GLB and explicit retry in both languages. The unavailable state is preserved whenever neither representation can render.

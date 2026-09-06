# Warm Presence browser evidence

These reports test the six selected Warm Presence production models after the canonical SVG failure overlay and accessibility-label fix. They use the production-optimized static client build. Source and model hashes are recorded in each JSON report.

| Report | Result | Scope |
| --- | --- | --- |
| `final-browser-matrix.json` | 336/336 passed | Chrome 152, Firefox 153 and WebKit 26.5; English and Spanish; 1440×1000 and 390×844; all six canonical SVGs and 3D models, opt-in loading, reduced motion, camera controls, representation switching, focus, close/reopen and overflow |
| `final-canonical-failure.json` | 12/12 passed | Failed canonical SVG fetch and image fallback; successful 3D visibility and label, return to 2D, GLB failure and explicit retry in both languages |
| `final-navigation-motion.json` | 21/21 passed | Public routes, real-time six-version 3D chronology, pause, pointer orbit, emulated touch orbit and vertical touch scrolling |
| `final-timeline-regression.json` | 20/20 passed | First/last timeline selection remains visible at 390px without changing modal vertical scroll; English and Spanish, 2D and 3D |

The matrix intentionally skips the previously verified, unchanged 2D timed walking sequence. Touch and narrow viewports are browser emulation, not physical-device evidence. WebKit uses Option+Tab for all-control navigation on the test host, as recorded in the matrix. All final checks completed without unhandled page errors.

`desktop-en.png` and `mobile-es.png` show the final production gallery with the latest version selected and movement paused. The desktop capture is 1440×1320 so the complete dialog is visible. `production-captures.json` records the rendered state. The concise all-six image recommended for review is `final-chromium-desktop-en-3d-lineage.png`.

The four Chromium 3D lineage sheets and four gallery captures also received an independent saved-image review. All 24 stage views retained complete silhouettes, consistent framing and expressions, visible selected timeline markers, and readable English/Spanish controls.

The checked-in images are representative captures from the full local matrix. Additional per-profile screenshots and pre-fix reproduction captures remain local working evidence; their filenames may appear in the raw reports.

## Final model loading

The [final readiness summary](final-viewer-performance-summary.json) records ten fresh-context runs per profile on the latest, heaviest model. All 20 models loaded, became visible and submitted draw calls, with no 3D requests before opt-in and no page errors.

| Profile | Median | p95 |
| --- | ---: | ---: |
| Desktop, 1440px, DPR 1 | 640 ms | 935 ms |
| Controlled 390px, DPR 2 | 2,616 ms | 3,489 ms |

The controlled profile uses 10 Mbit/s download, 80 ms latency and 4× CPU slowdown. It is desktop-browser simulation, not a physical phone. Readiness follows model load, component update and two animation frames; drawing is corroborated, but native screen-presentation latency is not measured. The p95 is the largest of ten samples. The compressed runtime, model and shared lighting total 1.73 MiB for the heaviest first opt-in. Raw trials are preserved in `final-viewer-performance.json`.

# Game art and loading review

This directory compares baseline commit `d79a25f` with the current procedural derivatives. Canonical SVGs, walking poses, manifest chronology and English/Spanish stories are unchanged.

## Visual result

The game art pass raises the head/neck slightly, enlarges the hazel iris, bevels the wrist terminal, adds skin gradients and scute growth/edge shading, separates cool silver from organic surfaces, and uses a darker studio with warm key and cool rim lighting. Detail is baked into normals and normalized byte vertex colors. No external geometry, texture, decoder or authoring runtime is added.

- `baseline-lineage.png` and `lineage.png` show the six opening views.
- `latest-orbits.png` shows front, right, rear, left, above and low views of the latest identity.
- `visual-review.json` records all 42 version/angle reviews and actual rig transforms.
- `idle-poses.png` shows a fixed camera at neutral, blink and breath poses. Transform assertions prove the eye scale and head position change; camera rotation is not used as animation evidence.

Each model contains one eight-second `Idle` clip with five core glTF channels. The exporter preserves named anatomical pivots and batches by material within those pivots. Equipment follows its owner; feet remain planted. Camera rotation and character animation follow the gallery's existing controls and motion preferences.

## Payload

See `baseline-assets.json`, `candidate-assets.json`, `baseline-inventory.json` and `asset-summary.json` for exact bytes, hashes, triangles and animation coverage.

| Latest avatar | Baseline | Current |
| --- | ---: | ---: |
| Raw GLB bytes | 2,519,012 | 1,128,992 |
| Gzip GLB bytes | 1,455,007 | 623,275 |
| Triangles | 134,602 | 55,240 |
| Meshes | 20 | 25 |
| Animation clips | 0 | 1 |

All six GLBs are 51.6–55.2% smaller raw and remain below 1.3 MiB and 65,000 triangles. The extra anatomical batches preserve motion; shared eye pigmentation limits their draw cost.

## Loading result

| UI-ready median | Baseline | Current | Improvement |
| --- | ---: | ---: | ---: |
| Desktop | 1.99 s | 1.76 s | 12% |
| 390px throttled mobile simulation | 2.69 s | 1.91 s | 29% |

`baseline-performance.json`, `candidate-performance.json` and `performance-summary.json` contain three fresh-context samples per profile. Both use Chromium 154, SwiftShader software WebGL, the same production static build config and gzip localhost server. The narrow profile uses DPR2, 10 Mbit/s, 80 ms latency and 4x CPU throttling. Other browser work was closed during timing; OS/GPU caches were not flushed. UI-ready is a proxy for usable gallery state, not GPU presentation time. These small lab samples do not establish performance on a physical phone or hardware GPU.

Current runs request no 3D resources before opt-in, emit no page errors and show no horizontal overflow. Only the selected model downloads. Runtime, HDR and GLB transfers overlap, removing the old download waterfall; `loading-animation.json` proves that overlap with an intentionally held runtime request.

## Validation scope

The eleven structural/animation tests, canonical evolution validator, unmodified Netlify production build, and production-optimized static client build pass. Chromium 154 with SwiftShader software WebGL is the browser used here. Firefox and WebKit executables are unavailable; `engine-availability.json` records that limit. The static build exercises real optimized client sources, not Netlify request-time SSR. Narrow profiles emulate a desktop browser and do not establish physical-phone performance.

`loading-animation.json` has 32 passing checks for parallel startup, selected-only requests, cancellation, close/reopen, real clip playback, pause/resume, manual inspection, dynamic reduced motion and all-version resting poses. The four-profile browser matrix has 112 passing checks covering desktop/390px and English/Spanish. Twelve canonical failure checks pass for both languages, SVG failure, model failure and explicit recovery. The unchanged timed 2D chronology is excluded from this matrix.

All 37 fault/lifecycle checks pass, including all 20 full-lineage/open-close cycles. The last five retain zero viewers and constant DOM/listener counts. Fault/lifecycle scope includes delayed and corrupt models, blocked/corrupt lighting, runtime failure, graphics unavailability, real context loss, retry, pause/close draw inactivity and repeated lineage/open-close cycles. Hung dependency timeout scenarios are excluded. Headless tabs remain visible in this environment, so the hidden-document draw check uses an explicitly recorded synthetic event. DOM/listener and JS heap observations do not establish GPU memory disposal.

## Reproduce

Use the commands in `scripts/avatar-3d/qa/README.md`. `review-game-art.mjs` captures the angle/motion evidence; `measure-game-art.mjs` records readiness and resource bytes. Set the same browser, software/hardware renderer, production build config and gzip server for both sides. Run timing checks serially after other browsers close. Keep QA output outside `dist/` when running a normal production build in the same checkout.

---
name: avatar-game-art
description: Improve Turtleand's procedural 3D avatar derivatives and idle animation with game character art methods, canonical SVG fidelity, bounded assets, and measured browser review.
---

# Avatar game art

Use this workflow when improving the gallery's 3D character models, embedded motion, or delivery performance. It is a repository authoring skill using the existing Three.js exporter and model-viewer runtime. It does not require an external art service or create an avatar version.

Read `AGENTS.md`, `CLAUDE.md`, `docs/avatar-versioning.md`, `docs/avatar-3d-assets.md`, and `scripts/avatar-3d/qa/README.md` first. Apply the user's established direction and any more recent repository requirements.

## Establish identity and a baseline

1. Read `src/data/avatarVersions.json` and inspect every canonical resting SVG in `src/images/avatar/evolution/`. These vectors are the identity source; archived raster concepts and walking poses are references or derivatives.
2. Record head-to-shell proportion, stance, silhouette, eye spacing, cheek placement, muzzle shape, palette, shell panels, and the equipment progression. Keep organic toes and version-specific anatomy recognizable. Interpret unseen surfaces conservatively.
3. Capture the current models at the actual gallery size and opening camera orbit. Read the exporter, inventory, registry, controller, and existing QA evidence before diagnosing a loading or motion problem.
4. Separate measured causes: model transfer, runtime import, geometry parsing, environment processing, first usable frame, and animation scheduling. An unanimated GLB and a slow transfer require different fixes.

## Shape before detail

- Author editable sources in `scripts/avatar-3d/build-models.cjs`; regenerate tracked GLBs instead of hand-editing binaries. Preserve stable identity extras, positive Y up, face toward positive Z, common ground contact, and consistent camera framing.
- Resolve the primary silhouette, then head/face planes, then shell segmentation and equipment. Smooth normals cannot repair incorrect proportions. Add enough silhouette topology to avoid visible facets at the allowed orbit angles.
- Preserve the selected Warm Presence expression while retaining each SVG's recognizable eye and muzzle placement. Integrate eyelids with the head, keep pupils readable at mobile size, and use a calm closed smile. Reject bulging eyes, broad pale eye rings, deep brow creases, and hooked or wavy smile endpoints.
- Keep surface intersections deliberate: eyes seated in the face, limbs connected to the body, braces around limbs, feet on the floor, and headset or terminal anchored to anatomy.

## Materials and economical surface detail

- Separate satin organic skin, keratin shell, silver equipment, dark sockets, and cyan inlays through PBR roughness and metalness. Judge them under the shared studio HDR before raising exposure or emission.
- Use deterministic vertex colors for broad variation and baked ambient shading. Avoid muddy base-color multiplication and dark seams that hide the face. Reserve color contrast for identity markings and important equipment.
- Bake procedural fine surface relief into normals or an embedded normal texture when needed. Use low-amplitude deterministic detail at a scale that survives the gallery view. Do not represent every skin pore or shell scratch with another mesh.
- Share geometry or materials where identity actually agrees. Merge static geometry by material and rig owner. Preserve separate moving groups and material boundaries; do not merge across an animation pivot.
- Keep exports self-contained. No remote textures, buffers, decoders, or runtime authoring dependencies. Record attribution and licensing in `docs/avatar-3d-assets.md` before adding third-party assets.

## Restrained character motion

- Export an embedded core glTF clip named `Idle`, with breathing, a small head settle, and occasional blinks. Use named head, shell/body, and eye rig groups with anatomically appropriate pivots. Keep shell accessories attached to their rig owner.
- Keep feet planted and the face readable. Review the full loop at its beginning, blink, peak breath, and seam. Match first and final transforms to prevent a visible reset.
- Use translation/rotation/scale tracks and a modest keyframe count. Prefer carefully placed keys over dense samples unless interpolation measurably needs them. Quaternion rotation outputs must remain normalized; animation times must be finite and strictly increasing.
- Play the embedded clip only when the selected model is ready and the gallery's play state permits motion. Main pause, reduced motion, hidden documents, closed modals, stale loads, and graphics failures must stop automatic motion. Manual orbit remains usable under reduced motion.
- Prove motion from changing rig transforms or captured frames while the camera stays fixed. Camera rotation alone is not evidence of character animation.

## Asset and delivery budgets

Target fewer than 50 instantiated meshes, 65,000 triangles, and 1.3 MiB raw GLB per avatar. Retain the established 2.5 MiB raw ceiling. Report exceptions with the measured visual benefit and loading cost; an art-quality claim does not replace measurement.

- Keep one model per manifest entry and one shared `warm.hdr` in the runtime asset directory. Record raw and compressed bytes, triangles, mesh/material counts, and clip inventory.
- Load no 3D runtime, model, HDR, decoder, preload, or prefetch before explicit 3D selection. Request only the selected model. Keep the canonical SVG visible until that selection is usable.
- Render the interactive frame promptly; defer expensive lighting work where the runtime supports a usable initial frame. Measure environment transitions and verify that the final material treatment remains consistent.
- Reuse a bounded viewer, guard stale completions, and verify cleanup. Retrying a failed model must not leave obsolete viewers, running clips, or unbounded cache retention.

## Review and evidence

1. Run `npm run validate:avatar-3d`, `npm run test:avatar-3d-assets`, `npm run validate:avatar-evolution`, `npm run build`, and `git diff --check`. Optional animation checks supplement the existing identity and self-contained resource checks.
2. Inspect every version against its canonical SVG from front, opening three-quarter, both sides, rear, and the extremes of the allowed orbit. Capture the actual gallery on desktop and 390px layouts. Check face readability, equipment sequence, clipping, contact shadows, and details on unseen surfaces.
3. Use a production-optimized build and the documented browser harness for English/Spanish controls, delayed-load navigation, retry, 2D recovery, reduced motion, pause/resume, keyboard/touch, and open/close/hidden lifecycle tests. State which engines and scenarios actually ran.
4. Compare baseline and candidate on the same browser/device profile, network conditions, server compression, and cache state. Record payload, first usable frame, actual animated transforms, and lifecycle/render telemetry. CPU submissions, frame cadence, and GPU timings are distinct metrics.
5. Freeze the candidate before final captures. Put screenshots and raw measurement reports under a clearly named evidence directory in `docs/avatar-3d-implementation/evidence/`. Update the authoring docs with the resulting workflow and actual outcomes. Never describe historical captures as measurements of a newly generated model.

Keep visual judgment and structural validity separate. Report specific visible improvements and measured loading changes; use neither marketing quality labels nor unmeasured speed promises.

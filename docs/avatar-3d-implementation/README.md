# Sculpted Warmth game art and animated presence

The existing avatar gallery now offers an optional 3D view of all six Turtleand identities. Visitors can switch between the canonical SVG and a real dimensional model while keeping the selected version and its localized story. Warm Presence is the selected expression: rounded hazel eyes, softened upper lids and a gentle closed smile, carried consistently through the entire lineage.

## Visual treatment

Warm brown shell surfaces, muted olive or golden skin, silver equipment and restrained turquoise inlays retain the identity progression. The head, body, shell and version-specific equipment are preserved from Sculpted Warmth. The final face uses smaller pupils, a narrow soft iris edge and integrated eyelids. Its natural fit with the body takes priority over copying the original SVG brow and smile literally.

The canonical resting SVGs, 18 walking poses, manifest, chronology and English/Spanish avatar stories are unchanged. The six GLBs are representation derivatives, not new identity versions. No home-page redesign, game system or extra framework is introduced.

## Implementation

The gallery uses one lazily imported `@google/model-viewer` 4.3.1 runtime inside Astro. Three.js 0.183.2 is the offline authoring dependency. The editable model and HDR generators live in `scripts/avatar-3d/`; six self-contained GLBs and one shared HDR live in `src/images/avatar/3d/`. No remote character, texture, lighting or decoder resource is required.

The gallery opens in 2D. Runtime and model downloads begin only after explicit 3D selection. The selected canonical SVG covers loading and failures. Version switching, localized metadata, chronological play, pause, manual orbit, reset and slow rotation share the existing modal. Reduced motion keeps a stable view with manual controls available. One viewer shell is reused, inactive scenes stop drawing, and late loads are guarded against replacing a newer selection.

## Current game art pass

The current derivatives retain Warm Presence and all six canonical identities. A slightly taller head/neck, larger hazel irises, rounded terminal edges and restrained vertex shading improve the character read. Shell scutes carry growth relief in their normals and darker edges; metallic braces and pistons use distinct PBR surfaces. A dark studio stage, warm key and cool rim replace the flat tan presentation.

The former static GLBs now contain an eight-second `Idle` clip with breathing, a small head attention movement and two blinks. Named anatomy pivots preserve equipment attachment and planted feet. Main play/pause, reduced motion, manual camera inspection, document visibility and modal closure govern clip playback. Rotation remains independently controlled.

Selected model, runtime and HDR transfers now start together after opt-in. An abortable GLB fetch cancels stale downloads; explicit eager loading avoids waiting for visibility inside the hidden loading host. The canonical SVG stays visible until the selected model is usable. One decoded viewer scene and the browser HTTP cache keep resource retention bounded.

The new [repository art skill](../../.agents/skills/avatar-game-art/SKILL.md) records the reusable workflow. The [current evidence](evidence/game-art/README.md) includes baseline/candidate payload and readiness results, all-version and orbit captures, actual idle rig transforms, browser interaction and failure checks. All six current models fit the 1.3 MiB / 65,000-triangle authoring targets.

Evidence under `evidence/warm-presence/` describes the preceding implementation. Its production-equivalence hashes, screenshots and performance results do not describe these regenerated models. No canonical SVG, walking pose, avatar version or localized story changes in this pass.

The normal `npm run build` validates the Netlify adapter. Browser checks use the documented production-optimized static build of the same client sources because the adapter does not support preview. This harness does not emulate Netlify request-time SSR. Narrow-screen checks are desktop-browser emulation, not physical-phone measurements.

## Reproduce

```sh
npm run generate:avatar-3d
npm run validate:avatar-3d
npm run test:avatar-3d-assets
npm run validate:avatar-evolution
npm run build
```

See [asset authoring and gallery checks](../avatar-3d-assets.md) and the [browser QA harness](../../scripts/avatar-3d/qa/README.md). Regenerating 3D assets does not require regenerating walking poses.

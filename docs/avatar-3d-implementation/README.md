# Sculpted Warmth with Warm Presence

The existing avatar gallery now offers an optional 3D view of all six Turtleand identities. Visitors can switch between the canonical SVG and a real dimensional model while keeping the selected version and its localized story. Warm Presence is the selected expression: rounded hazel eyes, softened upper lids and a gentle closed smile, carried consistently through the entire lineage.

## Visual treatment

Warm brown shell surfaces, muted olive or golden skin, silver equipment and restrained turquoise inlays retain the identity progression. The head, body, shell and version-specific equipment are preserved from Sculpted Warmth. The final face uses smaller pupils, a narrow soft iris edge and integrated eyelids. Its natural fit with the body takes priority over copying the original SVG brow and smile literally.

The canonical resting SVGs, 18 walking poses, manifest, chronology and English/Spanish avatar stories are unchanged. The six GLBs are representation derivatives, not new identity versions. No home-page redesign, game system or extra framework is introduced.

## Implementation

The gallery uses one lazily imported `@google/model-viewer` 4.3.1 runtime inside Astro. Three.js 0.183.2 is the offline authoring dependency. The editable model and HDR generators live in `scripts/avatar-3d/`; six self-contained GLBs and one shared HDR live in `src/images/avatar/3d/`. No remote character, texture, lighting or decoder resource is required.

The gallery opens in 2D. Runtime and model downloads begin only after explicit 3D selection. The selected canonical SVG covers loading and failures. Version switching, localized metadata, chronological play, pause, manual orbit, reset and slow rotation share the existing modal. Reduced motion keeps a stable view with manual controls available. One viewer shell is reused, inactive scenes stop drawing, and late loads are guarded against replacing a newer selection.

## Selected model verification

All six production models match the chosen Warm Presence review models' binary geometry, vertex colors and materials exactly. Only their wrapper names and identity metadata differ. See [production equivalence](evidence/warm-presence/production-equivalence.json). The body, equipment, canonical SVGs, walking poses and studio light remain unchanged.

All six models remain below the 2.5 MiB raw asset budget. The final export inventory is `scripts/avatar-3d/inventory.json`. Structural checks validate complete manifest coverage, distinct self-contained models, matching embedded identities and valid shared lighting. The seven asset regression tests include missing, orphaned, duplicated, corrupt, externally referenced and mismatched resources.

The final selected-model [browser matrix](evidence/warm-presence/final-browser-matrix.json) passes Chrome, Firefox and WebKit in English and Spanish at desktop and 390px widths, with all six versions rendered in each profile. The [canonical failure regression](evidence/warm-presence/final-canonical-failure.json) verifies that a missing SVG does not cover a ready 3D model and that returning to 2D or retrying a failed model keeps accurate fallback state. The [final validation summary](evidence/warm-presence/README.md) records 389 passing browser assertions, motion and timeline behavior, and the representative desktop/mobile captures. Earlier local study images and performance reports outside that directory describe previous face geometry. They are historical evidence and are not measurements of the selected final models.

The production adapter is validated with the normal `npm run build`. Browser checks use a separate production-optimized static build of the same client sources because the Netlify adapter does not support `astro preview`; this browser harness does not emulate request-time SSR. Narrow-screen checks are browser emulation, not physical-phone measurements.

## Reproduce

```sh
npm run generate:avatar-3d
npm run validate:avatar-3d
npm run test:avatar-3d-assets
npm run validate:avatar-evolution
npm run build
```

See [asset authoring and gallery checks](../avatar-3d-assets.md) and the [browser QA harness](../../scripts/avatar-3d/qa/README.md). Regenerating 3D assets does not require regenerating walking poses.

# Sculpted Warmth avatar derivatives

The avatar gallery offers a dimensional view of each existing Turtleand identity. It uses a lazily imported `@google/model-viewer` element inside the Astro gallery, self-contained GLB models, and one shared warm studio environment. The canonical resting SVGs remain the identity source. There is no new avatar version, separate experience, gameplay, or change to the 2D walk assets.

## Source and runtime boundaries

| Purpose | Location |
| --- | --- |
| Chronology, stable IDs, and English/Spanish copy | `src/data/avatarVersions.json` |
| Canonical identity artwork | `src/images/avatar/evolution/turtleand-<version>.svg` |
| Editable procedural model source and exporter | `scripts/avatar-3d/build-models.cjs` |
| Editable procedural HDR source | `scripts/avatar-3d/build-environments.cjs` |
| Export inventory | `scripts/avatar-3d/inventory.json` |
| Runtime dimensional models | `src/images/avatar/3d/turtleand-<version>.glb` |
| Shared runtime lighting | `src/images/avatar/3d/warm.hdr` |
| Typed stable-ID URL mapping | `src/data/avatar3d.ts` |
| Structural and coverage checks | `scripts/validate-avatar-3d.mjs` |

The registry enumerates the existing manifest, derives each versioned filename, and exposes `avatar3dById[id].modelUrl`. It does not maintain a second chronology or copy translated metadata. Vite resolves URLs without inlining model or environment bytes. Resolving a URL during the build does not request it in the browser; the controller assigns runtime sources only after the visitor selects 3D.

The asset directory contains exactly one model per manifest entry and `warm.hdr`. Keep editable sources, inventories, screenshots, and working exports outside that directory. The registry rejects missing models, duplicate manifest IDs or versions, and orphan files. The command-line validator additionally rejects byte-identical model files and malformed or externally referenced GLB resources. Neither check proves facial fidelity or art quality.

## Identity and expression

Warm Presence is the selected expression for all six dimensional avatars. It uses softly rounded eyes, warm hazel irises, smaller pupils, resting upper lids and a smooth closed smile. The expression is deliberately calmer than the original 2D brow treatment: the selected 3D direction prioritizes a natural fit with the sculpted body while retaining canonical eye placement, cheek markings, muzzle proportions and overall identity.

Keep the treatment stylized, with integrated eyelid transitions and restrained highlights. Avoid full pale eye rings, prominent bulging lenses, inward-scowling lids, exaggerated creases, sharp smile hooks or a wavy smirk. Compare front, opening three-quarter and side views at the gallery's actual display size. A technically valid model is insufficient evidence of a successful expression.

| Manifest ID | Version-specific identity |
| --- | --- |
| `genesis-shell` | Golden organic skin, brown segmented shell, gentle closed smile, spotted legs and yellow toes. No technology. |
| `quantum-shell` | Olive skin, green shell circuitry, separate cyan underside light, Warm Presence expression. No wearable equipment. |
| `tech-nomad` | Turquoise circuitry and the wrist terminal. No headset. |
| `network-visitor` | Headset and wrist terminal, with organic legs. |
| `hydraulic-brace` | Hydraulic lineage with silver braces, cyan circular joints, and exposed organic toes. |
| `frontier-cartographer` | Hydraulic lineage plus the fine shell network/map, nodes, and circular compass badge. |

Shared geometry is appropriate where canonical proportions actually agree. Equipment, palette, and shell detail retain their version-specific treatment; the selected expression stays consistent across the lineage. For rear and underside surfaces absent from the SVG, continue the visible shell curvature and material language, mirror ordinary anatomy conservatively, and avoid inventing prominent equipment. Review these interpretations from every allowed orbit angle.

## Authoring and export

The editable asset source is JavaScript geometry and material construction using Three.js and its `GLTFExporter`. Model-viewer is the delivery runtime; Three.js authoring helpers are not imported by the gallery controller. The selected toolchain is Three.js 0.183.2 for authoring and model-viewer 4.3.1 for delivery. Keep these versions pinned in the package manifest and lockfile when regenerating assets.

Models use glTF's right-handed coordinate system with positive Y up and the face toward positive Z. Keep all versions at the same visual scale, with feet on the shared ground plane and the model centered consistently. Coordinates are normalized character units rather than claims about a physical turtle's size. Preserve that framing contract when replacing geometry so switching versions does not jump or crop the face.

Sculpted Warmth uses satin skin, brown shell scutes, clearly separated silver equipment, restrained cyan emission, and a soft grounded studio shadow. PBR base colors are authored as colors and exported through Three.js; use roughness and metalness to separate skin, shell, and equipment before increasing light intensity. Runtime GLBs embed their geometry, materials, and any texture resources. Do not link remote textures, decoders, or buffers from an individual model.

The current geometry and studio lighting are procedural work authored for this project. No external character mesh, stock HDR photograph, or raster avatar reference is embedded in the runtime derivatives. Three.js is MIT-licensed; model-viewer is Apache-2.0-licensed. Record attribution and license details here before introducing third-party geometry, textures, or lighting.

To regenerate, use `generate:avatar-3d`, which runs the model exporter and shared environment generator in `scripts/avatar-3d/`, then validate the resulting files. Each exported model carries its existing stable ID, `v`-prefixed version, and `Sculpted Warmth` direction in the root node's glTF extras:

```bash
npm run generate:avatar-3d
npm run validate:avatar-3d
npm run validate:avatar-evolution
npm run build
git diff --check
```

Do not regenerate walking SVGs merely because a 3D model changed. The canonical vectors, gait specification, archived references, and walking derivatives are independent of this export. If a canonical identity intentionally changes, follow [the complete avatar versioning protocol](avatar-versioning.md).

## Asset validation

`npm run validate:avatar-3d` checks complete manifest coverage, unique stable IDs and versions, the exact derivative file set, distinct model files, matching embedded identity/direction metadata, GLB 2 headers and aligned chunks, embedded buffer boundaries, geometry/material references, and the shared Radiance HDR header. It rejects resource URIs so a model cannot silently fetch a secondary file. `node scripts/validate-avatar-3d.mjs --json` reports each model's ID, raw/gzip sizes, digest, and basic geometry counts without publishing machine-specific paths. The production build runs the same asset check through `prebuild`.

`npm run test:avatar-3d-assets` exercises missing/orphan derivatives, duplicate identities and files, a valid model assigned to the wrong identity/direction, truncated/corrupt GLBs, external resources, invalid geometry references, and invalid lighting. These are structural regression checks, not a full Khronos glTF conformance validator, GPU test, mesh intersection check, or artistic rating.

Keep the existing `validate:avatar-evolution` gate unchanged. It continues to enforce canonical SVGs, generated poses, archive isolation, and English/Spanish parity. The dimensional checks supplement that contract.

## Gallery validation

Verify the production build in Chromium, Firefox, and WebKit, English and Spanish, desktop and 390px layouts:

- Open in 2D and confirm no 3D runtime, model, environment, decoder, preload, or prefetch request before explicit opt-in. Only the selected model should load afterward.
- Inspect every version's front, opening three-quarter, side, and rear against its canonical SVG. Capture desktop and mobile comparisons, with particular attention to the face, equipment sequence, shading, ground contact, and clipping.
- Switch representations and navigate rapidly while loads are delayed. The selected version's SVG must remain visible until its own model is usable; stale completions must not replace a newer selection.
- Exercise chronological play, main pause, independent rotation, manual orbit, reset, previous/next, restart, final-stage rest, and the existing 2D one-shot walk behavior. Main pause stops automatic movement; manual inspection pauses chronology.
- Exercise keyboard and touch controls, visible focus, target sizes, modal focus containment, Escape, focus return, and comfortable vertical scrolling.
- Under reduced motion, keep both representations stable with no automatic movement, transition effects, or walking-image requests. Manual camera controls remain available.
- Block or corrupt the runtime and GLB, simulate graphics unavailability/context loss, and close while loading. The localized failure state retains the canonical SVG and usable navigation, retry, and 2D recovery.
- Hide, close, and reopen the gallery. Confirm render scheduling stops when inactive and resource retention remains bounded through at least 20 full-lineage/open-close cycles.
- Compare unopened-Portal performance and layout against a production baseline. Record actual payload, first usable frame, animation cadence/render telemetry, and lifecycle measurements with their device and browser conditions.

Keep each model below 2.5 MiB raw, load no 3D resources before opt-in, and verify responsive controls and stable layout on the actual production build. Record payload and device conditions with any performance result. See the [selected implementation record](avatar-3d-implementation/README.md) for measured outcomes and final-model evidence.

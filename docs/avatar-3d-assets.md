# Turtleand 3D avatar derivatives

The avatar gallery offers a dimensional view of each existing Turtleand identity. It uses a lazily imported `@google/model-viewer` element inside the Astro gallery, self-contained GLB models, and one shared warm studio environment. The canonical resting SVGs remain the identity source. There is no new avatar version, separate experience, gameplay, or change to the 2D walk assets.

## Source and runtime boundaries

| Purpose | Location |
| --- | --- |
| Chronology, stable IDs, and English/Spanish copy | `src/data/avatarVersions.json` |
| Canonical identity artwork | `src/images/avatar/evolution/turtleand-<version>.svg` |
| Editable procedural model source and exporter | `scripts/avatar-3d/build-models.cjs` |
| Stage-specific art direction | `scripts/avatar-3d/directions.json` |
| Organic shapes, face, and planted stance | `scripts/avatar-3d/art-anatomy.cjs` |
| Scute geometry, circuits, and route map | `scripts/avatar-3d/art-shell.cjs` |
| Wearable equipment | `scripts/avatar-3d/art-hardware.cjs` |
| Baked shading and Living Shell skin relief | `scripts/avatar-3d/art-surfaces.cjs` |
| Reusable character art and animation skill | `.agents/skills/avatar-game-art/SKILL.md` |
| Editable procedural HDR source | `scripts/avatar-3d/build-environments.cjs` |
| Export inventory | `scripts/avatar-3d/inventory.json` |
| Runtime dimensional models | `src/images/avatar/3d/turtleand-<version>.glb` |
| Shared runtime lighting | `src/images/avatar/3d/warm.hdr` |
| 3D filmstrip previews | `src/images/avatar/3d-thumbnails/turtleand-<version>.webp` |
| Typed stable-ID URL mapping | `src/data/avatar3d.ts` |
| Structural and coverage checks | `scripts/validate-avatar-3d.mjs` |

The registry enumerates the existing manifest, derives each versioned filename, and exposes `avatar3dById[id].modelUrl`. It does not maintain a second chronology or copy translated metadata. Vite resolves URLs without inlining model or environment bytes. Resolving a URL during the build does not request it in the browser; the controller assigns runtime sources only after the visitor selects 3D.

The asset directory contains exactly one model per manifest entry and `warm.hdr`. Keep editable sources, inventories, screenshots, and working exports outside that directory. The registry rejects missing models, duplicate manifest IDs or versions, and orphan files. The command-line validator additionally rejects byte-identical model files and malformed or externally referenced GLB resources. Neither check proves facial fidelity or art quality.

## Identity and expression

The six models interpret the canonical SVG expressions with inset, upward-curving lids, quiet catchlights, cheek pigment, broad muzzles, and closed smiles. Genesis has an olive-gold brow and amber iris. Later stages have darker irises. Check the eye opening, spot placement, and smile corners in the front and opening views at gallery size.

| Manifest ID | Selected direction | Version-specific identity |
| --- | --- | --- |
| `genesis-shell` | Living Shell | Golden organic skin, olive brow, chestnut shell, spotted legs, and gold nails. |
| `quantum-shell` | Illustrated Sculpt | Olive skin, green shell circuitry, and a separate cyan underside panel. |
| `tech-nomad` | Illustrated Sculpt | Turquoise angular inlays and the wrist terminal. |
| `network-visitor` | Living Shell | Ear module and wrist terminal with organic legs. |
| `hydraulic-brace` | Carved Patina | Lower stance, broader face and scute bevels, silver pistons, cyan joints, and exposed gold nails. |
| `frontier-cartographer` | Living Shell | Hydraulic braces with fine routes and waypoints layered over the main circuits, plus one compass badge. |

Shared anatomy maintains the lineage. Illustrated Sculpt emphasizes clean planes and quiet finishes. Living Shell adds fine skin relief and keratin-like growth shading. Carved Patina emphasizes the wider stance, contoured metal, and warm bevels. For unseen surfaces, continue the shell curvature and material language and mirror ordinary anatomy conservatively.

## Authoring and export

The editable asset source is JavaScript geometry and material construction using Three.js and its `GLTFExporter`. Model-viewer is the delivery runtime; Three.js authoring helpers are not imported by the gallery controller. The selected toolchain is Three.js 0.183.2 for authoring and model-viewer 4.3.1 for delivery. Keep these versions pinned in the package manifest and lockfile when regenerating assets.

Models use glTF's right-handed coordinate system with positive Y up and the face toward positive Z. Keep all versions at the same visual scale, with feet on the shared ground plane and the model centered consistently. Coordinates are normalized character units rather than claims about a physical turtle's size. Preserve that framing contract when replacing geometry so switching versions does not jump or crop the face.

The shared studio uses a warm key, cool rim, and contact shadow. The opening camera favors the visible shell and face. The minimum orbit radius increases as the stage narrows to give the model clearance through rotation. PBR roughness and metalness separate skin, keratin, silver, and dark housings. Normalized byte vertex colors carry head pigments and scute shading. Living Shell variants embed one small procedural normal tile shared by the head and skin materials. All resources are self-contained in the GLBs.

Each derivative exports one eight-second `Idle` clip. Named shell and head pivots add small breathing and attention movements, and eye pivots close briefly for two blinks per loop. Feet stay planted and attached equipment follows its anatomical owner. The exporter batches geometry by material **within each pivot**, retaining animation instead of flattening the entire character. Eye pigmentation shares one glossy material per eye. During the guided tour, the character plays Idle while the camera stays at the opening angle. Manually rotating the model or choosing a filmstrip thumbnail pauses the tour. Reduced motion starts with playback paused and uses cuts without character animation when the visitor starts the tour.

The controller starts the selected GLB, runtime and shared HDR downloads together after 3D opt-in. It validates the GLB header, cancels obsolete model transfers, and passes an owned blob URL to an explicitly eager viewer. That URL is released after decode or cancellation. Once the current stage is ready, the running tour can buffer one adjacent GLB during its 3.5-second dwell. The gallery keeps one viewer and holds a frame of the outgoing model through the next decode, then fades to the new model in 300 milliseconds. Slow feedback starts at four seconds, dependency failure is bounded at twenty seconds, and the whole load at thirty seconds. The canonical SVG covers initial loading and recovery.

Render one compact, transparent WebP per GLB from the opening three-quarter view, with warm lighting and consistent framing. Render the production model at rest, with its full face and shell in view. The filmstrip reads these previews after 3D opt-in. The SVG evolution validator checks version coverage and keeps historical reference rasters outside production.

The current geometry and studio lighting are procedural work authored for this project. No external character mesh, stock HDR photograph, or raster avatar reference is embedded in the runtime derivatives. Three.js is MIT-licensed; model-viewer is Apache-2.0-licensed. Record attribution and license details here before introducing third-party geometry, textures, or lighting.

To regenerate, use `generate:avatar-3d`, which runs the model exporter and shared environment generator in `scripts/avatar-3d/`, then validate the resulting files. Each exported model carries its existing stable ID, `v`-prefixed version, and the stage selection from `directions.json` in its root node's glTF extras.

```bash
npm run generate:avatar-3d
npm run validate:avatar-3d
npm run validate:avatar-evolution
npm run build
git diff --check
```

Do not regenerate walking SVGs merely because a 3D model changed. The canonical vectors, gait specification, archived references, and walking derivatives are independent of this export. If a canonical identity intentionally changes, follow [the complete avatar versioning protocol](avatar-versioning.md).

## Asset validation

`npm run validate:avatar-3d` checks complete manifest coverage, unique stable IDs and versions, the exact derivative file set, distinct model files, matching embedded identity/direction metadata, GLB 2 headers and aligned chunks, embedded buffer boundaries, geometry/material references, and the shared Radiance HDR header. Optional animation validation checks local references, finite samples, strictly increasing time keys, interpolation and matching output shapes/counts. It rejects resource URIs so a model cannot silently fetch a secondary file. `node scripts/validate-avatar-3d.mjs --json` reports each model's ID, raw/gzip sizes, digest, mesh/material counts and animation coverage without publishing machine-specific paths. The production build runs the same asset check through `prebuild`.

`npm run test:avatar-3d-assets` exercises missing/orphan derivatives, duplicate identities and files, a valid model assigned to the wrong identity/direction, truncated/corrupt GLBs, external resources, invalid geometry references, invalid lighting, and valid/malformed animation clips. These are structural regression checks, not a full Khronos glTF conformance validator, GPU test, mesh intersection check, or artistic rating.

Keep the existing `validate:avatar-evolution` gate unchanged. It continues to enforce canonical SVGs, generated poses, archive isolation, and English/Spanish parity. The dimensional checks supplement that contract.

## Gallery validation

Verify the production build in Chromium, Firefox, and WebKit, English and Spanish, desktop and 390px layouts:

- Open in 2D and confirm no 3D runtime, model, environment, thumbnail, decoder, preload, or prefetch request before explicit opt-in. After opt-in the current model loads first. During a running tour, only the following model can buffer in advance.
- Inspect every version's front, opening three-quarter, side, and rear against its canonical SVG. Capture desktop and mobile comparisons, with particular attention to the face, equipment sequence, shading, ground contact, and clipping.
- Switch representations and navigate rapidly while loads are delayed. Check the initial SVG, then verify that 3D-to-3D handoffs retain the outgoing model until the incoming one is ready. Stale completions must never replace a newer selection.
- Exercise automatic tour entry, pause, replay, direct thumbnail selection, manual orbit, final-stage rest, and the existing 2D one-shot walk behavior. A thumbnail selection or manual orbit pauses the tour.
- Exercise keyboard and touch controls, visible focus, target sizes, modal focus containment, Escape, focus return, and comfortable vertical scrolling.
- Under reduced motion, keep both representations stable at entry. Verify that a visitor can orbit, select thumbnails, or explicitly start the 3D tour with cuts and without Idle motion. Check that 2D does not request walking images.
- Block or corrupt the runtime and GLB, simulate graphics unavailability/context loss, and close while loading. The localized failure state retains the canonical SVG and usable navigation, retry, and 2D recovery.
- Hide, close, and reopen the gallery. Confirm render scheduling stops when inactive and resource retention remains bounded through at least 20 full-lineage/open-close cycles.
- Compare unopened-Portal performance and layout against a production baseline. Record actual payload, first usable frame, animation cadence/render telemetry, and lifecycle measurements with their device and browser conditions.

Target fewer than 65,000 triangles, 50 meshes and 1.3 MiB raw per model; retain the 2.5 MiB raw ceiling. Load no 3D resources before opt-in and verify responsive controls and stable layout on the actual production build. Record payload and device conditions with every performance result. See the [current implementation record](avatar-3d-implementation/README.md) for measured outcomes and final-model evidence. The Warm Presence and game-art evidence directories record earlier models.

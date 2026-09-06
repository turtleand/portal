# SVG-first avatar versioning

Turtleand's canonical avatars live in Portal as vectors. A raster image may begin the artistic process, but it is a reference artifact, not a production gallery asset. The optional 3D gallery uses dimensional derivatives of those same identities; it does not replace the canonical SVGs or create new versions.

## Source-of-truth map

| Purpose | Location | Rule |
| --- | --- | --- |
| Version metadata and English/Spanish copy | `src/data/avatarVersions.json` | Keep entries chronological and unique. |
| Canonical resting avatar | `src/images/avatar/evolution/turtleand-<version>.svg` | This is the production identity asset. |
| Walking poses | `src/images/avatar/evolution/walking/<version>/` | Generate `contact-a.svg`, `passing.svg`, and `contact-b.svg`. |
| Static concept reference | `src/images/avatar/archive/raster/` | Archive only. Never import it from production code. |
| Limb and gait specification | `scripts/avatar-walk-config.mjs` | Define four limb regions, pivots, gait pairing, and occlusion order. |
| Pose generator | `scripts/generate-avatar-walk-poses.mjs` | Generated poses must derive from the canonical SVG. |
| Contract validator | `scripts/validate-avatar-evolution.mjs` | Enforces manifest, archive, SVG, pose, safety, and localization parity. |
| Optional dimensional derivatives | `src/images/avatar/3d/turtleand-<version>.glb` | One self-contained model for every manifest version. Canonical SVGs remain authoritative. |
| Shared 3D studio light | `src/images/avatar/3d/warm.hdr` | One Sculpted Warmth lighting environment, loaded only after 3D opt-in. |
| 3D asset registry and validator | `src/data/avatar3d.ts`, `scripts/validate-avatar-3d.mjs` | Derive stable-ID mappings from the manifest and reject incomplete, duplicate, or orphan assets. |

`src/data/avatarEvolution.ts` resolves canonical and walking SVGs from the manifest. Missing SVG assets fail explicitly during development and build instead of silently falling back to raster images.

`src/data/avatar3d.ts` resolves optional 3D asset URLs from that same manifest. This adds a representation switch inside the existing gallery, not a second gallery. Missing dimensional derivatives also fail the build. See [3D authoring and validation](avatar-3d-assets.md) for the source workflow, expression rules, and model checks. A runtime 3D failure keeps the selected canonical SVG available.

## Adding a version

1. Choose the semantic version and date. Add the version only after the visual direction has been selected.
2. Create a static concept from the latest avatar, the immediately previous canonical SVG, and the full SVG lineage. Record the face, eye shape, smile, head proportions, shell silhouette, stance, outline style, palette, textures, and accessories that must remain recognizable.
3. Save the approved concept in `src/images/avatar/archive/raster/` as `turtleand-<version>-reference-<YYYY-MM-DD>.png`. Existing files with `transparent` in the name are retained historical references.
4. Reconstruct `src/images/avatar/evolution/turtleand-<version>.svg`. Preserve the concept's silhouette, proportions, colors, facial features, shell geometry, textures, accessories, shadows, and personality while maintaining continuity with earlier vectors.
5. Keep the canonical SVG direct, flat, and self-contained: `viewBox="0 0 1024 1024"`, accessible `<title>` and `<desc>`, and exactly one visible `<g data-group="artwork">`. That artwork group must contain ID-free visible shapes directly, with no nested `<g>`, `<defs>`, gradients that require definition IDs, masks, clips, or `<use>` reconstruction. Also exclude scripts, external resources, raster images, event handlers, and generated pose geometry. The pose generator embeds those direct children into namespaced pose definitions; the flat, ID-free contract prevents duplicate IDs and broken references. Expand the generator and validator together before introducing definition-based canonical artwork.
6. Add the new version to `src/data/avatarVersions.json` with nonempty English and Spanish title and description fields.
7. Add four carefully bounded limb regions and natural pivots to `avatarRegions` in `scripts/avatar-walk-config.mjs`. Add the diagonal gait pair, behind-body limbs, and organic or mechanical behavior to `avatarGaits`. Exclude the face, head, shell, circuits, map, shadows, and accessories from moving regions.
8. Run `npm run generate:avatar-walk-poses`. Never hand-edit generated pose files. The generator embeds the canonical artwork unchanged and articulates clipped limb copies around the configured pivots.
9. Compare the raster concept, canonical rest SVG, and all three poses. Reject duplicated feet, detached geometry, curved background fragments, clipped accessories, changed shell or face details, implausible occlusion, or a rest SVG altered to accommodate motion.
10. Create the matching 3D derivative using [the dimensional asset workflow](avatar-3d-assets.md). Preserve the canonical identity and equipment progression, using the selected 3D expression treatment. Compare the front, opening three-quarter, side, and rear views; interpret unseen surfaces conservatively. The representation upgrade itself never justifies a manifest version bump.
11. Run the complete validation loop below. A version is not complete until every gate passes.

## Validation loop

Run the deterministic source gates:

```bash
npm run generate:avatar-walk-poses
npm run validate:avatar-evolution
npm run validate:avatar-3d
npm run build
git diff --check
```

Then test the real gallery in English and Spanish:

- Open, close, and reopen the modal. Confirm there is one evolution gallery, opening in 2D, with an optional 3D representation control and no archived-raster gallery.
- Confirm all stages appear chronologically and each stage walks once before autoplay advances.
- Test play, pause, resume, restart, previous, next, keyboard focus containment, Escape, and focus return.
- Confirm a failed walking pose keeps the canonical resting SVG visible and does not disable other stages.
- Throttle or delay pose loading and test pause, resume, restart, and manual previous/next navigation while loading is in flight. Confirm stale completions cannot change the current stage or restore autoplay against the visitor's latest intent.
- Confirm walking and evolution transitions never overlap.
- Confirm the final stage stops cleanly at rest.
- With `prefers-reduced-motion: reduce`, confirm only canonical rests render, navigation is immediate, effects remain off, and walking-pose assets are not requested.
- Capture desktop and 390px mobile screenshots for every rest and walking pose. Check visual fidelity, modal scrolling, focus visibility, horizontal overflow, and layout stability.
- Inspect browser resources and production source to confirm archived raster references are never requested or imported.
- Run the [3D gallery checks](avatar-3d-assets.md#gallery-validation). Verify version and localized metadata survive representation changes, the canonical SVG covers loading/failure, and no 3D resources are requested before opt-in.
- Review the final diff for generated build output, unrelated changes, private paths, credentials, internal notes, or unsafe operational details.

If any gate or visual comparison fails, correct the canonical SVG, gait boundaries, metadata, or runtime behavior and repeat the affected checks. Stop only when the full contract is proven and further changes would be subjective rather than corrective.

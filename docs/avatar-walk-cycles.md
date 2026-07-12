# Avatar walk cycles

The animated evolution gallery keeps each canonical SVG as its untouched resting pose. Every avatar also has three generated walking poses under `src/images/avatar/evolution/walking/<version>/`:

1. `contact-a.svg`
2. `passing.svg`
3. `contact-b.svg`

Run `npm run generate:avatar-walk-poses` after intentionally changing a canonical vector or its limb-boundary configuration, then run `npm run validate:avatar-evolution`.

For the complete static-concept, canonical-SVG, metadata, and release workflow, see `docs/avatar-versioning.md`.

## Why the poses use layered articulation

The traced avatar vectors contain many anonymous paths, and several foundational paths combine the shell, body, and multiple legs into one contour. Literal path interpolation or moving those paths independently would distort the canonical avatar and recreate the duplicated-leg artifacts this gallery is designed to avoid.

The pose generator therefore embeds the canonical artwork unchanged, masks four carefully bounded limb regions, and rotates clipped copies around natural organic or mechanical joints. The shell, head, face, textures, circuits, map, and accessories remain untouched. The live component swaps the three pose frames crisply and adds restrained wrapper and ground-shadow motion. This is more faithful and maintainable than forcing incompatible path morphs.

The resting frame is never reconstructed from clips. It always uses the original canonical SVG because clip edges can introduce small antialiasing differences even when every transform is at its identity value.

## Runtime behavior

- A walk is a one-shot sequence lasting about 1.8 seconds.
- Every stable evolution stage walks once before autoplay advances.
- Walking and evolution transitions are mutually exclusive.
- Pose images load only when their stage is visited or preloaded for an imminent transition.
- A pose-load failure skips that walk without disabling the canonical evolution gallery.
- Reduced-motion mode uses only canonical resting SVGs and instant stage navigation.

# Turtleand 3D gallery

The Portal gallery offers an optional orbitable model for each of the six existing Turtleand stages. The selected concept art informed the editable models. The gallery uses the original SVGs for 2D, the walking poses, and the loading and recovery states.

| Stage | Direction |
| --- | --- |
| v0.0.1 The Genesis Shell | Living Shell |
| v0.0.2 The Quantum Shell | Illustrated Sculpt |
| v0.0.3 The Tech Nomad | Illustrated Sculpt |
| v0.0.4 The Network Visitor | Living Shell |
| v0.1.0 The Hydraulic Brace | Carved Patina |
| v0.1.1 The Frontier Cartographer | Living Shell |

The models add inset eyes, sculpted lids, closed smiles, grounded feet, flared shell plates, and equipment shaped around the body. Living Shell embeds fine skin relief. Illustrated Sculpt uses smoother surfaces. The Hydraulic Brace crouches lower and uses broader scute bevels. The Cartographer retains both the luminous primary circuitry and a finer route network. The shared studio and responsive camera let visitors see the face and shell together.

Three.js authors the models offline. The gallery loads model-viewer, the studio HDR, and the selected GLB on 3D opt-in. A model carries its own materials, geometry, rig, Idle clip, and any normal map. English and Spanish visitors use the same models and their localized names, stories, and controls.

## Verification

The [desktop opening views](evidence/selected-directions/lineage.webp) and [390px Spanish gallery](evidence/selected-directions/gallery-390-es.webp) show the production-optimized client. Front, side, rear, high and low views were reviewed for each avatar, and fixed-camera captures verified the blink and breath. The real-time materials use shallower grain and simpler contours than the concept images.

The Netlify production build, avatar asset and SVG validators, and eleven structural asset tests passed. The browser matrix passed 372 checks in Chrome, Firefox and WebKit across desktop and 390px, in English and Spanish. Recovery, loading, animation and lifecycle suites passed 81 additional checks. This covered blocked and corrupt assets, graphics context loss, reduced motion, keyboard and touch controls, and a 20-cycle gallery reopen test. The unchanged timed 2D chronology and hung-dependency timeout cases were outside this review. The hidden-document case used a synthetic visibility event in headless Chrome.

The largest model is 1,325,496 raw bytes, with 53,794 triangles and 27 meshes. The Cartographer transfers 839,007 gzip bytes, up from 623,275 bytes. Across three cold Chrome runs per profile, median click-to-ready was 145 ms desktop and 1,285 ms at 390px with simulated 10 Mbit/s, 80 ms latency and 4× CPU slowdown, compared with 113 ms and 1,103 ms for the previous assets. No 3D resources were requested before opt-in. The browser runs used the production-optimized static client and desktop emulation.

## Reproduce

Reproduce with `npm run generate:avatar-3d`, `npm run validate:avatar-3d`, `npm run test:avatar-3d-assets`, `npm run validate:avatar-evolution`, and `npm run build`. The [asset authoring guide](../avatar-3d-assets.md) and [browser QA guide](../../scripts/avatar-3d/qa/README.md) describe review conditions. Earlier [game art](evidence/game-art/README.md) and [Warm Presence](evidence/warm-presence/README.md) reports measure earlier asset versions.

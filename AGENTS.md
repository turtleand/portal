# AGENTS.md — portal

See `CLAUDE.md` for architecture and bot-layer requirements.

## Scope

Applies only to `portal/`.

## Ecosystem role

- Portal is the identity hub, narrative entry point, and routing layer for the Turtleand ecosystem.
- Its primary job is coherence: help visitors understand what Turtleand is and where to go next.
- It should stay focused on orientation, trust, featured work, and cross-site navigation rather than absorbing specialized content from the other properties.

## Project summary

- Stack: Astro, multilingual (`en` at `/`, `es` at `/es/`)
- Status: Active
- Primary function: brand architecture, ecosystem framing, and traffic routing

## Workflow

1. Read `README.md`, `CLAUDE.md`, and local docs before structural changes.
2. Keep routing and content parity between English and Spanish when relevant.
3. Prefer source edits under `src/`.
4. Avoid changing generated output in `dist/`, `coverage/`, or other incidental artifacts unless explicitly asked.

## Content guidance

- Keep copy oriented around identity, ecosystem framing, and navigation across projects.
- Preserve the portal as the place that explains the whole platform before a visitor dives into a specialized property.
- When adding links or sections, make the intended visitor path clearer: learn, read, build, operate, or explore.

## Cross-project boundaries

- Route curriculum and technical learning-path work to `ai-lab/`.
- Route engineering blog content to `build/`.
- Route persistent-agent operations and deployment practices to `openclaw/`.
- Route tool-landscape cataloging to `ai-atlas/`.
- Route compact doctrine and operating principles to `handbook/`.

## Commands

- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`

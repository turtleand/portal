# AGENTS.md - portal

See `CLAUDE.md` for architecture and bot-layer requirements. This file gives repository-level guidance for Codex automatic PR reviews and other AI agents.

## Scope

Applies only to `portal/`.

## Ecosystem role

- Portal is the identity hub, narrative entry point, and ecosystem router for Turtleand.
- Its job is coherence: help visitors understand what Turtleand is and where to go next.
- Preserve Portal as the router and trust layer, not the place for every specialized artifact.
- Do not collapse AI Lab, Growth, Build, Handbook, OpenClaw, AI Atlas, Chain Lab, or Hermes Lab into Portal unless explicitly directed.
- Route specialized content to the appropriate surface and use Portal to clarify the visitor path.

## Project summary

- Stack: Astro, multilingual (`en` at `/`, `es` at `/es/`)
- Status: Active
- Primary function: brand architecture, ecosystem framing, and traffic routing

## Workflow

1. Read `README.md`, `CLAUDE.md`, and local docs before structural changes.
2. Keep routing and content parity between English and Spanish when relevant.
3. Prefer source edits under `src/`.
4. Avoid changing generated output in `dist/`, `coverage/`, or other incidental artifacts unless explicitly asked.

## Public-safety review

Reject changes that expose secrets, credentials, private infrastructure details, internal paths, specific vulnerabilities, or operational weaknesses. Safe public lessons are allowed when they describe general patterns, architecture trade-offs, defensive principles, or non-sensitive implementation choices.

Keep private things private. Share learnings, not exposure.

## Content quality review

- Keep copy high-trust, orientation-focused, and useful for first-time visitors.
- Review navigation, ecosystem cards, links, schemas, canonical URLs, sitemap behavior, and Spanish or English route parity where relevant.
- Favor clarity over cleverness and coherence over completeness.
- Avoid overclaiming, hype, and adding specialized artifacts that belong on another surface.
- Preserve Turtleand voice: calm, precise, direct, reflective when useful, practical when needed.
- Do not introduce em dashes in public writing.
- Keep humans responsible for direction, judgment, taste, ethics, and consequences.

## Repository integrity review

- Keep changes focused to the branch purpose.
- Do not silently modify generated or build output unless the repo explicitly tracks it or the change requires regeneration.
- Keep routes, navigation, schemas, canonical URLs, sitemaps, indexes, translations, and AI-readable artifacts in sync when the repo uses them.
- Run local validation before PR creation.

## PR review checklist

Codex and other agents should check:

- Does the change strengthen Portal as identity hub and ecosystem router?
- Are navigation and visitor paths clearer after the change?
- Is anything private, unsafe, or operationally sensitive exposed?
- Are links, schemas, canonical URLs, sitemap behavior, routes, and translations still correct?
- Is the diff small, coherent, and free from unrelated cleanup?

## Commands

- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`

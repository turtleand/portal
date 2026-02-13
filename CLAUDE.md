# CLAUDE.md — Portal (turtleand.com)

## Agent-Friendly PR Checklist
Every content PR must include:
- [ ] `public/llms.txt` updated if new pages/sections added
- [ ] JSON-LD schema present in any new page layouts
- [ ] Meta description meaningful (not placeholder)
- [ ] OG tags (og:title, og:description, og:type) present
- [ ] No personal identifying info — author is always "Turtleand" (pseudonymous)
- [ ] No LinkedIn links anywhere

## Bot Translation Layer
This site uses a "bot translation layer" — structured content for AI agents:
- `/llms.txt` — Site map for AI agents (update when adding pages)
- `/_headers` — Content Signals (ai-train=yes, search=yes, ai-input=yes)
- JSON-LD structured data in all page layouts

## Stack
- Astro 4 + Tailwind + Netlify SSR
- i18n: EN + ES (`src/content/i18n/`)
- Hub site linking to: growth, lab, build, openclaw subdomains

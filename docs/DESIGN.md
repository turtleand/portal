# Turtleand Portal — Current Design Reference

**Purpose:** capture how the production branch currently looks/behaves so future passes know what is in place and what is still pending.

---

## 1. Status Snapshot

- **Framework:** Astro 4 + TailwindCSS 3 with a single `Layout` shell that loads Playfair Display and Inter from Google Fonts and injects global CSS tokens (`src/styles/globals.css`).
- **Shipped sections:** animated hero background with editorial copy, quadrant navigation powered by `QuadrantGrid`/`DomainCard`, and a placeholder footer banner.
- **Interaction polish:** card hover glow, subtle lift, and staggered fade-up entrance powered by custom keyframes declared in Tailwind config.
- **Not yet implemented:** logo artwork, navigation links, scroll indicator/CTA, detailed footer content, and per-domain destination pages (cards currently deep-link to external subdomains).

---

## 2. Visual System

### Color Tokens (from `:root` in `globals.css`****)

| Token / Usage             | Hex        | Notes                                                                |
| ------------------------- | ---------- | -------------------------------------------------------------------- |
| `--color-deep-blue`       | `#0E1E2B`  | Page background + body fill                                          |
| `--color-teal`            | `#2E8373`  | Secondary tone, used inside the radial hero gradient                 |
| `--color-off-white`       | `#F4F4F4`  | Primary text                                                         |
| `--color-muted`           | `#A8B3BA`  | Supporting copy (hero subline, domain taglines)                      |
| `--color-accent`          | `#6FE1C3`  | Focus ring + intended CTA/interactive accents                        |
| `--card-ai`               | `#041C2C`  | Domain card background: AI                                           |
| `--card-growth`           | `#0D2F2A`  | Domain card background: Growth                                       |
| `--card-build`            | `#051722`  | Domain card background: Build                                        |
| `--card-blockchain`       | `#0F343E`  | Domain card background: Blockchain                                   |
| Gradient (utility class)  | teal → navy radial | Applied through `.hero-gradient`; animated with `heroWave` keyframes |

### Typography

| Role                  | Font Stack                                  | Weight(s) in use | Implementation detail                                      |
| --------------------- | ------------------------------------------- | ---------------- | ---------------------------------------------------------- |
| Headings (`font-heading`) | Playfair Display, Georgia, serif             | 500, 600         | Hero H1 (`text-4xl` → `text-6xl`), card titles (`text-3xl`) |
| Body (`font-body`)    | Inter, Helvetica Neue, Arial, sans-serif    | 400, 500         | Layout body copy, nav placeholders, card taglines          |

---

## 3. Layout & Components

### Layout Shell (`src/layouts/Layout.astro`)

- Applies dark background, off-white text, and the `font-body` class to `<body>`.
- Injects SEO meta, Google Font preconnects, and exposes `<slot />` for page content plus a named footer slot.
- No global header/footer component yet; children must supply them.

### Hero (`src/components/Hero.astro`)

- Split across two stacked sections sharing the animated radial gradient background.
- **Top bar:** placeholder text for logo (`"TODO: add logo"`) and nav (`"TODO: add relevant navigation"`); nav hidden below `md`.
- **Main hero copy:** centered content block (`max-w-3xl`) with the line “Where Humans and Technology Evolve Together” and supporting paragraph. No CTA button or scroll indicator is present yet.

### Quadrant Navigation (`src/components/QuadrantGrid.astro` + `DomainCard.astro`)

- Grid renders four cards sourced from a local `domains` array (AI, Growth, Build, Blockchain) with emoji badges and descriptive taglines.
- Layout: single column on mobile, switches to two columns at `md` and stays two columns on larger breakpoints (there is no 4-up desktop layout yet).
- Card styling (`card-surface` + `card-content`):
  - Variant-specific dark backgrounds tied to the tokens above.
  - Gradient border glow appears on hover/focus via a pseudo-element; cards lift by `translateY(-4px)` and scale to `1.02`.
  - Focus-visible rings respect accessibility guidelines (`ring-accent` on top of deep blue offset).
  - Entry animation: `animate-fadeUp` with a stagger controlled by inline `animation-delay`.
- Each card links to an external Turtleand subdomain (`https://{domain}.turtleand.com`).

### Footer (`src/components/Footer.astro`)

- Currently a minimal container with a TODO note and a subtle top border (`border-white/10`) over a solid `#0b1823` background.
- Needs real navigation/content before launch.

---

## 4. Motion & Interaction

| Element / Class        | Behavior                                                                 | Source |
| ---------------------- | ------------------------------------------------------------------------- | ------ |
| `.hero-gradient.animate-heroWave` | 40s alternating background-position animation simulating gentle wave motion | Tailwind `heroWave` keyframes |
| `.card-surface` hover  | Gradient outline fade-in + scale/translate + drop shadow                  | `globals.css` |
| `.card-content.animate-fadeUp` | 0.6s fade/slide from below with per-card delay                      | Tailwind `fadeUp` keyframes |
| `.scroll-indicator`    | Styles exist but component not wired into the hero yet                    | `globals.css` |

Animations use easing curves defined inline (Tailwind’s default `ease-in-out` / `ease-out`).

---

## 5. Responsive Behavior

| Breakpoint            | Current behavior                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Base / Mobile (<768px)| Hero padding collapses to `px-6`, nav hidden; quadrant grid stacks cards vertically with full-width tiles.      |
| `md` (≥768px)         | Hero padding grows, nav appears inline, grid switches to two columns.                                          |
| `lg`+                 | No additional layout change yet (cards remain in two columns; hero text caps at `max-w-3xl`).                   |
| Motion fallback       | Media query disables hero animation below 768px, swapping to a static radial gradient for performance reasons. |

---

## 6. Outstanding TODOs / Next Design Steps

1. Design and implement the Turtleand wordmark/logo plus the supporting top navigation items.
2. Add a CTA or scroll affordance under the hero copy (existing `.scroll-indicator` styles can be reused).
3. Expand the quadrant grid to a true 4-column experience on large screens, or intentionally document the two-column choice.
4. Populate the footer with navigation, contact, and ownership metadata to balance the page.
5. Audit contrast/typography once the missing elements are in place to ensure the color tokens still meet accessibility targets.

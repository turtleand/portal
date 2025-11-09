# Turtleand — Editorial Hero + Quadrant Navigation

**Design Specification Document (for implementation)**

---

## 1. Brand Concept

**Core idea:**
Turtleand is a reflective, global, human-centered ecosystem exploring technology and systems.
The homepage acts as a gateway to four subdomains — AI, Growth, Build, and Blockchain — presented as “pillars of exploration.”
The design should feel modern, editorial, and timeless, bridging philosophical clarity with tech minimalism.

---

## 2. Visual Identity

### Color Palette

| Purpose                              | Color                                                                        | Hex                 | Notes                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------- |
| Primary Gradient 1 (Hero Background) | Deep ocean blue → teal green                                                 | `#0E1E2B → #2E8373` | Represents depth + balance between nature and technology |
| Accent Gradient 2 (Subdomain Cards)  | Soft cyan → dusk orange                                                      | `#7AD6C2 → #F9A856` | Used for hover transitions or subtle overlays            |
| Text Primary                         | Off-white                                                                    | `#F4F4F4`           | Gentle contrast on dark backgrounds                      |
| Text Secondary                       | Muted gray                                                                   | `#A8B3BA`           | Used for sublines and taglines                           |
| Card Backgrounds                     | AI: `#0C2238` / Growth: `#1B4B43` / Build: `#12313B` / Blockchain: `#3A2416` | —                   | Distinct tone per domain; dark enough to unify with hero |
| Interactive / CTA                    | Light teal                                                                   | `#6FE1C3`           | Button borders, links, hover glow                        |
| Error/Warning                        | Amber                                                                        | `#F7B267`           | Rarely used; only for subtle status elements             |

---

## 3. Typography

| Role                    | Font Family      | Weight | Style                                                 |
| ----------------------- | ---------------- | ------ | ----------------------------------------------------- |
| Headings (H1–H2)        | Playfair Display | 600    | Editorial, serif, evokes authority and calm intellect |
| Subheadings / Hero Line | Inter            | 500    | Clean sans-serif, for balance and clarity             |
| Body Text               | Inter            | 400    | Default text across cards, footer, and CTA labels     |
| Buttons / Labels        | Inter            | 500    | All caps or small caps for clarity                    |

**Fallbacks:**
Playfair Display, Georgia, serif
Inter, Helvetica Neue, Arial, sans-serif

---

## 4. Layout Structure

### Hero Section

```
+---------------------------------------------------+
| LOGO (top-left)           NAV (top-right)         |
|                                                   |
|           [H1] Exploring Humanity, Systems,       |
|                and the Future of Technology        |
|           [Subline] Turtleand is a network of     |
|                ideas — from AI to blockchain.     |
|                                                   |
|        [ ↓  Scroll indicator / Enter the map ]    |
+---------------------------------------------------+
```

**Height:** 90–100vh (full screen)
**Background:** Animated gradient from `#0E1E2B` to `#2E8373` with soft moving wave overlay (SVG or canvas-based).
**Text alignment:** Centered (horizontal and vertical).
**Logo:** Small turtle icon or minimalist text mark “Turtleand”.

---

### Quadrant Section (Subdomain Cards)

```
+---------------------------------------------------+
| ┌────────────┬────────────┬────────────┬──────────┐
| │  AI        │ Growth     │ Build      │ Blockchain│
| │ Machine    │ Human      │ Code as    │ Decentralized│
| │ Reasoning  │ Potential  │ Creation   │ Trust      │
| │ [Enter →]  │ [Enter →]  │ [Enter →]  │ [Enter →]  │
| └────────────┴────────────┴────────────┴──────────┘
+---------------------------------------------------+
```

* **Grid:** 4 equal cards horizontally (responsive: 2×2 on tablet, 1×4 stacked on mobile).
* **Card size:** 320×320px (desktop baseline).
* **Padding:** 2rem.
* **Border radius:** 1rem (soft, modern feel).

**Hover state:**

* Subtle scale-up (1.02x)
* Gradient border glow (`#6FE1C3 → #F9A856`)
* Elevation shadow `0 8px 24px rgba(0,0,0,0.25)`
* Button “Enter” slides up slightly (`translateY(-4px)`)

---

## 5. Motion & Interaction Design

### Global Motion Principles

Smooth, slow, confident — never flashy.
Prioritize “calm animation” (ease-in-out cubic, Apple-inspired).

| Element              | Animation                           | Timing                 | Behavior                           |
| -------------------- | ----------------------------------- | ---------------------- | ---------------------------------- |
| Hero gradient        | Subtle wave or parallax motion      | Infinite (30–60s loop) | Background breathes gently         |
| Scroll indicator     | Fade up/down loop                   | 2s loop                | Encourages scroll without clutter  |
| Card hover           | Scale (1.02) + glow                 | 250ms                  | Ease-out cubic                     |
| Card entry (on load) | Fade-in + stagger (0.1s delay each) | 600ms total            | Sequential introduction of 4 cards |
| Button hover         | Border + text color change          | 150ms                  | Immediate feedback                 |

---

## 6. Tone & Experience

**Tone:** Reflective, trustworthy, global.
Balance between tech sophistication and human warmth.
Voice should feel like an intelligent guide, not a marketer.

**Intended emotional impact:**
Calm curiosity — the visitor feels they’ve arrived in a place that understands both the logic of technology and the depth of human thought.

**Keywords:**
Clarity · Depth · Balance · Global · Reflective · Human

---

## 7. Responsive Behavior

| Viewport          | Layout Adaptation                                         |
| ----------------- | --------------------------------------------------------- |
| Desktop (≥1200px) | 4-column grid; hero text centered.                        |
| Tablet (≥768px)   | 2×2 grid; hero text slightly smaller (max-width 75%).     |
| Mobile (<768px)   | Single column; each card full-width; hero stack centered. |

**Hero background:** Simplify wave animation for mobile (use static gradient).

---

## 8. Implementation Notes

* **Framework:** Astro or Next.js + TailwindCSS (for consistent spacing, typography, and transitions).
* **Animations:** Framer Motion or CSS keyframes (no heavy JS).
* **Hosting:** Netlify static deployment, pre-rendered HTML for SEO.
* **SEO:** Each subdomain card links via canonical tag.

**Accessibility:**

* Contrast ratio ≥ 4.5:1 for all text.
* Tab focus visible on all interactive elements.
* Buttons use semantic `<a>` or `<button>` elements.

---

## 9. Example Tagline Set (for hover tooltips or cards)

| Subdomain  | Tagline                                                       |
| ---------- | ------------------------------------------------------------- |
| AI         | “Understanding reasoning, intelligence, and machine thought.” |
| Growth     | “Exploring human potential and systems of improvement.”       |
| Build      | “Engineering software and logic for a connected world.”       |
| Blockchain | “Decentralizing trust, ownership, and identity.”              |

---

## 10. Summary

**Design Signature:**

* Editorial hero (philosophical intro)
* Calm gradient motion (depth)
* Quadrant navigation (clarity)
* Unified tone (human + tech harmony)

This page should feel like the calm surface of a deep ocean — elegant, global, and intelligent.

## 1. Tech Stack & High-Level Decisions

* **Framework:** Astro (static site, output: `turtleand.com`).
* **Styling:** Tailwind CSS (recommended) + a few custom CSS variables.
* **Fonts:** Loaded via `<link>` in `src/layouts/Layout.astro` `<head>`.
* **Interactivity / Motion:**

  * Primarily **CSS transitions + keyframes** (no JS needed).
  * Optional: a tiny React island only if you want more complex hero animation later.
* **Deployment:** Static build on Netlify.

---

## 2. Project Structure (Astro)

```txt
project-root/
  astro.config.mjs
  package.json
  tsconfig.json        (optional but recommended)

  src/
    layouts/
      Layout.astro
    pages/
      index.astro
    components/
      Hero.astro
      QuadrantGrid.astro
      DomainCard.astro
      Footer.astro
    styles/
      globals.css       (or main.css)
```

**Routing:**

* `src/pages/index.astro` → `/` (turtleand.com)
  This page uses `Layout.astro` and composes the hero + quadrant grid + footer.

---

## 3. Layout & Components (Astro)

### 3.1 `Layout.astro`

**Responsibility:**

* Global `<html>`, `<head>`, `<body>`.
* Font imports, SEO meta, base `<main>` wrapper.
* Inject page content via `<slot />`.

**Key points:**

* Add font links:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=Inter:wght@400;500&display=swap" rel="stylesheet">
```

* Add a `<body class="bg-deepBlue text-offWhite">` to apply global colors.

---

### 3.2 `Hero.astro`

**Responsibility:**

* Full-viewport hero section with Turtleand title + tagline.
* Soft gradient / wave background.
* Optional scroll indicator at bottom.

**Layout:**

* Use a `section` with `min-h-screen flex flex-col` and centered content:

  * Top-left: logo “Turtleand”.
  * Center:

    * H1: “Exploring Humanity, Systems and the Future of Technology”
    * Subline: “Turtleand is a network of ideas — from AI to blockchain.”
  * Bottom center: scroll indicator (`▼` or animated line).

**Animation:**

* Background gradient via CSS:

```css
.hero-gradient {
  background: radial-gradient(circle at top, #2E8373 0, #0E1E2B 55%, #0E1E2B 100%);
  animation: heroWave 30s ease-in-out infinite alternate;
}
@keyframes heroWave {
  0%   { background-position: 0% 0%; }
  100% { background-position: 100% 100%; }
}
```

* Scroll indicator: simple keyframe for fade up/down.

---

### 3.3 `QuadrantGrid.astro`

**Responsibility:**

* Section below hero with the 4 domain cards in a responsive grid.

**Layout:**

* Use Tailwind grid utilities:

```html
<section class="max-w-6xl mx-auto px-6 py-16">
  <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
    <!-- DomainCard instances -->
  </div>
</section>
```

* The grid adapts:

  * Mobile: 1 column
  * Tablet: 2 columns
  * Desktop: 4 columns

---

### 3.4 `DomainCard.astro`

**Props:**

```ts
interface Props {
  label: string;       // "AI"
  emoji: string;       // "🧠"
  tagline: string;     // "Machine Reasoning"
  href: string;        // "https://ai.turtleand.com"
  variant: "ai" | "growth" | "build" | "blockchain";
}
```

**Responsibilities:**

* Render a card with:

  * Emoji icon
  * Label
  * Tagline
  * “Enter” button (link to subdomain)

**Styling / Motion:**

* Base styles:

  * `bg-card-*` per variant
  * `rounded-xl p-6 flex flex-col justify-between`
  * `transition-transform transition-shadow duration-200 ease-out`

* Hover:

```html
<a
  class="group block rounded-xl p-6 bg-card-ai
         shadow-md hover:shadow-xl
         transform hover:-translate-y-1
         border border-transparent hover:border-accent
         transition-all duration-250 ease-out"
  href={href}
>
  <!-- content -->
</a>
```

* Inside, use `group-hover:text-accent` for subtle highlights.

---

### 3.5 `Footer.astro`

Simple footer:

* Text: “Built by Turtleand — Thought without borders.”
* Centered, small type, muted text color (`text-muted`).

---

## 4. Colors in Astro (Tailwind + CSS Variables)

Define your color palette in **Tailwind config** and/or CSS variables.

### 4.1 CSS Variables (`src/styles/globals.css`)

```css
:root {
  --color-deep-blue: #0E1E2B;
  --color-teal: #2E8373;
  --color-cyan: #7AD6C2;
  --color-amber: #F9A856;
  --color-off-white: #F4F4F4;
  --color-muted: #A8B3BA;

  --card-ai: #0C2238;
  --card-growth: #1B4B43;
  --card-build: #12313B;
  --card-blockchain: #3A2416;
}
```

### 4.2 Tailwind (`tailwind.config.cjs`)

```js
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,tsx,vue,svelte}'],
  theme: {
    extend: {
      colors: {
        deepBlue: 'var(--color-deep-blue)',
        teal: 'var(--color-teal)',
        cyan: 'var(--color-cyan)',
        amber: 'var(--color-amber)',
        offWhite: 'var(--color-off-white)',
        muted: 'var(--color-muted)',
        card: {
          ai: 'var(--card-ai)',
          growth: 'var(--card-growth)',
          build: 'var(--card-build)',
          blockchain: 'var(--card-blockchain)',
        },
        accent: 'var(--color-cyan)',
      },
      fontFamily: {
        heading: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '1rem',
      },
    },
  },
  plugins: [],
};
```

Then in components:

```html
<h1 class="font-heading text-4xl md:text-5xl">
  Exploring Humanity, Systems and the Future of Technology
</h1>
<p class="font-body text-muted mt-4">
  Turtleand is a network of ideas — from AI to blockchain.
</p>
```

---

## 5. Motion in Astro

No framework-specific magic needed; just CSS:

### 5.1 Hero Background

* Add class `hero-gradient` to hero wrapper.
* Use `@keyframes heroWave` as above.

### 5.2 Card Hover & Entry

* Hover via Tailwind `transition-transform`, `shadow-lg`, `hover:-translate-y-1`.
* Entry animation on page load:

  * Add a utility class like `animate-fade-up` defined in CSS:

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

.animate-fade-up {
  animation: fadeUp 0.6s ease-out forwards;
}
```

* Stagger via inline style or small custom classes (`delay-100`, `delay-200` using Tailwind’s `animation-delay` plugin if you want).

---

## 6. Tone & Copy (for Astro Components)

Keep the textual tone consistent:

* **Hero H1:** philosophical but clear.
* **Subline:** one sentence explaining Turtleand as a network.
* **Cards:** short, 2–3 word taglines.

Example props for `QuadrantGrid.astro`:

```astro
<DomainCard
  label="AI"
  emoji="🧠"
  tagline="Machine Reasoning"
  href="https://ai.turtleand.com"
  variant="ai"
/>
<DomainCard
  label="Growth"
  emoji="🌱"
  tagline="Human Potential"
  href="https://growth.turtleand.com"
  variant="growth"
/>
<DomainCard
  label="Build"
  emoji="⚙️"
  tagline="Code as Creation"
  href="https://build.turtleand.com"
  variant="build"
/>
<DomainCard
  label="Blockchain"
  emoji="🔗"
  tagline="Trust and Consensus"
  href="https://blockchain.turtleand.com"
  variant="blockchain"
/>
```

---

## 7. Summary for Codex / Implementation

When you feed this into Codex / your AI coding assistant, the key implementation goals are:

1. **Astro app with Tailwind**.
2. `Layout.astro` + `Hero.astro` + `QuadrantGrid.astro` + `DomainCard.astro` + `Footer.astro`.
3. Colors via CSS variables + Tailwind config.
4. Typography via Playfair Display (headings) + Inter (body).
5. Motion via CSS keyframes (hero gradient, scroll indicator, card fade/hover).
6. Static deployment to Netlify.

If you want, next step I can generate the **actual starter code files** (`index.astro`, `Layout.astro`, `Hero.astro`, etc.) matching this spec so you can drop them into a new Astro project and tweak.

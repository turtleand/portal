## Task: Add "About" navigation entry + About component

### Context

The project has a hero section with four main pillars (AI, Growth, Build, Blockchain).  
At the top of the main layout file there is a placeholder:

```text
TODO: add logo
TODO: add relevant navigation
```

We want:

1. A minimal header with an "About" link.
2. An About component/section that displays a short "who I am" snapshot when the user clicks "About".

---

### Goal

* Add a header navigation bar with an `About` entry.
* When `About` is clicked, show an About view/section that contains a list of traits describing the author.

---

### Requirements

#### 1. Header Layout

* Header appears at the very top of the page, above the hero section.
* Left: brand text. Use logo within public/logo.svg
* Right: horizontal navigation list with an `About` link.
* Style: minimal, editorial, tech-oriented; no heavy borders or noisy elements.

#### 2. Navigation Items

* Initial navigation configuration:

  * `[{ label: 'About', href: '/about' }]` (or equivalent config structure).
* The navigation should be defined via a small config array or object so items can be added later without changing layout code.

#### 3. About Route / Component Behavior

* Clicking `About` should navigate to (or otherwise render) an About view/section.
* The About view must display the following list of traits as the core content:

  * Strategic Thinker
  * Software Engineer with +10 years of experience
  * Global Citizen
  * Blockchain Enthusiast
  * AI learner
  * Optimist
  * Believer in Humanity
  * Passionate Reader and Writer
  * A Lion that Roars in the face of adversity
  * A Turtle that always moves forward

* Presentation guidelines:

  * Show them as a vertical list (bullets or clean stacked lines).
  * Use the same typography system as the main site (e.g., one clear heading like "About" and then the list).
  * Keep the layout simple and readable (good line spacing, no clutter).

#### 4. Styling

* Use the existing color palette and font scale from the hero section.
* Text:

  * High enough contrast for readability.
  * Subtle hover style for the `About` link in the header (e.g., underline or slight color shift).
* About section:

  * Centered or left-aligned content with generous padding.
  * No need for images; text-first, reflective, and calm.

#### 5. Responsiveness

* Desktop:

  * Header navigation right-aligned in a single row.
  * About text comfortably readable (reasonable max-width).
* Mobile:

  * Header can wrap so that the brand appears on the first line and nav items below, or use a simple menu button if needed.
  * About text should remain readable on small screens (larger line height, no tiny fonts).

#### 6. Implementation Notes

* Create a reusable `Header`/`SiteHeader` component that:

  * Receives navigation items from a config array.
  * Renders the brand on the left and nav items on the right.
* Create an `About` page/component that renders the list of traits above.
* Wire the router (or conditional rendering logic) so that clicking `About` displays the About component.
* Replace the `TODO: add relevant navigation` comment with the header component integration.

---

### Definition of Done

* Header is visible at the top of the portal with:

  * Brand/title on the left.
  * `About` link on the right.
* Clicking `About` shows an About view containing exactly the traits listed above.
* Styles match the existing look and feel (minimal, editorial, tech-human tone).
* Layout works on both desktop and mobile.
* Navigation items are defined in a configurable structure (array/object) to allow future menu items.

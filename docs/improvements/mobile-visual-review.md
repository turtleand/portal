# Mobile Visual Design Review

## Mobile Header
- **Location:** src/components/SiteHeader.astro
- **Issue:** The brand lockup keeps the 64px-tall logo and a 2xl pill label with heavy letter spacing even on 320px-wide screens, so the wordmark wraps under the logo and the sticky header eats a large chunk of the viewport before any content appears.
- **Suggested visual improvement:** Provide a scaled-down mobile treatment (smaller logo height, lighter tracking, tighter padding) so the lockup stays on one line and frees vertical space for the rest of the header.

- **Location:** src/components/SiteHeader.astro
- **Issue:** Locale toggles rely on `text-sm` uppercase letters, `tracking-[0.12em]`, and 50% opacity text inside a translucent pill; on phones this combination renders very light, so the inactive language looks disabled rather than selectable.
- **Suggested visual improvement:** Increase the base font size/weight and reduce tracking while boosting the default contrast (stronger text color, slightly darker chip) so both locales stay legible on small screens.

- **Location:** src/components/SiteHeader.astro
- **Issue:** Link emphasis depends on a 1px underline that only animates on hover/focus; touch users never see that accent, so all nav items look identical until the page changes.
- **Suggested visual improvement:** Keep a thicker underline or alternative accent (color shift, badge) visible even without hover so the current page and tappable text stand out on mobile.

## Mobile Hero
- **Location:** src/components/Hero.astro
- **Issue:** The hero keeps `py-20` (80px) padding above and below the copy at every breakpoint, which means the key message sits well below the top of a phone screen and the fold is mostly gradient background.
- **Suggested visual improvement:** Introduce a tighter mobile spacing scale (e.g., halve the vertical padding under 640px) so the headline and paragraph appear immediately when the hero loads.

- **Location:** src/components/Hero.astro
- **Issue:** The highlighted phrase uses a gradient that is mostly the same off-white as the rest of the heading, so on narrow screens the accent color barely shows and the emphasis gets lost amid three stacked lines of serif text.
- **Suggested visual improvement:** Push more accent color into that gradient (or add a subtle background highlight) so the emphasized word actually pops when the heading wraps on mobile.

## Mobile Domain Cards
- **Location:** src/components/DomainCard.astro
- **Issue:** Cards rely on hover/focus to reveal the glowing border and lifted surface, but touch users never trigger those states, so the cards read as static content instead of tap targets.
- **Suggested visual improvement:** Keep a subdued version of the border glow or add a persistent accent marker on mobile so each card still looks interactive without hover.

## Mobile Avatar Gallery Modal
- **Location:** src/components/avatar/AvatarGalleryModal.astro & src/components/avatar/AvatarGallery.astro
- **Issue:** The modal panel keeps 2.5rem corner radii and 2rem padding while the gallery stage enforces a 360px height, so on smaller phones the image, metadata, and controls extend past 90vh and require immediate scrolling inside the dialog.
- **Suggested visual improvement:** Move to a condensed mobile layout (smaller padding/radius plus a shorter stage height) so the hero image and actions fit within a single viewport.

- **Location:** src/components/avatar/AvatarGallery.astro
- **Issue:** Metadata (`text-sm` uppercase with `tracking-[0.18em]`) rendered in muted emerald tones becomes hard to read when the modal scales down because the letters are both tiny and widely spaced.
- **Suggested visual improvement:** Increase the mobile font size/contrast for the version/date line so users can parse it without squinting.

- **Location:** src/components/avatar/AvatarGallery.astro
- **Issue:** Prev/Next buttons share that tightly tracked uppercase style and stretch edge to edge, so their labels feel thin and low-contrast against the glowing background on touch screens.
- **Suggested visual improvement:** Use a heavier weight, reduced tracking, or a clearer solid fill on mobile so the control labels are as legible as the icons.

## Mobile About Page
- **Location:** src/pages/about.astro
- **Issue:** Each trait card uses a `bg-white/5` fill on top of the same deep-blue background, so the cards barely separate from the page on mobile and the list reads like one block of copy.
- **Suggested visual improvement:** Increase the opacity of the card surface (or add a consistent glow) in the small-screen breakpoint so every trait reads as a distinct tile.

- **Location:** src/pages/about.astro
- **Issue:** When inline mode shows the descriptions on small screens, they stay at `text-sm text-offWhite/80` with a faint `border-white/5`, resulting in dense, low-contrast paragraphs that are tough to read in-hand.
- **Suggested visual improvement:** Bump the description font size/contrast and use a clearer divider so expanded traits feel intentional rather than hidden.

- **Location:** src/pages/about.astro
- **Issue:** Traits stack with only 12px (`space-y-3`) separation, so when multiple descriptions are open the cards touch and the hierarchy collapses.
- **Suggested visual improvement:** Add more vertical spacing between items (or extra padding on expanded cards) on narrow viewports to keep each trait visually distinct.

- **Issue:** The copyright line is `text-xs` uppercase with `tracking-[0.15em]` and `text-offWhite/55`, which makes the lettering thin and hazy on high-density mobile screens.
- **Suggested visual improvement:** Increase the size/contrast and relax the tracking so the footer text remains legible without zooming in.

- **Location:** src/components/Footer.astro
- **Issue:** The footer background color (`#0b1823`) is almost identical to the body background, so there is little visual break between the main content and footer on mobile once you scroll past the cards.
- **Suggested visual improvement:** Introduce a darker (or lighter) panel tone or a gradient edge so the footer reads as a separate block at the bottom of the page.

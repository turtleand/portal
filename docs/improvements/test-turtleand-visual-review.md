# Visual Design Review – test.turtleand.com

## Header

- **Location:** Wordmark pill inside the sticky header  
  **Issue:** The wordmark uses `text-xl font-heading uppercase tracking-[0.3em] text-offWhite/90`, so the letters are stretched far apart and appear faint inside the translucent header, making “Turtleand” hard to read at a glance.  
  **Suggested visual improvement:** Reduce the tracking and/or raise the weight so the letters sit closer together, giving the brand mark a denser, more legible silhouette.

- **Location:** EN/ES language toggle chip in the header  
  **Issue:** Both language labels are tiny (`text-xs` with `tracking-[0.2em]`) and the inactive state only drops to `text-offWhite/70`, so the two states look nearly identical inside the thin border. The control does not communicate which locale is active.  
  **Suggested visual improvement:** Increase the font size, loosen the letter-spacing, and use the accent teal for the active fill while muting the inactive text further so the selected locale stands out.

- **Location:** Header background treatment (`bg-deepBlue/90` with `border-white/5`)  
  **Issue:** Because the hero uses the same deep-blue gradient, the transparent header blends into the hero and the 5% white bottom border is almost invisible, flattening the page hierarchy.  
  **Suggested visual improvement:** Give the header a fully opaque fill or a stronger bottom shadow/glow so it is visually separated from the hero at all scroll positions.

## Hero

- **Location:** Hero headline (`text-4xl md:text-6xl leading-tight`)  
  **Issue:** The tight leading (~1.1) makes the two lines of the headline sit almost on top of each other when the sentence wraps, which hurts readability for such a large serif title.  
  **Suggested visual improvement:** Loosen the line height (e.g., `leading-snug` or explicit spacing) so multi-line titles have breathing room.

- **Location:** Hero copy block within `.hero-gradient`  
  **Issue:** Both the headline and description rely on off-white/muted gray text without any accent highlights, so there is no focal point in the hero and the message reads as one monochrome block.  
  **Suggested visual improvement:** Introduce a controlled accent—highlight a key phrase, gradient-outline part of the headline, or color the supporting sentence—to create a clear visual emphasis.

- **Location:** Hero background (`.hero-gradient animate-heroWave`)  
  **Issue:** The gradient transitions from semi-transparent teal (#2e837399) straight into the same deep blue used for the body (`bg-deepBlue`), so the hero bleeds into the quadrants section with no tonal break.  
  **Suggested visual improvement:** Expand the gradient range or add a subtle divider/overlay so the hero resolves into a noticeably different tone before the next section begins.

## Footer

- **Location:** Social/Email icon buttons  
  **Issue:** The buttons only have a 1px `border-white/15` outline and `text-offWhite/80` icons on a #0b1823 background, so the controls look washed out and inactive instead of interactive.  
  **Suggested visual improvement:** Increase the border opacity/width or fill the icons with the accent teal so the call-to-action row reads as actionable content.

- **Location:** Email contact icon  
  **Issue:** The email icon is visually identical to the GitHub icon (same monochrome treatment, no label), so the primary contact option gets lost even though it should be emphasized.  
  **Suggested visual improvement:** Give the email action a distinct tint or a subtle text label so it stands out as the preferred contact route.

- **Location:** Footer copy stack (`text-offWhite/80` for both actions and legal)  
  **Issue:** Legal text and interactive elements use the same type size and color, so the footer reads as a single gray block without hierarchy.  
  **Suggested visual improvement:** Use contrasting weights/tones—e.g., keep actions brighter or larger and mute the legal line—so users can immediately distinguish between interactive items and metadata.

## Avatar Gallery Modal

- **Location:** “Avatar Evolution” badge and metadata lines (`text-xs` uppercase with 0.35–0.4em tracking)  
  **Issue:** The extreme letter spacing on such a small font size spreads the letters until they look like dots, hurting readability on the dark modal surface.  
  **Suggested visual improvement:** Increase the font size or reduce the tracking so the badge and meta text remain legible.

- **Location:** Modal panel background (`bg-deepBlue/95` on top of a `bg-black/70` overlay)  
  **Issue:** The panel uses the same deep blue as the page body, so even with the overlay it does not feel elevated—its edges dissolve into the backdrop instead of floating above it.  
  **Suggested visual improvement:** Lighten the modal surface, add a brighter gradient rim, or introduce a colored glow so the panel has clear separation from the dimmed page.

- **Location:** Prev/Next controls (`bg-emerald-400/10`, `border-white/20`)  
  **Issue:** The navigation buttons are rendered as translucent ghost chips with very low-contrast borders, which makes the primary controls look disabled despite being essential for the gallery.  
  **Suggested visual improvement:** Increase fill opacity or apply the accent color more boldly (either via solid fill or thicker outline) so the controls read as tappable actions.

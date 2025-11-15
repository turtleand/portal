## Locale Toggle Flicker – Investigation Log

### Problem
Switching to the About page with `?lang=es` causes the header toggle to momentarily show `EN` before the client locale script rehydrates. This regression persists even after multiple fixes aimed at the About overlay redirect.

### Why It Happens
- The site is statically generated, so every HTML page ships with `lang="en"` and the English toggle set active (`src/layouts/Layout.astro`, `src/components/SiteHeader.astro`).
- `initI18n(Astro)` resolves locales only at runtime. During `astro build`, there is no incoming request state, so all pre-rendered routes fall back to `DEFAULT_LOCALE = 'en'`.
- The client bootstrap (`src/scripts/locale-client.js`) runs after the first paint. Until it executes, styles/classes still reflect EN, which causes a visible flash when navigating directly to `/about?lang=es` or when clicking the “Acerca de” link from home (full page transition).

### Attempts So Far
1. **Locale-aware About overlay redirect** (`src/pages/about.astro`):
   - Replaced the bare `/` redirect with helper logic that preserves `lang`, and later reused the localized anchor click.
   - Outcome: prevented the overlay from stripping `?lang=es`, but did not address the fresh page load HTML still shipping in English.

2. **Header pre-bootstrap script** (`src/components/SiteHeader.astro`, inline `<script>`):
   - Injected a script to immediately read the stored locale (URL param or `lang` cookie) and update button states before the locale client hydrates.
   - Outcome: script still executes after the browser has already painted the header because it’s placed after the markup and depends on `window`. On fast navigations the flicker remains, meaning we need SSR-level locale selection or a `<script>` placed in the `<head>` before first paint.

### Recommended Direction
- **Server-side locale rendering**: Convert the project to SSR or enable per-locale SSG by generating `/index` and `/index.es` (or `/es/index`) and routing via middleware. Astro’s `getStaticPaths` or `Astro.locals` could provide the locale during build if we emit distinct pages per locale.
- **Inline `<head>` bootstrap**: If SSR is not an option, move the locale-detection script into the `<head>` (e.g., from `Layout.astro`) and use a tiny `defer`-less inline script before stylesheets to set `document.documentElement.lang` and add a `data-locale-ready` attribute/class that CSS can target to suppress the EN styles until the locale is known.
- **Reduce layout dependency on active classes**: Instead of toggling actual Tailwind classes, consider using CSS variables or `[dir]`/`[lang]` selectors so the header appearance derives from `html[lang="es"]`, making the flash less noticeable even if the toggle updates later.

### Verification Guidance
1. Run `npm run dev`.
2. In a fresh browser session, visit `/about?lang=es`.
3. Observe the header toggle during the first paint; it should not flash to EN if the fix is effective.
4. Navigate back and forth between `/` and `/about` using the header nav and About overlay to ensure no locale jitter occurs.

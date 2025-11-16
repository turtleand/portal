## Locale SSR Iteration – Concept Note

### Goal (Plain Words)
- Render each page in the visitor’s language right on the server so the header never flashes the wrong locale.
- Keep the URL param (`?lang=es`) and cookies working exactly like today, but resolve them per request rather than only after the browser loads.

### How It Works Technically
1. **Enable Astro SSR**: Install an adapter such as `@astrojs/netlify` (or Node/Vercel) in `astro.config.mjs` so builds emit a server entry instead of static HTML files.
2. **Per-request locale resolution**: The existing `initI18n(Astro)` already calls `resolveLocale({ url, cookies })`. Under SSR this executes for every HTTP request, so `/about?lang=es` produces HTML with `locale === 'es'`.
3. **Server output**: Because layout/header receive the correct locale at render time, `<html lang="es">`, translations, and toggle states ship to the browser already in Spanish, eliminating the flicker.
4. **Client bootstrapping**: Keep `locale-client.js` to hydrate existing interactive pieces, but it now simply reuses the locale injected by SSR (no more first-paint mismatch).

### Rollout Considerations
- Choose the adapter that matches deployment (e.g., Netlify Functions vs Edge) and update CI/deploy scripts.
- Verify cookies and caching headers so each user gets their own locale-specific response.
- Re-test navigation flows (`/`, `/about`, overlay) under cold loads to confirm no EN flash remains.

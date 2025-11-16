## Netlify SSR Deployment Notes

### Plain-language checklist
- Install Astro’s Netlify adapter so the site can run dynamic code instead of only pushing static HTML.
- Tell Astro to render pages on-the-fly (`output: 'server'`) and let the adapter emit Netlify Functions for routing.
- Point Netlify’s build settings to `npm run build`, keep `npm run dev` for local testing, and ensure `NODE_VERSION` matches what you use locally.

### Technical steps
1. **Add the adapter dependency**
   ```bash
   npm install @astrojs/netlify
   ```
   This package adds both Function (lambda) and Edge handlers; stick with the Functions flavor unless you need Edge APIs.

2. **Update `astro.config.mjs`**
   ```js
   import { defineConfig } from 'astro/config';
   import tailwind from '@astrojs/tailwind';
   import netlify from '@astrojs/netlify/functions';

   export default defineConfig({
     output: 'server',
     adapter: netlify({
       // optional: specify `binaryMediaTypes`, `deployPreviews`, etc.
     }),
     integrations: [tailwind()],
     site: 'https://turtleand.com',
   });
   ```
   The key pieces are `output: 'server'` (enables SSR) and the Netlify adapter (wires Astro’s server entry to Netlify Functions).

3. **Netlify build settings (`netlify.toml` or UI)**
   ```toml
   [build]
   command = "npm run build"
   publish = "dist"
   functions = "netlify/functions"
   ```
   - Netlify will upload `dist/client` as static assets and `dist/server/entry.mjs` as the Function bundle. The adapter creates the `netlify/functions/entry.mjs` bridge automatically.
   - If you use deploy previews, ensure `NODE_VERSION` is set (e.g., 20.x) so `npm` resolves the same packages as your local machine.

4. **Testing locally**
   - Keep using `npm run dev` for development; the adapter only affects `npm run build` and `npm run preview`.
   - To mimic Netlify Functions locally, run `netlify dev` after `npm install -g netlify-cli` (optional but helpful before shipping).

### Rollout reminders
- SSR means every request hits a Function. Review caching headers (`Cache-Control`) if you want CDN layer caching per locale.
- Monitor cold starts: Netlify Functions boot quickly, but keep dependencies slim.
- Environment variables (if any) should be defined in Netlify’s dashboard since they are no longer baked into static HTML.

### Testing flows & required changes
1. **Fast local iteration (`npm run dev`)**
   - Prereqs: none beyond `astro.config.mjs` already pointing to `@astrojs/netlify`.
   - Command: `npm run dev` (optionally `-- --port 4321`).
   - What it proves: Locale flicker is gone, UI behaves as expected, and the SSR logic works inside Astro’s dev server.
2. **Netlify emulation (`netlify dev`)**
   - Prereqs: install Netlify CLI (`npm install -g netlify-cli`), set up `[dev]` in `netlify.toml` with different `port`/`targetPort`.
   - Command: `netlify dev`.
   - What it proves: Netlify’s runtime can execute the adapter output—URLs such as `/about?lang=es` render correctly, redirects and env vars match production, and no 404s appear.
3. **Production sanity check**
   - Prereqs: `astro.config.mjs` using the Netlify adapter, `netlify.toml` committed.
   - Commands: `npm run build` (local), then either:
     - `netlify deploy --build --preview` for a preview URL, or
     - Push to a Deploy Preview/production via Netlify UI.
   - What it proves: The generated SSR Function and assets in `dist` match expectations and run in Netlify’s cloud.

### Practical ways to inspect `dist/`
1. **Manual file inspection**
   - After `npm run build`, open `dist/client` (static assets) and `dist/server`/`netlify/functions` to confirm the files exist and contain the expected locale-aware markup.
2. **Serve locally**
   - Run `npx serve dist` to inspect the static assets that Netlify’s CDN will host. Since the Netlify adapter writes files directly under `dist/`, serving that folder lets you spot-check `/logo.svg`, `/favicon.svg`, or anything inside `_astro/`.
   - Use `netlify dev` separately when you need the SSR Function; the static server does not execute the Function bundle.
3. **Deploy preview snapshot**
   - Run `netlify deploy --build --preview`. Netlify uploads `dist/` and gives you a URL; inspect the site there to validate the bundle without touching production.

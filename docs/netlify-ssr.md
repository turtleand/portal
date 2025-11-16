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

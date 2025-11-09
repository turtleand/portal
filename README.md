# Portal
Entrypoint for Turtleand's universe

## Local development

```bash
npm install
npm run dev
```

## Deploying to Netlify

Astro builds a static site into the `dist/` directory. If Netlify serves any other folder (for example the default `public/`), you'll only see the generic “Page not found” screen that Netlify shows when it cannot find your compiled site. Fix the deploy by pointing Netlify at the folder produced by `npm run build`.

| Netlify field      | Value to use                          |
| ------------------ | ------------------------------------- |
| Base directory     | Leave blank (or `.` if required)      |
| Build command      | `npm run build`                       |
| Publish directory  | `dist`                                |
| Functions dir      | Leave blank (no Netlify Functions)    |

Steps:
1. Push your changes to the repository’s default branch.
2. In Netlify → **Site settings → Build & deploy → Continuous deployment**, set the fields above.
3. Trigger a new deploy. Netlify will run `npm run build`, place the generated files in `dist/`, and serve them as your site.

If you prefer configuration-as-code, create a `netlify.toml` at the repo root with:

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

Either approach ensures Netlify serves the correct directory and prevents the 404 shown after the previous builds.

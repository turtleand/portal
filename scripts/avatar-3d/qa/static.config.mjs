import { defineConfig } from 'astro/config';
import path from 'node:path';

// Identical production client build for baseline and candidate. Netlify's
// adapter does not provide astro preview. This does not emulate Netlify SSR.
const root=process.env.PORTAL_QA_PROJECT_ROOT;
const out=process.env.PORTAL_QA_BUILD_DIR;
if(!root||!out)throw new Error('Set PORTAL_QA_PROJECT_ROOT and PORTAL_QA_BUILD_DIR explicitly.');
export default defineConfig({
  root:path.resolve(root),
  outDir:path.resolve(out),
  output:'static',site:'https://turtleand.com',
});

/// <reference path="../.astro/types.d.ts" />

declare module '*.js?url' {
  const src: string;
  export default src;
}

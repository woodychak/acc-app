// declarations.d.ts
declare module "*.worker.js?url" {
  const src: string;
  export default src;
}

declare module "*.mjs?url" {
  const src: string;
  export default src;
}
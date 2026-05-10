// types/globals.d.ts
// Ambient declarations for globals injected by Vite and legacy globals
// Phase 4: review which of these are still needed after modular split

declare const __APP_VERSION__: string;

// Legacy global from data/pillars.js (window.BASE_LAYERS)
// Phase 4: replace with ES module import from data/pillars.js
declare interface Window {
  BASE_LAYERS: unknown;
  // Phase 4: remove once firebase-init.js is replaced by firebase/ adapter
  FB: unknown;
  Chart: unknown;
}

// Phase 7 Wave 3: Vite-injected ImportMeta.env (FN-07 reCAPTCHA Enterprise).
// Minimal shape — narrower than "vite/client" which would also pull HMR types.
interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly VITE_RECAPTCHA_ENTERPRISE_SITE_KEY?: string;
  readonly [key: string]: string | boolean | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

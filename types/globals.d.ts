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

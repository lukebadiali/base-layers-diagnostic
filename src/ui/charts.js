// src/ui/charts.js
// @ts-check
// Phase 4 (D-08): Chart.js npm wrapper. Replaces the cdn.jsdelivr.net CDN script
// tag. Brand colors live in styles.css :root custom properties (--chart-color-*),
// decoupling Chart.js options from CODE-06's inline-style sweep (Wave 4).
import {
  Chart,
  RadarController,
  DoughnutController,
  RadialLinearScale,
  ArcElement,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend,
  Title,
} from "chart.js";

Chart.register(
  RadarController,
  DoughnutController,
  RadialLinearScale,
  ArcElement,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend,
  Title,
);

/**
 * Chart factory — accepts a canvas context + Chart.js config; returns a Chart
 * instance. Brand colors injected from CSS custom properties so styles.css owns
 * the palette.
 * @param {HTMLCanvasElement | CanvasRenderingContext2D} ctx
 * @param {*} config
 * @returns {*}
 */
export function createChart(ctx, config) {
  return new Chart(ctx, config);
}

// Bridge for app.js IIFE — Phase 4 only; Wave 4 retrofits views to call
// createChart() directly. Wave 5 (D-03) removes app.js entirely.
if (typeof window !== "undefined") {
  /** @type {*} */ (window).Chart = Chart;
}

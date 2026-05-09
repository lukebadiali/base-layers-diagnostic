// tests/mocks/chartjs.js
// @ts-check
// Phase 2 (D-14): Chart.js stub for snapshot stability — captures config on __lastConfig.
import { vi } from "vitest";

class ChartStub {
  /**
   * @param {any} ctx
   * @param {any} config
   */
  constructor(ctx, config) {
    this.__ctx = ctx;
    this.__lastConfig = config;
    this.canvas = ctx?.canvas || ctx;
    this.data = config?.data;
    this.options = config?.options;
  }
  destroy() {}
  update() {}
  resize() {}
  render() {}
}
ChartStub.register = vi.fn();

export const GlobalChartStub = ChartStub;

export function makeChartStub() {
  // Phase 4 Wave 5 (D-03 retarget): src/ui/charts.js named-imports an
  // expanded set of Chart.js controllers / scales / elements / plugins
  // (RadialLinearScale, ArcElement, LineElement, PointElement, Filler,
  // Tooltip, Legend, Title) — added Wave 1 npm migration. The test mock
  // must export ALL of them so the synchronous side-effect import from
  // src/main.js doesn't fail at module evaluation. Each non-Chart export
  // is a vi.fn() shim — Chart.register receives them but they aren't
  // exercised under happy-dom (Chart instances are ChartStub instances).
  return {
    default: ChartStub,
    Chart: ChartStub,
    RadarController: vi.fn(),
    DoughnutController: vi.fn(),
    RadialLinearScale: vi.fn(),
    ArcElement: vi.fn(),
    LineElement: vi.fn(),
    PointElement: vi.fn(),
    Filler: vi.fn(),
    Tooltip: vi.fn(),
    Legend: vi.fn(),
    Title: vi.fn(),
    registerables: [],
  };
}

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
  return {
    default: ChartStub,
    Chart: ChartStub,
    RadarController: vi.fn(),
    DoughnutController: vi.fn(),
    registerables: [],
  };
}

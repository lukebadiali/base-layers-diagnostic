// Phase 9 Wave 1 (OBS-01 / Pitfall 18 / Pitfall 7 drift guard): parity test
// between the browser PII_KEYS array (src/observability/pii-scrubber.js) and
// the node twin (functions/src/util/pii-scrubber.ts). Reads the JS source via
// fs and string-extracts the array literal; asserts string-equality against
// the imported TS const tuple. The test IS the contract.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PII_KEYS as NODE_KEYS } from "../../src/util/pii-scrubber.js";

describe("PII_KEYS parity", () => {
  it("PII_KEYS dictionary matches between browser + node", () => {
    const browserSrc = readFileSync(
      fileURLToPath(new URL("../../../src/observability/pii-scrubber.js", import.meta.url)),
      "utf-8",
    );
    const match = browserSrc.match(/PII_KEYS\s*=\s*Object\.freeze\(\[([^\]]+)\]/);
    const browserKeys = (match?.[1] ?? "").match(/"[^"]+"/g)?.map((s) => s.slice(1, -1)) ?? [];
    expect(browserKeys.sort()).toEqual([...NODE_KEYS].sort());
  });
});

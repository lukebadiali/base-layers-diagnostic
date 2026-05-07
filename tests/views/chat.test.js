// tests/views/chat.test.js
// @ts-check
// Phase 4 Wave 4 (D-12 / D-20): smoke + DI-shape contract test +
// CODE-08 (renderConversation seam) + CODE-10 (setTitleIfDifferent memo).
import { describe, it, expect, beforeEach } from "vitest";
import {
  renderChat,
  createChatView,
  setTitleIfDifferent,
  __resetTitleMemo,
} from "../../src/views/chat.js";

describe("src/views/chat.js — Wave 4 Pattern D extraction", () => {
  beforeEach(() => {
    __resetTitleMemo();
  });

  it("exports renderChat as a function", () => {
    expect(typeof renderChat).toBe("function");
  });

  it("createChatView returns DI-bound view", () => {
    const view = createChatView({ state: {}, h: () => document.createElement("div") });
    expect(typeof view.renderChat).toBe("function");
  });

  it("setTitleIfDifferent only writes document.title on diff (CODE-10)", () => {
    let titleWriteCount = 0;
    const original = document.title;
    Object.defineProperty(document, "title", {
      configurable: true,
      get: () => original,
      set: () => {
        titleWriteCount++;
      },
    });
    setTitleIfDifferent("(2) BeDeveloped");
    setTitleIfDifferent("(2) BeDeveloped");
    setTitleIfDifferent("(2) BeDeveloped");
    expect(titleWriteCount).toBe(1);
    setTitleIfDifferent("(3) BeDeveloped");
    expect(titleWriteCount).toBe(2);
    // restore
    Object.defineProperty(document, "title", {
      configurable: true,
      writable: true,
      value: original,
    });
  });
});

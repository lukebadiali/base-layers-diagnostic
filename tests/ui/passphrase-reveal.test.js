// tests/ui/passphrase-reveal.test.js
// @ts-check
// Unit tests for the shared masked-value + eye reveal used by the
// Set-passphrase modal row and the Manage-people org rows. Pattern D DI:
// the secret fetcher and the reveal-audit hook are injected, so the tests
// drive every fetch outcome without Firestore.
import { describe, it, expect, vi } from "vitest";
import { createPassphraseReveal } from "../../src/ui/passphrase-reveal.js";

/** @param {HTMLElement} el */
const text = (el) => el.textContent;

describe("createPassphraseReveal", () => {
  it("starts masked with an unpressed eye button", () => {
    const { value, btn } = createPassphraseReveal({ fetchSecret: async () => "s3cret" });
    expect(text(value)).toBe("••••••••");
    expect(btn.getAttribute("type")).toBe("button");
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });

  it("reveals the fetched passphrase on click and re-masks on a second click without re-fetching", async () => {
    const fetchSecret = vi.fn(async () => "s3cret");
    const onReveal = vi.fn();
    const { value, btn } = createPassphraseReveal({ fetchSecret, onReveal });

    btn.click();
    await vi.waitFor(() => expect(text(value)).toBe("s3cret"));
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(btn.classList.contains("is-revealed")).toBe(true);
    expect(onReveal).toHaveBeenCalledTimes(1);

    btn.click();
    expect(text(value)).toBe("••••••••");
    expect(btn.getAttribute("aria-pressed")).toBe("false");

    btn.click();
    await vi.waitFor(() => expect(text(value)).toBe("s3cret"));
    expect(fetchSecret).toHaveBeenCalledTimes(1);
  });

  it("shows the not-saved note when the secret is genuinely absent (null)", async () => {
    const { value, btn } = createPassphraseReveal({ fetchSecret: async () => null });
    btn.click();
    await vi.waitFor(() =>
      expect(text(value)).toBe("Not saved for viewing — set/rotate the passphrase to enable."),
    );
  });

  it("shows a distinct retry message on fetch failure, does not cache it, and skips onReveal", async () => {
    let fail = true;
    const fetchSecret = vi.fn(async () => {
      if (fail) throw new Error("permission-denied");
      return "s3cret";
    });
    const onReveal = vi.fn();
    const { value, btn } = createPassphraseReveal({ fetchSecret, onReveal });

    btn.click();
    await vi.waitFor(() =>
      expect(text(value)).toBe("Couldn't load the passphrase — hide and retry."),
    );
    expect(onReveal).not.toHaveBeenCalled();

    // hide, then retry — the failure must not have been cached
    btn.click();
    fail = false;
    btn.click();
    await vi.waitFor(() => expect(text(value)).toBe("s3cret"));
    expect(fetchSecret).toHaveBeenCalledTimes(2);
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("a throwing onReveal hook never blocks the reveal", async () => {
    const { value, btn } = createPassphraseReveal({
      fetchSecret: async () => "s3cret",
      onReveal: () => {
        throw new Error("audit down");
      },
    });
    btn.click();
    await vi.waitFor(() => expect(text(value)).toBe("s3cret"));
  });
});

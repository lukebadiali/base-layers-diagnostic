// src/ui/passphrase-reveal.js
// @ts-check
// Shared masked-value + eye reveal for the org company passphrase, used by
// the Set-passphrase modal row and the Manage-people org rows. Pattern D DI —
// pure DOM: the orgSecrets fetcher and the reveal-audit hook are injected, so
// this module never touches firebase/*.
//
// Behavior contract (single owner — call sites must not hand-roll it):
// - Lazily fetches ONLY on the first reveal click, then caches; toggling off
//   re-masks without re-fetching.
// - A FAILED fetch shows a distinct retry message and is never cached, so a
//   transient failure (offline, permission hiccup) can't masquerade as the
//   by-design "not saved" state and the next reveal retries.
// - onReveal fires once per successful reveal (plaintext or not-saved note),
//   never on load failure; a throwing hook is swallowed (best-effort audit).

const MASK = "••••••••";
const NOT_SAVED = "Not saved for viewing — set/rotate the passphrase to enable.";
const LOAD_FAILED = "Couldn't load the passphrase — hide and retry.";

/**
 * @param {{
 *   fetchSecret: () => Promise<string|null>,
 *   onReveal?: () => void,
 * }} opts
 * @returns {{ value: HTMLElement, btn: HTMLButtonElement }} detached elements
 *   for the caller to place (value first, eye button beside it).
 */
export function createPassphraseReveal({ fetchSecret, onReveal }) {
  const value = document.createElement("code");
  value.className = "pw-current-value";
  value.textContent = MASK;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pw-toggle";
  btn.textContent = "👁";
  btn.setAttribute("aria-pressed", "false");
  btn.setAttribute("aria-label", "Show current passphrase");
  btn.title = "Show current passphrase";

  let revealed = false;
  /** @type {string|null|undefined} */
  let cached; // undefined = not fetched yet

  btn.addEventListener("click", async () => {
    revealed = !revealed;
    if (!revealed) {
      value.textContent = MASK;
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("aria-label", "Show current passphrase");
      btn.classList.remove("is-revealed");
      return;
    }
    btn.setAttribute("aria-pressed", "true");
    btn.setAttribute("aria-label", "Hide current passphrase");
    btn.classList.add("is-revealed");
    if (cached === undefined) {
      btn.disabled = true;
      value.textContent = "Loading…";
      let fetched;
      try {
        fetched = await fetchSecret();
      } catch (_e) {
        fetched = undefined; // leave uncached so the next reveal retries
      }
      btn.disabled = false;
      if (fetched === undefined) {
        value.textContent = LOAD_FAILED;
        return;
      }
      cached = fetched;
    }
    value.textContent = cached ? cached : NOT_SAVED;
    if (onReveal) {
      try {
        onReveal();
      } catch (_e) {
        /* best-effort — never block the reveal on the audit hook */
      }
    }
  });

  return { value, btn };
}

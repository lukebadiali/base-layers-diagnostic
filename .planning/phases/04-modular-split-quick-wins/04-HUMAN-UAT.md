---
status: partial
phase: 04-modular-split-quick-wins
source: [04-VERIFICATION.md]
started: "2026-05-07T16:10:00Z"
updated: "2026-05-07T16:10:00Z"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Smoke test the production app boots from src/main.js with byte-identical UI
expected: Open the dev server (npm run dev), sign in, navigate dashboard / diagnostic / pillar / report / chat / funnel / documents / roadmap. UI renders identically to the pre-Phase-4 baseline. No console errors during boot or route changes. (Snapshot baselines pin the 3 representative views at zero diff but smoke-checking the full route surface is human-only since dispatch through the IIFE-resident closures only exercises under real boot.)
result: [pending]

### 2. Verify a file upload through the documents view exercises validateUpload BEFORE saveDocument
expected: Attempting to upload a file with declared type=image/png but PDF magic bytes triggers a notify('error', ...) toast and DOES NOT write to Storage. Attempting to upload a clean PDF succeeds and the path uses the sanitisedName.
result: [pending]

### 3. Verify chat tab-title memoisation does not flicker
expected: With chat open and another user posting messages, the tab title updates to '(N) ...' once when the unread count changes; it does NOT re-write document.title every onSnapshot tick if the count is unchanged. (Memoisation is correct in unit tests; manual check confirms no UX regression.)
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

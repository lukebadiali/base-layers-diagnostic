// src/auth/role-predicates.js
// @ts-check
//
// PLATFORM-UAT T17 fix (2026-05-25): role-predicate helpers.
//
// Before this file existed, src/main.js (and views/) had ~8 sites doing
// `user.role === "internal"` inline. That check predates the Phase 06.1
// role-taxonomy change which introduced a distinct "admin" role on top of
// the original {internal, client} pair, giving us {admin, internal, client}.
// The legacy sites were never updated — so role="admin" users were silently
// degraded to client-level on multiple surfaces:
//   - Plan view: drag-and-drop disabled (canEdit was internal-only)
//   - Chat unread tab-title badge: showed 0 for admins
//   - Dashboard unread-client-chat alert banner: hidden from admins
//   - Documents: private-visibility filter excluded admins
//   - Admin panel: "Internal team" list excluded admins entirely
//   - Init: state.orgId auto-select skipped admins
//   - Various view subtext / avatar-class branches
//
// Strategy: name the predicate by intent, not by role enum value. Surfaces
// generally want one of two things:
//   1. "Is this user staff (BeDeveloped team — admin OR internal)?" →
//      isStaff(user). Use for: edit gates, chrome visibility, internal
//      filters, tab-title chat badges, banner alerts, init org-select.
//   2. "Is this user *exclusively* internal (NOT admin, NOT client)?" →
//      isInternalOnly(user). Use ONLY if the surface genuinely needs to
//      distinguish admin from internal — e.g. some future "admin tools"
//      surface that admins see but internal staff don't. None of the 8
//      sites currently need this distinction; isStaff is what was always
//      meant.
//
// Single source of truth: if the role taxonomy changes again, fix it here
// and every site updates atomically.

/**
 * True if the user is BeDeveloped staff (admin OR internal). Most "internal
 * vs client" checks across the codebase actually mean this. Returns false
 * for null/undefined users to keep callers terse (no null guard needed).
 *
 * @param {{ role?: string } | null | undefined} user
 * @returns {boolean}
 */
export function isStaff(user) {
  if (!user) return false;
  return user.role === "admin" || user.role === "internal";
}

/**
 * True if the user has exactly role="internal" (NOT admin, NOT client).
 * Use only when a surface genuinely needs to distinguish admin from
 * internal-staff. If you find yourself reaching for this, double-check
 * whether `isStaff` is what you actually mean — almost all of the 8
 * pre-T17 sites had `role === "internal"` but actually meant "is staff".
 *
 * @param {{ role?: string } | null | undefined} user
 * @returns {boolean}
 */
export function isInternalOnly(user) {
  return !!user && user.role === "internal";
}

/**
 * True if a user holding this role must hold a second factor — i.e. the
 * sign-in ladder forces TOTP enrolment when they have none. Every known app
 * role qualifies: admin + internal (BeDeveloped staff) AND client. Clients
 * were exempt before 2026-06 — adding them here is the single source of truth
 * for "MFA is mandatory for everyone who signs in", matching the
 * compliance-credible posture.
 *
 * Takes the bare role string (state.fbUser.appClaims.role) rather than a user
 * object — by the time the gate runs, main.js has already extracted `role`.
 * Unknown / null / undefined roles return false: a new role must be added
 * here deliberately, never force MFA on a role we haven't reasoned about.
 *
 * @param {string | null | undefined} role
 * @returns {boolean}
 */
export function mfaEnrolmentRequiredForRole(role) {
  return role === "admin" || role === "internal" || role === "client";
}

# Base Layers Diagnostic — Recent Improvements

**Prepared for:** Our clients
**From:** BeDeveloped
**Date:** 26 May 2026

We've been steadily improving the diagnostic tool you use during your
Base Layers engagement. This note covers the two areas you're most
likely to notice: how you sign in, and how the app looks and behaves
day to day. We've also added a clear privacy notice you can read at
any time.

If you have questions about anything here, your BeDeveloped lead is
the best first point of contact, or you can email
**security@bedeveloped.com** directly.

---

## How you sign in

We've moved every account onto a proper sign-in experience, the kind
you'd expect from a modern business tool. Practically, that means:

- **You sign in with your own work email and your own password.**
  We no longer share a single passphrase across your team. Your
  consultant invites you, you set your password the first time you
  arrive, and from then on it's yours.
- **Forgotten password?** Use the "Forgot password" link on the
  sign-in page. We'll email you a reset link. No need to email anyone
  at BeDeveloped to get back in.
- **Stronger account checks behind the scenes.** Every password we
  accept is checked against published lists of leaked passwords, and
  we enforce a sensible minimum length. We never see or store your
  password ourselves — that's handled by Google Identity Platform
  on our behalf.
- **Two-factor authentication for the BeDeveloped team.** Every
  consultant on our side must have a TOTP authenticator app (Google
  Authenticator, 1Password, Authy and similar) registered before they
  can access your data. If a consultant ever loses access to their
  authenticator, there's a documented recovery process so we don't
  resort to ad-hoc workarounds. Two-factor authentication is currently
  optional for client accounts and will be available to enable from
  your account settings.
- **A friendly first-run flow.** When you accept an invite for the
  first time, the screens that walk you through setting a password
  and (if you choose) registering two-factor authentication now use
  the same look and feel as the rest of the tool.

---

## How the app looks and feels

Several small refinements that add up to a tool that feels less
cluttered and works on more screen sizes:

- **Cleaner top navigation.** The "Delivery" tab has moved. The
  four delivery-framework stages now live at the bottom of the
  Diagnostic page — the same page where you score the ten pillars —
  so you can see your engagement stage and your pillar work
  side-by-side without flicking between tabs. This also frees up
  space across the top of the screen, which we'd been hearing
  was getting cramped on standard laptops.
- **Better fit on standard laptop screens.** A few elements at the
  top of the page were nudging off the edge on common laptop
  resolutions. They now resize properly so the whole tool fits in
  view without a horizontal scrollbar.
- **Tidied "Invite client" form.** The form your consultant uses to
  invite new client team members now has consistent field styling —
  a small thing, but it had been looking unfinished.
- **Settings is now usable.** The Settings page for BeDeveloped
  admins used to show an internal note that wasn't meant for human
  reading. That's gone, replaced with a "Two-factor authentication"
  status indicator that tells admins at a glance whether they have
  their second factor registered.
- **Plain-English footer.** The page footer used to claim "Data
  stays in this browser" — a relic from an early prototype. It's now
  accurate: your engagement's organisation name, nothing more.

---

## Privacy & data rights

You'll now see a **Privacy** link in the footer of every page. It
opens a one-page, plain-English notice that explains:

- What we collect when you use the diagnostic, and why.
- Where your data is stored (UK and EU — your data does not leave
  these regions under normal operation).
- Who else processes your data on our behalf — currently Google
  Firebase (the platform the tool runs on) and Sentry (the tool we
  use to spot errors and fix them quickly). Both are bound by
  EU-region data-processing agreements.
- How long we keep your data, and what happens when you ask us to
  delete it.
- The rights you have under UK GDPR — including the right to a copy
  of everything we hold about you, and the right to ask us to delete
  it — and how to exercise them.

To exercise any of those rights, or to ask a privacy question,
email **security@bedeveloped.com**. We aim to respond within 30 days.

---

## What's next

A few items are queued for the next cycle that you'll see soon:

- A "Two-factor authentication" toggle on your own account settings
  so you can opt in without going through BeDeveloped.
- A "Download my data" button that gives you a JSON file containing
  everything we hold about you, without needing to email us.
- A "Delete my account" button on the same page, for when an
  engagement ends.

If any of the above prompts a question, please reach out to your
BeDeveloped lead or email **security@bedeveloped.com**. We'd rather
answer a small question early than have you wondering.

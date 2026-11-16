#!/usr/bin/env python3
"""Read the IAM / IdP snapshots written by run.sh and say what they mean.

Usage:
    report.py <snapdir> <phase> [--gate|--diff] <service> [<service> ...]

Modes:
    (none)   print what was read
    --gate   print, then exit 1 unless it is safe to deploy
    --diff   compare <phase> against "before" and name what was lost

The gate exists because of a false alarm on 2026-10-07: the first version of
this check rendered an HTTP 403 error payload as "blockingFunctions.triggers: 0
/ mfa.state = None", which reads exactly like a project whose blocking handlers
have been wiped. It said "do not deploy" about a perfectly healthy project. So
an unreadable snapshot is now its own outcome, distinct from an empty one, and
neither is silently treated as the other.
"""

import json
import sys
from pathlib import Path

INVOKER = "roles/run.invoker"
# beforeCreate + beforeSignIn are the only blocking handlers functions/src/index.ts
# exports, so two is complete. The handover's "4 verified URLs" counts Cloud Run
# services with invoker bindings, not trigger slots -- a conflation that cost a
# round trip when this script originally expected four.
EXPECTED_TRIGGERS = 2
# Scheduler-invoked, so it never carries an allUsers binding.
NO_PUBLIC_INVOKER = {"scheduledpurge"}


def load(path):
    """Return (data, error_string). Unreadable is not the same as empty."""
    p = Path(path)
    if not p.exists():
        return None, f"not written ({p.name})"
    raw = p.read_text()
    try:
        d = json.loads(raw)
    except json.JSONDecodeError:
        return None, f"not JSON: {raw[:160]}"
    if isinstance(d, dict) and "error" in d:
        e = d["error"]
        return None, f"HTTP {e.get('code')} {e.get('status')}: {e.get('message', '')[:200]}"
    return d, None


def has_public_invoker(policy):
    return any(
        b.get("role") == INVOKER and "allUsers" in b.get("members", [])
        for b in (policy or {}).get("bindings", [])
    )


def main():
    args = sys.argv[1:]
    snap, phase = args[0], args[1]
    mode = None
    rest = args[2:]
    if rest and rest[0] in ("--gate", "--diff"):
        mode, rest = rest[0], rest[1:]
    services = rest

    problems = []

    print("  Cloud Run invoker bindings")
    policies = {}
    for s in services:
        pol, err = load(f"{snap}/{s}.{phase}.json")
        policies[s] = pol
        if err:
            print(f"    {s:32} UNREAD  {err}")
            problems.append(f"{s}: policy unreadable - {err}")
            continue
        pub = has_public_invoker(pol)
        roles = ", ".join(
            f"{b.get('role')} {b.get('members')}" for b in pol.get("bindings", [])
        ) or "(no bindings)"
        flag = "" if (pub or s in NO_PUBLIC_INVOKER) else "   <-- no allUsers invoker"
        print(f"    {s:32} {roles}{flag}")

    idp, err = load(f"{snap}/idp.{phase}.json")
    print("  IdP config")
    if err:
        print(f"    UNREAD  {err}")
        print("    This is a READ failure, not a project failure. Do not act on it.")
        print("    If it mentions a quota project, run.sh already sends")
        print("    x-goog-user-project -- check ADC itself.")
        problems.append(f"idp config unreadable - {err}")
    elif "mfa" not in idp:
        print("    no 'mfa' key -> not a full config response; treat as unread.")
        problems.append("idp config incomplete")
    else:
        triggers = idp.get("blockingFunctions", {}).get("triggers", {})
        print(f"    blockingFunctions.triggers: {len(triggers)} "
              f"(expected {EXPECTED_TRIGGERS})")
        for name, t in sorted(triggers.items()):
            print(f"      {name:14} -> {str(t.get('functionUri', ''))[:80]}")
        state = idp.get("mfa", {}).get("state")
        print(f"    mfa.state = {state}")
        if len(triggers) < EXPECTED_TRIGGERS:
            problems.append(
                f"only {len(triggers)}/{EXPECTED_TRIGGERS} blocking triggers wired - "
                "rewire before deploying, or you lose the reference copy"
            )
        if state != "ENABLED":
            problems.append(
                f"mfa.state is {state}, not ENABLED - the client gates are live, "
                "so this is a lockout waiting for the next sign-in"
            )

    if mode == "--diff":
        print("  Changes against the before snapshot")
        lost = False
        for s in services:
            before, berr = load(f"{snap}/{s}.before.json")
            if berr or policies.get(s) is None:
                continue
            if has_public_invoker(before) and not has_public_invoker(policies[s]):
                print(f"    {s:32} LOST allUsers {INVOKER}")
                lost = True
        bidp, _ = load(f"{snap}/idp.before.json")
        if bidp and idp:
            bt = bidp.get("blockingFunctions", {}).get("triggers", {})
            at = idp.get("blockingFunctions", {}).get("triggers", {})
            if len(at) < len(bt):
                print(f"    blocking triggers {len(bt)} -> {len(at)}  LOST")
                lost = True
            bs = bidp.get("mfa", {}).get("state")
            as_ = idp.get("mfa", {}).get("state")
            if bs != as_:
                print(f"    mfa.state {bs} -> {as_}  CHANGED")
                lost = True
        if not lost:
            print("    nothing lost - bindings, triggers and mfa.state all unchanged")
        return 0

    if mode == "--gate":
        if problems:
            print()
            print("  PRE-DEPLOY GATE FAILED:")
            for p in problems:
                print(f"    - {p}")
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

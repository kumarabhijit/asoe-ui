// useSignOut — sign-out handler with a screen-reader announcement.
//
// Q1: every status change is observable via the canonical
// <StatusAnnouncer>. Sign-out is a status change. Toasts disappear
// across the navigation; the announcement lives long enough for
// the screen reader to speak before the redirect tears down the
// authenticated context.
//
// The hook centralises what used to be a one-liner duplicated
// across seven pages:
//
//   onSignOut={() => signOut({ callbackUrl: "/login" })}
//
// Pages now do:
//
//   const onSignOut = useSignOut();
//   ...
//   <NavBar onSignOut={onSignOut} ... />
//
// Behaviour:
//   1. Emit "Signing out…" through useStatusAnnouncer().
//   2. Defer next-auth's signOut() to a macrotask (setTimeout 0) so
//      the announcement commits AND a paint frame lands before the
//      redirect tears the page down.
//
// Caveat: aria-live="polite" speaks "after the current
// utterance, not interrupting" — there is no guarantee the SR
// finishes the phrase before the new page mounts. Mitigation:
// the /login route also mounts <StatusAnnouncer>, and SR engines
// re-attach across same-origin navigations on every major
// browser today. If a regression appears, switch the test to
// assert the announcer text on /inbox BEFORE navigation rather
// than on /login after.
"use client";

import { useCallback } from "react";
import { signOut } from "next-auth/react";
import { useStatusAnnouncer } from "@/components/ui/StatusAnnouncer";

export interface UseSignOutOptions {
  callbackUrl?: string;
}

export function useSignOut(options: UseSignOutOptions = {}) {
  const { callbackUrl = "/login" } = options;
  const { announce } = useStatusAnnouncer();

  return useCallback(() => {
    announce("Signing out");
    // Defer signOut() to a macrotask (not just a microtask) so the
    // "Signing out" announcement is committed to the live region AND
    // the browser gets a render frame before next-auth tears the page
    // down. The announcer's own commit runs on a microtask
    // (StatusAnnouncer.tsx); a microtask-scheduled signOut() runs
    // before any paint, so on a fast redirect the authenticated page
    // could navigate before the live region was observable — the race
    // the hook's caveat predicted, and the source of the
    // signout-from-each-role e2e flake. setTimeout(0) yields a paint
    // frame, widening the observable window past assistive-tech (and
    // the e2e poll) granularity. The redirect is still immediate to
    // the operator.
    setTimeout(() => {
      void signOut({ callbackUrl });
    }, 0);
  }, [announce, callbackUrl]);
}

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
//   2. Defer next-auth's signOut() to the next microtask so the
//      announcement settles before navigation.
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
    // queueMicrotask gives the announcer's own microtask a tick
    // to commit the message before signOut starts the redirect.
    queueMicrotask(() => {
      void signOut({ callbackUrl });
    });
  }, [announce, callbackUrl]);
}

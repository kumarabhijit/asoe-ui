/**
 * useSlaTicker — re-tick the SLA snapshot once per minute
 * (issue #133, PO #20).
 *
 * The `slaSnapshot()` helper computes "X hours to SLA" from a fixed
 * deadline timestamp and a `now` reference. Without a periodic
 * re-render, the band labels go stale until the next data fetch.
 * The PO asked for a visible countdown that goes red as SLA
 * approaches; this hook is the minimal hook-side bridge that
 * forces a re-render once a minute so consumers can pass `tickNow`
 * into `slaSnapshot()` and get a live label.
 *
 * Per-minute is the right cadence for hour-resolution countdowns.
 * Going faster (e.g. every second) would re-render the whole page
 * tree for no operator benefit.
 */
"use client";

import { useEffect, useState } from "react";

/** Polling interval in ms. Exported so tests can assert the cadence
 *  without coupling to the literal. */
export const SLA_TICK_INTERVAL_MS = 60_000;

export function useSlaTicker(): Date {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), SLA_TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}

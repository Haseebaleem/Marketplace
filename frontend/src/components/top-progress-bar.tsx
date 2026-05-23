"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  useIsFetching,
  useIsMutating,
} from "@tanstack/react-query";
import NProgress from "nprogress";

// Suppress the bar for very fast events (<150ms) — flashing the bar on
// every cache hit produces visual noise.
const SHOW_DELAY_MS = 150;

NProgress.configure({
  showSpinner: false,
  trickleSpeed: 200,
  minimum: 0.08,
});

/**
 * Drives the nprogress bar from three signals:
 *   - route changes (pathname or query string)
 *   - any in-flight TanStack Query mutation
 *   - any in-flight TanStack Query fetch (beyond a 150ms debounce so the
 *     bar doesn't flash on warm cache hits)
 *
 * One <TopProgressBar /> lives at the root layout level. It is purely a
 * side-effecting hook — it renders nothing.
 */
export const TopProgressBar = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();

  // Track which signals currently want the bar visible.
  const showSourcesRef = useRef(new Set<"route" | "fetch" | "mutate">());
  const startedRef = useRef(false);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sync = () => {
    if (showSourcesRef.current.size > 0 && !startedRef.current) {
      NProgress.start();
      startedRef.current = true;
    } else if (showSourcesRef.current.size === 0 && startedRef.current) {
      NProgress.done();
      startedRef.current = false;
    }
  };

  const setSource = (
    key: "route" | "fetch" | "mutate",
    active: boolean,
  ) => {
    if (active) showSourcesRef.current.add(key);
    else showSourcesRef.current.delete(key);
    sync();
  };

  // Route changes: bar shows briefly while the new segment commits.
  useEffect(() => {
    setSource("route", true);
    const t = setTimeout(() => setSource("route", false), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Mutations: bar visible whenever one is pending.
  useEffect(() => {
    setSource("mutate", isMutating > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMutating]);

  // Queries: debounce so cache-hit refetches don't flash the bar.
  useEffect(() => {
    if (isFetching > 0) {
      if (fetchTimerRef.current === null) {
        fetchTimerRef.current = setTimeout(() => {
          setSource("fetch", true);
        }, SHOW_DELAY_MS);
      }
    } else {
      if (fetchTimerRef.current !== null) {
        clearTimeout(fetchTimerRef.current);
        fetchTimerRef.current = null;
      }
      setSource("fetch", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFetching]);

  // On unmount, make sure we don't leave the bar stuck.
  useEffect(() => {
    return () => {
      if (fetchTimerRef.current !== null) clearTimeout(fetchTimerRef.current);
      NProgress.remove();
    };
  }, []);

  return null;
};

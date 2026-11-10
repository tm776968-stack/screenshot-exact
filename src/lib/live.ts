/**
 * Live data strategy:
 * - WebSocket (Supabase Realtime) only for the scoresheet, TV mode and organizers.
 * - Light polling for public visitors (matches + events of live matches only).
 * - Every change patches the cached bundle; nothing reloads the whole tournament.
 * - Both pause while the page is hidden and revalidate when it comes back.
 */
import { useEffect, useRef, useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Bundle, Match, MatchEvent } from "@/lib/data";
import { applyEventChange, applyMatchChange, isBundle, matchesToRefresh, mergeLive, type ChangeType } from "@/lib/live-cache";

/** After this long in the background, coming back reloads the full bundle instead of a light refresh. */
const LONG_HIDDEN_MS = 5 * 60_000;

export function usePageVisible() {
  const [visible, setVisible] = useState(() => (typeof document === "undefined" ? true : document.visibilityState !== "hidden"));
  useEffect(() => {
    const on = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return visible;
}

/** Applies `fn` to every cached bundle of the given tournament (both the by-id and by-slug copies). */
function patchBundles(qc: QueryClient, fn: (b: Bundle) => Bundle, tournamentId?: string) {
  for (const q of qc.getQueryCache().findAll({ queryKey: ["bundle"] })) {
    const data = q.state.data;
    if (!isBundle(data)) continue;
    if (tournamentId && data.tournament.id !== tournamentId) continue;
    const next = fn(data);
    if (next !== data) qc.setQueryData(q.queryKey, next);
  }
}

function cachedBundles(qc: QueryClient, ids: string[]) {
  const set = new Set(ids);
  const out = new Map<string, Bundle>();
  for (const q of qc.getQueryCache().findAll({ queryKey: ["bundle"] })) {
    const d = q.state.data;
    if (isBundle(d) && set.has(d.tournament.id)) out.set(d.tournament.id, d);
  }
  return out;
}

/** Full reload of the bundles of these tournaments (rare: structural changes or long absence). */
export function reloadBundles(qc: QueryClient, ids: string[]) {
  const set = new Set(ids);
  return qc.invalidateQueries({
    queryKey: ["bundle"],
    predicate: (q) => isBundle(q.state.data) && set.has(q.state.data.tournament.id),
  });
}

/**
 * Light refresh: one query for the matches of these tournaments and one for the events of
 * matches that are (or just were) live. Teams, players, courts, rules are not touched.
 */
export async function refreshLive(qc: QueryClient, ids: string[]) {
  if (!ids.length) return;
  const { data: matches, error } = await supabase.from("matches").select("*").in("tournament_id", ids);
  if (error || !matches) return;
  const cached = cachedBundles(qc, ids);
  const allCached = [...cached.values()].flatMap((b) => b.matches);
  const eventIds = matchesToRefresh(allCached, matches as Match[]);
  let events: MatchEvent[] = [];
  if (eventIds.length) {
    const r = await supabase.from("match_events").select("*").in("match_id", eventIds);
    if (r.error) return;
    events = r.data as MatchEvent[];
  }
  for (const id of ids) patchBundles(qc, (b) => mergeLive(b, matches as Match[], eventIds, events), id);
}

type Row = { id: string; tournament_id?: string };

/**
 * WebSocket channel for organizers, the scoresheet and TV mode.
 * Disconnects while the page is hidden; on return (or after a dropped connection) revalidates.
 */
export function useLiveChannel(tournamentIds: string[], enabled = true) {
  const qc = useQueryClient();
  const visible = usePageVisible();
  const key = [...tournamentIds].sort().join(",");
  const hiddenAt = useRef<number | null>(null);
  const firstConnect = useRef(true);
  const skipRejoin = useRef(false);

  // When the page comes back after a long absence, reload everything; a short absence is
  // covered by the light refresh done when the channel re-joins (below).
  useEffect(() => {
    if (!key || !enabled) return;
    if (!visible) {
      hiddenAt.current = hiddenAt.current ?? Date.now();
      return;
    }
    if (hiddenAt.current == null) return;
    const away = Date.now() - hiddenAt.current;
    hiddenAt.current = null;
    if (away > LONG_HIDDEN_MS) {
      skipRejoin.current = true;
      void reloadBundles(qc, key.split(","));
    }
  }, [visible, key, enabled, qc]);

  useEffect(() => {
    if (!key || !enabled || !visible) return;
    const ids = key.split(",");
    const idSet = new Set(ids);
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => void reloadBundles(qc, ids), 1500);
    };

    const onMatch = (p: RealtimePostgresChangesPayload<Match>) => {
      const type = p.eventType as ChangeType;
      const row = (type === "DELETE" ? p.old : p.new) as Row;
      if (!row?.id) return;
      if (type === "DELETE") {
        // Deletes arrive unfiltered and with only the id: drop it wherever it is cached.
        let mine = false;
        patchBundles(qc, (b) => {
          const next = applyMatchChange(b, "DELETE", row);
          if (next !== b) mine = true;
          return next;
        });
        // Matches are only deleted when the schedule is regenerated: reload once things settle.
        if (mine) scheduleReload();
        return;
      }
      if (row.tournament_id && !idSet.has(row.tournament_id)) return;
      patchBundles(qc, (b) => applyMatchChange(b, type, row as Match), row.tournament_id);
      if (type === "INSERT") scheduleReload();
    };

    const onEvent = (p: RealtimePostgresChangesPayload<MatchEvent>) => {
      const type = p.eventType as ChangeType;
      const row = (type === "DELETE" ? p.old : p.new) as Row;
      if (!row?.id) return;
      if (type === "DELETE") {
        patchBundles(qc, (b) => applyEventChange(b, "DELETE", row));
        return;
      }
      if (row.tournament_id && !idSet.has(row.tournament_id)) return;
      patchBundles(qc, (b) => applyEventChange(b, type, row as MatchEvent), row.tournament_id);
    };

    let ch = supabase.channel(`live-${Math.random().toString(36).slice(2)}`);
    for (const id of ids) {
      const filter = `tournament_id=eq.${id}`;
      ch = ch
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "matches", filter }, onMatch)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "matches", filter }, onMatch)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "match_events", filter }, onEvent)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "match_events", filter }, onEvent);
    }
    // Postgres Changes can't filter deletes; they carry only the id and are rare (undo, regenerate).
    ch = ch
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "matches" }, onMatch)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "match_events" }, onEvent);

    ch.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      // A re-join means updates may have been missed while disconnected.
      if (firstConnect.current) firstConnect.current = false;
      else if (skipRejoin.current) skipRejoin.current = false;
      else void refreshLive(qc, ids);
    });

    return () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      supabase.removeChannel(ch);
    };
  }, [key, enabled, visible, qc]);
}

/**
 * Light polling for public visitors. Runs only while enabled (live/games tab) and the page is visible;
 * refreshes immediately when it becomes active again.
 */
export function useLivePolling(tournamentIds: string[], { enabled, intervalMs = 12_000 }: { enabled: boolean; intervalMs?: number }) {
  const qc = useQueryClient();
  const visible = usePageVisible();
  const key = [...tournamentIds].sort().join(",");
  const hiddenAt = useRef<number | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!visible) hiddenAt.current = hiddenAt.current ?? Date.now();
  }, [visible]);

  useEffect(() => {
    if (!key || !enabled || !visible) return;
    const ids = key.split(",");
    const away = hiddenAt.current ? Date.now() - hiddenAt.current : 0;
    hiddenAt.current = null;
    // Catch up right away when (re)activated — except on the very first mount, when the data was just loaded.
    if (started.current) {
      if (away > LONG_HIDDEN_MS) void reloadBundles(qc, ids);
      else void refreshLive(qc, ids);
    }
    started.current = true;
    const t = setInterval(() => void refreshLive(qc, ids), intervalMs);
    return () => clearInterval(t);
  }, [key, enabled, visible, intervalMs, qc]);
}

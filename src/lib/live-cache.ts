/**
 * Pure helpers that patch a cached tournament bundle in place of reloading it.
 * Kept free of Supabase/React imports so they are easy to test.
 */
import type { Bundle, Match, MatchEvent } from "@/lib/data";

export type ChangeType = "INSERT" | "UPDATE" | "DELETE";

export function isBundle(x: unknown): x is Bundle {
  return !!x && typeof x === "object" && "tournament" in x && "matches" in x && "events" in x;
}

/** Same order the loader uses: round, bracket position, scheduled time. */
export function sortMatches(ms: Match[]) {
  return [...ms].sort(
    (a, b) =>
      a.round - b.round ||
      (a.bracket_pos ?? Number.MAX_SAFE_INTEGER) - (b.bracket_pos ?? Number.MAX_SAFE_INTEGER) ||
      (a.scheduled_at ?? "9999").localeCompare(b.scheduled_at ?? "9999"),
  );
}

/**
 * Applies one change of the matches table.
 * Returns the same bundle object when nothing changed (so React doesn't re-render).
 */
export function applyMatchChange(b: Bundle, type: ChangeType, row: Partial<Match> & { id: string }): Bundle {
  const idx = b.matches.findIndex((m) => m.id === row.id);
  if (type === "DELETE") {
    if (idx < 0) return b;
    return { ...b, matches: b.matches.filter((m) => m.id !== row.id) };
  }
  const full = row as Match;
  if (full.tournament_id && full.tournament_id !== b.tournament.id) return b;
  if (idx < 0) {
    if (type === "UPDATE" && !full.tournament_id) return b;
    return { ...b, matches: sortMatches([...b.matches, full]) };
  }
  const merged = { ...b.matches[idx]!, ...full };
  const matches = [...b.matches];
  matches[idx] = merged;
  return { ...b, matches };
}

/** Applies one change of the match_events table. */
export function applyEventChange(b: Bundle, type: ChangeType, row: Partial<MatchEvent> & { id: string }): Bundle {
  const idx = b.events.findIndex((e) => e.id === row.id);
  if (type === "DELETE") {
    if (idx < 0) return b;
    return { ...b, events: b.events.filter((e) => e.id !== row.id) };
  }
  const full = row as MatchEvent;
  if (full.tournament_id !== b.tournament.id) return b;
  if (idx < 0) {
    const events = [...b.events, full].sort((x, y) => x.created_at.localeCompare(y.created_at));
    return { ...b, events };
  }
  const events = [...b.events];
  events[idx] = { ...events[idx]!, ...full };
  return { ...b, events };
}

/** Match ids whose events must be re-checked: live now, or live in the cached copy (just ended). */
export function matchesToRefresh(cached: Match[], fresh: Match[]) {
  const live = (m: Match) => m.status === "ao_vivo" || m.status === "intervalo";
  const ids = new Set<string>();
  for (const m of fresh) if (live(m)) ids.add(m.id);
  for (const m of cached) if (live(m)) ids.add(m.id);
  return [...ids];
}

/** Merges a light refresh (all matches + events of the given matches) into a bundle. */
export function mergeLive(b: Bundle, matches: Match[], refreshedMatchIds: string[], events: MatchEvent[]): Bundle {
  const own = matches.filter((m) => m.tournament_id === b.tournament.id);
  const ids = new Set(refreshedMatchIds);
  const keep = b.events.filter((e) => !ids.has(e.match_id));
  const fresh = events.filter((e) => e.tournament_id === b.tournament.id);
  return {
    ...b,
    matches: sortMatches(own),
    events: [...keep, ...fresh].sort((x, y) => x.created_at.localeCompare(y.created_at)),
  };
}

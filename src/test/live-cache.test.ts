import { describe, expect, it } from "vitest";
import type { Bundle, Match, MatchEvent } from "@/lib/data";
import { applyEventChange, applyMatchChange, matchesToRefresh, mergeLive } from "@/lib/live-cache";

const match = (id: string, extra: Partial<Match> = {}) =>
  ({ id, tournament_id: "T", round: 1, bracket_pos: 0, scheduled_at: null, status: "agendado", home_score: 0, away_score: 0, ...extra }) as Match;
const event = (id: string, match_id: string, created_at: string, extra: Partial<MatchEvent> = {}) =>
  ({ id, match_id, tournament_id: "T", created_at, ...extra }) as MatchEvent;
const bundle = (matches: Match[], events: MatchEvent[] = []) =>
  ({ tournament: { id: "T" }, matches, events, teams: [], players: [] }) as unknown as Bundle;

describe("atualização cirúrgica do cache", () => {
  it("troca só o placar da partida alterada e mantém o resto igual", () => {
    const b = bundle([match("a"), match("b")]);
    const n = applyMatchChange(b, "UPDATE", match("a", { home_score: 2, status: "ao_vivo" }));
    expect(n.matches.find((m) => m.id === "a")?.home_score).toBe(2);
    expect(n.matches.find((m) => m.id === "b")).toBe(b.matches[1]);
    expect(n.teams).toBe(b.teams);
  });
  it("ignora partidas de outra categoria", () => {
    const b = bundle([match("a")]);
    expect(applyMatchChange(b, "UPDATE", match("x", { tournament_id: "OUTRO" }))).toBe(b);
  });
  it("exclusão sem tournament_id (só o id) remove onde estiver", () => {
    const b = bundle([match("a"), match("b")]);
    expect(applyMatchChange(b, "DELETE", { id: "a" }).matches.map((m) => m.id)).toEqual(["b"]);
    expect(applyMatchChange(b, "DELETE", { id: "zzz" })).toBe(b);
  });
  it("adiciona evento em ordem e desfaz pelo id", () => {
    const b = bundle([match("a")], [event("e1", "a", "2026-01-01T10:00:00Z")]);
    const n = applyEventChange(b, "INSERT", event("e0", "a", "2026-01-01T09:00:00Z"));
    expect(n.events.map((e) => e.id)).toEqual(["e0", "e1"]);
    expect(applyEventChange(n, "DELETE", { id: "e1" }).events.map((e) => e.id)).toEqual(["e0"]);
  });
  it("evento repetido (eco do próprio lançamento) não duplica", () => {
    const e = event("e1", "a", "2026-01-01T10:00:00Z");
    const b = bundle([match("a")], [e]);
    expect(applyEventChange(b, "INSERT", e).events.length).toBe(1);
  });
});

describe("atualização leve (polling)", () => {
  it("revisa eventos das partidas ao vivo e das que acabaram de terminar", () => {
    const cached = [match("a", { status: "ao_vivo" }), match("b")];
    const fresh = [match("a", { status: "encerrado" }), match("b", { status: "ao_vivo" })];
    expect(matchesToRefresh(cached, fresh).sort()).toEqual(["a", "b"]);
  });
  it("substitui os eventos só das partidas revisadas", () => {
    const b = bundle([match("a"), match("c")], [event("old", "a", "1"), event("keep", "c", "2")]);
    const n = mergeLive(b, [match("a", { home_score: 1 }), match("c")], ["a"], [event("new", "a", "3")]);
    expect(n.events.map((e) => e.id)).toEqual(["keep", "new"]);
    expect(n.matches.find((m) => m.id === "a")?.home_score).toBe(1);
  });
});

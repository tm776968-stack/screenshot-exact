import { describe, it, expect } from "vitest";
import { roundRobin, knockout, standings, DEFAULT_SETTINGS, suspendedPlayers } from "@/lib/tournament";

describe("geração de tabela", () => {
  it("pontos corridos turno único: 4 equipes = 6 jogos", () => {
    expect(roundRobin(["a", "b", "c", "d"]).length).toBe(6);
  });
  it("turno e returno: 4 equipes = 12 jogos", () => {
    expect(roundRobin(["a", "b", "c", "d"], true).length).toBe(12);
  });
  it("mata-mata com 8 equipes = 7 jogos, com 3º lugar = 8", () => {
    expect(knockout(["1", "2", "3", "4", "5", "6", "7", "8"]).length).toBe(7);
    expect(knockout(["1", "2", "3", "4", "5", "6", "7", "8"], true).length).toBe(8);
  });
  it("mata-mata com 6 equipes: cabeças 1 e 2 avançam direto (bye)", () => {
    const ms = knockout(["1", "2", "3", "4", "5", "6"]);
    const semis = ms.filter((m) => m.stage === "semi");
    const seeded = semis.flatMap((m) => [m.home_team_id, m.away_team_id]);
    expect(seeded).toContain("1");
    expect(seeded).toContain("2");
  });
});

describe("classificação", () => {
  it("vitória vale 3, empate 1", () => {
    const rows = standings(
      ["a", "b", "c"],
      [
        { id: "1", stage: "liga", group_name: null, home_team_id: "a", away_team_id: "b", home_score: 2, away_score: 0, status: "encerrado" },
        { id: "2", stage: "liga", group_name: null, home_team_id: "b", away_team_id: "c", home_score: 1, away_score: 1, status: "encerrado" },
      ],
      DEFAULT_SETTINGS,
    );
    expect(rows[0]).toMatchObject({ team_id: "a", points: 3 });
    expect(rows.find((r) => r.team_id === "b")!.points).toBe(1);
  });
});

describe("suspensão", () => {
  it("1 vermelho suspende no próximo jogo", () => {
    const types = new Map([["r", "vermelho"]]);
    const s = suspendedPlayers(
      [{ match_id: "m1", player_id: "p", event_type_id: "r" }],
      types,
      [{ id: "m1", status: "encerrado" }, { id: "m2", status: "agendado" }],
      "m2",
      DEFAULT_SETTINGS,
    );
    expect(s.has("p")).toBe(true);
  });
  it("3 amarelos suspendem", () => {
    const types = new Map([["y", "amarelo"]]);
    const ev = ["m1", "m2", "m3"].map((m) => ({ match_id: m, player_id: "p", event_type_id: "y" }));
    const ms = ["m1", "m2", "m3", "m4"].map((id) => ({ id, status: "encerrado" }));
    expect(suspendedPlayers(ev, types, ms, "m4", DEFAULT_SETTINGS).has("p")).toBe(true);
    expect(suspendedPlayers(ev.slice(0, 2), types, ms, "m3", DEFAULT_SETTINGS).has("p")).toBe(false);
  });
});

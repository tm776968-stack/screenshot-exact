import { describe, it, expect } from "vitest";
import { setsText, setsToWin, volleyState, type VolleyRules } from "@/lib/tournament";
import { ADMIN_EMAIL, emailToUsername, loginToEmail, normalizeUsername } from "@/lib/usernames";

const R: VolleyRules = { bestOf: 3, setPoints: 25, tieBreakPoints: 15, winBy2: true };
const pts = (seq: string) => [...seq].map((c) => (c === "h" ? "home" : "away") as "home" | "away");

describe("placar do vôlei", () => {
  it("sets necessários para vencer", () => {
    expect(setsToWin(1)).toBe(1);
    expect(setsToWin(3)).toBe(2);
    expect(setsToWin(5)).toBe(3);
  });
  it("fecha o set em 25 e abre o próximo", () => {
    const s = volleyState(pts("h".repeat(25)), R);
    expect(s.setsHome).toBe(1);
    expect(s.currentSet).toBe(2);
    expect(s.sets.at(-1)).toEqual({ h: 0, a: 0 });
  });
  it("com vantagem de 2, 25 a 24 ainda não fecha", () => {
    const s = volleyState(pts("h".repeat(24) + "a".repeat(24) + "h"), R);
    expect(s.setsHome).toBe(0);
    const s2 = volleyState(pts("h".repeat(24) + "a".repeat(24) + "hh"), R);
    expect(setsText(s2.sets)).toBe("26-24");
    expect(s2.setsHome).toBe(1);
  });
  it("set decisivo vai até 15 e decide o jogo", () => {
    const s = volleyState(pts("h".repeat(25) + "a".repeat(25) + "h".repeat(15)), R);
    expect(s.winner).toBe("home");
    expect(setsText(s.sets)).toBe("25-0, 0-25, 15-0");
  });
  it("ignora pontos depois de o jogo estar decidido", () => {
    const s = volleyState(pts("h".repeat(50) + "a".repeat(10)), R);
    expect(s.winner).toBe("home");
    expect(s.sets).toHaveLength(2);
  });
  it("sem vantagem de 2, fecha no ponto exato", () => {
    const s = volleyState(pts("h".repeat(20) + "a".repeat(21)), { ...R, setPoints: 21, winBy2: false });
    expect(s.setsAway).toBe(1);
  });
});

describe("login por nome de usuário", () => {
  it("Admin vira o e-mail interno do administrador", () => {
    expect(loginToEmail(" Admin ")).toBe(ADMIN_EMAIL);
    expect(emailToUsername(ADMIN_EMAIL)).toBe("admin");
  });
  it("aceita e-mail e recusa nomes com espaço", () => {
    expect(loginToEmail("Fulano@Exemplo.com")).toBe("fulano@exemplo.com");
    expect(loginToEmail("joão silva")).toBeNull();
    expect(normalizeUsername("joao.silva")).toBe("joao.silva");
  });
  it("e-mails reais não têm nome de usuário", () => {
    expect(emailToUsername("fulano@exemplo.com")).toBeNull();
  });
});

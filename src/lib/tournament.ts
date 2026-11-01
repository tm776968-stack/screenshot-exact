export type Sport = "volei_quadra" | "volei_areia";

export const SPORTS: { value: Sport; label: string }[] = [
  { value: "volei_quadra", label: "Vôlei de quadra" },
  { value: "volei_areia", label: "Vôlei de areia" },
];

export const sportLabel = (v: string | null | undefined) => SPORTS.find((s) => s.value === v)?.label ?? "Vôlei";

/** Players on court per team. */
export const TEAM_SIZES = [
  { value: 2, label: "Dupla" },
  { value: 3, label: "Trinca" },
  { value: 4, label: "Quarteto" },
  { value: 6, label: "Sexteto" },
] as const;
export const teamSizeLabel = (n: number | null | undefined) => TEAM_SIZES.find((t) => t.value === n)?.label ?? "Sexteto";

export const NAIPES = ["Masculino", "Feminino", "Misto"] as const;
export const CATEGORY_SUGGESTIONS = ["Sub-13", "Sub-15", "Sub-17", "Sub-19", "Sub-21", "Adulto", "Livre", "Master 35+", "Master 40+", "Master 50+"];

/** "Sub-17 · Feminino" */
export function divisionLabel(t: { category?: string | null; naipe?: string | null }) {
  return [t.category, t.naipe].filter(Boolean).join(" · ") || "Categoria única";
}

export const FORMATS = [
  { value: "mata_mata", label: "Mata-mata" },
  { value: "pontos_corridos", label: "Pontos corridos" },
  { value: "grupos_mata_mata", label: "Grupos + mata-mata" },
  { value: "dupla_eliminacao", label: "Dupla eliminação" },
] as const;

export const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  inscricoes: "Inscrições",
  andamento: "Em andamento",
  finalizado: "Finalizado",
};

export const MATCH_STATUS_LABEL: Record<string, string> = {
  agendado: "Agendado",
  ao_vivo: "Ao vivo",
  intervalo: "Intervalo",
  encerrado: "Encerrado",
  adiado: "Adiado",
  wo: "W.O.",
};

export type Tiebreaker = "pontos" | "vitorias" | "saldo" | "gols_pro" | "confronto" | "sorteio";
export const TIEBREAKER_LABEL: Record<Tiebreaker, string> = {
  pontos: "Pontos",
  vitorias: "Vitórias",
  saldo: "Saldo de sets",
  gols_pro: "Sets vencidos",
  confronto: "Confronto direto",
  sorteio: "Sorteio",
};

export interface Settings {
  win: number;
  draw: number;
  loss: number;
  tiebreakers: Tiebreaker[];
  allowDraw: boolean;
  extraTime: boolean;
  penalties: boolean;
  thirdPlace: boolean;
  doubleRound: boolean;
  groups: number;
  qualifiersPerGroup: number;
  suspensionYellows: number;
  suspensionReds: number;
  /** Players on court: 2 dupla, 3 trinca, 4 quarteto, 6 sexteto. */
  teamSize: number;
  /** Sets per match, played as "best of": 1, 3 or 5. */
  bestOf: number;
  /** Points to win a regular set. */
  setPoints: number;
  /** Points to win the deciding set (tie-break). */
  tieBreakPoints: number;
  /** A set only ends with a 2-point lead. */
  winBy2: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  win: 3,
  draw: 1,
  loss: 0,
  tiebreakers: ["pontos", "vitorias", "saldo", "gols_pro", "confronto", "sorteio"],
  allowDraw: true,
  extraTime: false,
  penalties: true,
  thirdPlace: false,
  doubleRound: false,
  groups: 2,
  qualifiersPerGroup: 2,
  suspensionYellows: 3,
  suspensionReds: 1,
  teamSize: 6,
  bestOf: 3,
  setPoints: 25,
  tieBreakPoints: 15,
  winBy2: true,
};

/** Usual rules for each modality and team size, used when a category is created. */
export function volleyDefaults(sport: string, teamSize?: number): Pick<Settings, "teamSize" | "bestOf" | "setPoints" | "tieBreakPoints" | "winBy2" | "allowDraw" | "win" | "draw" | "loss"> {
  const sand = sport === "volei_areia";
  return {
    teamSize: teamSize ?? (sand ? 2 : 6),
    bestOf: 3,
    setPoints: sand ? 21 : 25,
    tieBreakPoints: 15,
    winBy2: true,
    allowDraw: false,
    win: 3,
    draw: 0,
    loss: 0,
  };
}

export function readSettings(raw: unknown): Settings {
  return { ...DEFAULT_SETTINGS, ...((raw as Partial<Settings>) ?? {}) };
}

export interface EventPreset {
  key: string;
  name: string;
  icon: string;
  points: number;
  score_target: "own" | "opponent";
}

/** Scout for volleyball. Events that score add a rally point to the current set. */
export function eventPresets(_sport?: string): EventPreset[] {
  return [
    { key: "ponto", name: "Ponto", icon: "🏐", points: 1, score_target: "own" },
    { key: "ataque", name: "Ponto de ataque", icon: "💥", points: 1, score_target: "own" },
    { key: "bloqueio", name: "Bloqueio", icon: "🧱", points: 1, score_target: "own" },
    { key: "ace", name: "Ace", icon: "🎯", points: 1, score_target: "own" },
    { key: "erro", name: "Erro (ponto do adversário)", icon: "❌", points: 1, score_target: "opponent" },
    { key: "defesa", name: "Defesa", icon: "🛡️", points: 0, score_target: "own" },
    { key: "amarelo", name: "Cartão amarelo", icon: "🟨", points: 0, score_target: "own" },
    { key: "vermelho", name: "Cartão vermelho", icon: "🟥", points: 0, score_target: "own" },
  ];
}

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

const TZ = "America/Sao_Paulo";
export function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" && d.length === 10 ? new Date(d + "T12:00:00") : new Date(d);
  return date.toLocaleDateString("pt-BR", { timeZone: TZ });
}
export function fmtDateTime(d: string | null | undefined) {
  if (!d) return "A definir";
  const date = new Date(d);
  return (
    date.toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " +
    date.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
  );
}
/** ISO -> value for <input type="datetime-local"> in São Paulo time */
export function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}
export function fromLocalInput(v: string) {
  if (!v) return null;
  return new Date(v + ":00-03:00").toISOString();
}

export function clockSeconds(m: { clock_started_at: string | null; clock_elapsed: number }, now = Date.now()) {
  return m.clock_elapsed + (m.clock_started_at ? Math.floor((now - new Date(m.clock_started_at).getTime()) / 1000) : 0);
}
export function fmtClock(s: number) {
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/* ---------------- scheduling ---------------- */

export interface NewMatch {
  key: string;
  stage: string;
  round: number;
  group_name?: string | null;
  bracket_pos?: number | null;
  home_team_id: string | null;
  away_team_id: string | null;
  next_key?: string | null;
  next_slot?: "home" | "away" | null;
  status?: "agendado" | "encerrado";
}

/** Circle method round robin. */
export function roundRobin(teamIds: string[], doubleRound = false, group: string | null = null): NewMatch[] {
  const ids: (string | null)[] = [...teamIds];
  if (ids.length % 2) ids.push(null);
  const n = ids.length;
  const out: NewMatch[] = [];
  const rounds = n - 1;
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i];
      const b = ids[n - 1 - i];
      if (a && b) {
        const flip = r % 2 === 1 && i === 0;
        out.push({
          key: `${group ?? "L"}-${r}-${i}`,
          stage: group ? "grupo" : "liga",
          round: r + 1,
          group_name: group,
          home_team_id: flip ? b : a,
          away_team_id: flip ? a : b,
        });
      }
    }
    ids.splice(1, 0, ids.pop()!);
  }
  if (doubleRound) {
    const second = out.map((m) => ({
      ...m,
      key: m.key + "-R",
      round: m.round + rounds,
      home_team_id: m.away_team_id,
      away_team_id: m.home_team_id,
    }));
    out.push(...second);
  }
  return out;
}

export function stageName(roundsLeft: number) {
  if (roundsLeft === 1) return "final";
  if (roundsLeft === 2) return "semi";
  if (roundsLeft === 3) return "quartas";
  if (roundsLeft === 4) return "oitavas";
  return "mata";
}
export const STAGE_LABEL: Record<string, string> = {
  liga: "Pontos corridos",
  grupo: "Grupo",
  final: "Final",
  semi: "Semifinal",
  quartas: "Quartas de final",
  oitavas: "Oitavas de final",
  mata: "Mata-mata",
  terceiro: "Disputa de 3º lugar",
  vencedores: "Chave dos vencedores",
  perdedores: "Chave dos perdedores",
  grande_final: "Grande final",
};

/** Standard seeding order for a bracket of size n (1-indexed seeds). */
export function seedOrder(n: number): number[] {
  let order = [1];
  while (order.length < n) {
    const size = order.length * 2;
    order = order.flatMap((s) => [s, size + 1 - s]);
  }
  return order;
}

/** Single elimination. Teams in seed order (best first); null slots = byes. */
export function knockout(teamIds: (string | null)[], thirdPlace = false): NewMatch[] {
  let size = 1;
  while (size < teamIds.length) size *= 2;
  if (size < 2) return [];
  const order = seedOrder(size);
  const slots = order.map((s) => teamIds[s - 1] ?? null);
  const totalRounds = Math.log2(size);
  const out: NewMatch[] = [];
  for (let r = 0; r < totalRounds; r++) {
    const count = size / 2 ** (r + 1);
    for (let i = 0; i < count; i++) {
      out.push({
        key: `K-${r}-${i}`,
        stage: stageName(totalRounds - r),
        round: r + 1,
        bracket_pos: i,
        home_team_id: r === 0 ? slots[i * 2] ?? null : null,
        away_team_id: r === 0 ? slots[i * 2 + 1] ?? null : null,
        next_key: r < totalRounds - 1 ? `K-${r + 1}-${Math.floor(i / 2)}` : null,
        next_slot: r < totalRounds - 1 ? (i % 2 === 0 ? "home" : "away") : null,
      });
    }
  }
  // resolve byes: advance lone teams directly
  for (const m of out.filter((x) => x.round === 1)) {
    const lone = m.home_team_id && !m.away_team_id ? m.home_team_id : !m.home_team_id && m.away_team_id ? m.away_team_id : null;
    if (lone || (!m.home_team_id && !m.away_team_id)) {
      m.status = "encerrado";
      const next = out.find((x) => x.key === m.next_key);
      if (next && lone) {
        if (m.next_slot === "home") next.home_team_id = lone;
        else next.away_team_id = lone;
      }
    }
  }
  if (thirdPlace && totalRounds >= 2) {
    out.push({ key: "K-3rd", stage: "terceiro", round: totalRounds, bracket_pos: 0, home_team_id: null, away_team_id: null });
  }
  // remove pure bye matches from visible list? keep them (status encerrado) only if they contain a team
  return out.filter((m) => !(m.round === 1 && m.status === "encerrado" && !m.home_team_id && !m.away_team_id));
}

export function shuffle<T>(a: T[]): T[] {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!; arr[i] = arr[j]!; arr[j] = tmp;
  }
  return arr;
}

/** Distribute seeded teams in groups using snake order. */
export function splitGroups(teamIds: string[], groups: number): Record<string, string[]> {
  const names = Array.from({ length: groups }, (_, i) => String.fromCharCode(65 + i));
  const res: Record<string, string[]> = Object.fromEntries(names.map((n) => [n, []]));
  teamIds.forEach((id, idx) => {
    const row = Math.floor(idx / groups);
    const col = idx % groups;
    const g = names[row % 2 === 0 ? col : groups - 1 - col]!;
    res[g]!.push(id);
  });
  return res;
}

/* ---------------- standings ---------------- */

export interface MatchLite {
  id: string;
  stage: string;
  group_name: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number;
  away_score: number;
  status: string;
}
export interface Row {
  team_id: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export function standings(teamIds: string[], matches: MatchLite[], s: Settings): Row[] {
  const rows = new Map<string, Row>(
    teamIds.map((id) => [id, { team_id: id, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0 }]),
  );
  const done = matches.filter(
    (m) => (m.status === "encerrado" || m.status === "wo") && m.home_team_id && m.away_team_id && rows.has(m.home_team_id) && rows.has(m.away_team_id),
  );
  for (const m of done) {
    const h = rows.get(m.home_team_id!)!;
    const a = rows.get(m.away_team_id!)!;
    h.played++;
    a.played++;
    h.gf += m.home_score;
    h.ga += m.away_score;
    a.gf += m.away_score;
    a.ga += m.home_score;
    if (m.home_score > m.away_score) {
      h.wins++; a.losses++; h.points += s.win; a.points += s.loss;
    } else if (m.home_score < m.away_score) {
      a.wins++; h.losses++; a.points += s.win; h.points += s.loss;
    } else {
      h.draws++; a.draws++; h.points += s.draw; a.points += s.draw;
    }
  }
  const list = [...rows.values()].map((r) => ({ ...r, gd: r.gf - r.ga }));
  const h2h = (x: Row, y: Row) => {
    let px = 0, py = 0;
    for (const m of done) {
      if (m.home_team_id === x.team_id && m.away_team_id === y.team_id) { px += m.home_score; py += m.away_score; }
      if (m.home_team_id === y.team_id && m.away_team_id === x.team_id) { py += m.home_score; px += m.away_score; }
    }
    return py - px;
  };
  list.sort((x, y) => {
    for (const tb of s.tiebreakers) {
      let d = 0;
      if (tb === "pontos") d = y.points - x.points;
      else if (tb === "vitorias") d = y.wins - x.wins;
      else if (tb === "saldo") d = y.gd - x.gd;
      else if (tb === "gols_pro") d = y.gf - x.gf;
      else if (tb === "confronto") d = h2h(x, y);
      else if (tb === "sorteio") d = x.team_id.localeCompare(y.team_id);
      if (d !== 0) return d;
    }
    return 0;
  });
  return list;
}

/* ---------------- suspensions ---------------- */
export interface EventLite {
  match_id: string;
  player_id: string | null;
  event_type_id: string;
}
/** Returns set of player ids suspended for the given upcoming match. */
export function suspendedPlayers(
  events: EventLite[],
  typeKeyById: Map<string, string>,
  matchesInOrder: { id: string; status: string }[],
  forMatchId: string,
  s: Settings,
): Set<string> {
  const idx = matchesInOrder.findIndex((m) => m.id === forMatchId);
  const prior = matchesInOrder.slice(0, idx < 0 ? matchesInOrder.length : idx);
  const priorIds = new Set(prior.map((m) => m.id));
  const counts = new Map<string, { y: number; r: number; lastMatchCard: string | null }>();
  for (const m of prior) {
    for (const e of events.filter((e) => e.match_id === m.id && e.player_id)) {
      const k = typeKeyById.get(e.event_type_id);
      if (k !== "amarelo" && k !== "vermelho") continue;
      const c = counts.get(e.player_id!) ?? { y: 0, r: 0, lastMatchCard: null };
      if (k === "amarelo") c.y++;
      else c.r++;
      c.lastMatchCard = m.id;
      counts.set(e.player_id!, c);
    }
  }
  const lastPrior = prior[prior.length - 1]?.id ?? null;
  const out = new Set<string>();
  counts.forEach((c, pid) => {
    if (!priorIds.has(c.lastMatchCard ?? "")) return;
    const yellowHit = s.suspensionYellows > 0 && c.y > 0 && c.y % s.suspensionYellows === 0;
    const redHit = s.suspensionReds > 0 && c.r >= s.suspensionReds;
    if ((yellowHit || redHit) && c.lastMatchCard === lastPrior) out.add(pid);
  });
  return out;
}

/* ---------------- double elimination ---------------- */

export interface DoubleElimMatch extends NewMatch {
  /** Where the loser of this match goes (winners bracket only). */
  loser_key?: string | null;
  loser_slot?: "home" | "away" | null;
}

/**
 * Double elimination for a power-of-two number of teams (4, 8, 16, 32...).
 * Winners bracket (stage "vencedores"), losers bracket ("perdedores") and a
 * single grand final ("grande_final"). Teams in seed order, best first.
 */
export function doubleElimination(teamIds: string[]): DoubleElimMatch[] {
  const n = teamIds.length;
  if (n < 4 || (n & (n - 1)) !== 0) return [];
  const k = Math.log2(n);
  const order = seedOrder(n);
  const slots = order.map((s) => teamIds[s - 1] ?? null);
  const out: DoubleElimMatch[] = [];
  const W = (r: number, i: number) => `W-${r}-${i}`;
  const L = (r: number, i: number) => `L-${r}-${i}`;

  // winners bracket
  for (let r = 1; r <= k; r++) {
    const count = n / 2 ** r;
    for (let i = 0; i < count; i++) {
      out.push({
        key: W(r, i),
        stage: "vencedores",
        round: r,
        bracket_pos: i,
        home_team_id: r === 1 ? slots[i * 2]! : null,
        away_team_id: r === 1 ? slots[i * 2 + 1]! : null,
        next_key: r < k ? W(r + 1, Math.floor(i / 2)) : "GF",
        next_slot: r < k ? (i % 2 === 0 ? "home" : "away") : "home",
      });
    }
  }

  // losers bracket: 2(k-1) rounds
  const lRounds = 2 * (k - 1);
  for (let lr = 1; lr <= lRounds; lr++) {
    const count = n / 2 ** (Math.floor((lr + 1) / 2) + 1);
    for (let i = 0; i < count; i++) {
      const last = lr === lRounds;
      let next_key: string;
      let next_slot: "home" | "away";
      if (last) {
        next_key = "GF";
        next_slot = "away";
      } else if (lr % 2 === 1) {
        // odd round feeds the even round 1:1 (meets a loser dropping from winners)
        next_key = L(lr + 1, i);
        next_slot = "home";
      } else {
        next_key = L(lr + 1, Math.floor(i / 2));
        next_slot = i % 2 === 0 ? "home" : "away";
      }
      out.push({
        key: L(lr, i),
        stage: "perdedores",
        round: lr,
        bracket_pos: i,
        home_team_id: null,
        away_team_id: null,
        next_key,
        next_slot,
      });
    }
  }

  // losers drop-down routing
  for (const m of out.filter((x) => x.stage === "vencedores")) {
    const r = m.round;
    const i = m.bracket_pos ?? 0;
    if (r === 1) {
      m.loser_key = L(1, Math.floor(i / 2));
      m.loser_slot = i % 2 === 0 ? "home" : "away";
    } else {
      // reverse order on alternate rounds to avoid early rematches
      const count = n / 2 ** r;
      const j = r % 2 === 0 ? count - 1 - i : i;
      m.loser_key = L(2 * (r - 1), j);
      m.loser_slot = "away";
    }
  }

  out.push({
    key: "GF",
    stage: "grande_final",
    round: 1,
    bracket_pos: 0,
    home_team_id: null,
    away_team_id: null,
    next_key: null,
    next_slot: null,
  });
  return out;
}

/** Qualified teams from group standings, as knockout seeds: all 1st places, then 2nd places... */
export function groupQualifiers(
  groups: Record<string, string[]>,
  matches: MatchLite[],
  s: Settings,
): string[] {
  const names = Object.keys(groups).sort();
  const tables = names.map((g) =>
    standings(groups[g] ?? [], matches.filter((m) => m.stage === "grupo" && m.group_name === g), s).map((r) => r.team_id),
  );
  const out: string[] = [];
  for (let pos = 0; pos < s.qualifiersPerGroup; pos++) {
    // alternate group order on each line so 1A meets 2B, 1B meets 2A
    const line = tables.map((t) => t[pos]).filter(Boolean) as string[];
    out.push(...line);
  }
  return out;
}

/* ---------------- volleyball scoring ---------------- */

export interface SetScore {
  h: number;
  a: number;
}
export interface VolleyRules {
  bestOf: number;
  setPoints: number;
  tieBreakPoints: number;
  winBy2: boolean;
}
export interface VolleyState {
  /** Finished sets followed by the set being played (when the match isn't decided). */
  sets: SetScore[];
  setsHome: number;
  setsAway: number;
  /** 1-based number of the set being played (or the last one, once decided). */
  currentSet: number;
  /** "home" | "away" when one team already won enough sets. */
  winner: "home" | "away" | null;
  setsToWin: number;
}

export const setsToWin = (bestOf: number) => Math.floor(Math.max(1, bestOf) / 2) + 1;

/** Points needed to close set number n (1-based). */
export function targetFor(n: number, r: VolleyRules) {
  return n === Math.max(1, r.bestOf) && r.bestOf > 1 ? r.tieBreakPoints : r.setPoints;
}

export function setIsOver(s: SetScore, target: number, winBy2: boolean) {
  const top = Math.max(s.h, s.a);
  return top >= target && (!winBy2 || Math.abs(s.h - s.a) >= 2);
}

/**
 * Replays rally points ("home" or "away", in order) into sets.
 * Points after the match is decided are ignored.
 */
export function volleyState(points: ("home" | "away")[], r: VolleyRules): VolleyState {
  const need = setsToWin(r.bestOf);
  const sets: SetScore[] = [{ h: 0, a: 0 }];
  let sh = 0;
  let sa = 0;
  let winner: VolleyState["winner"] = null;
  for (const p of points) {
    if (winner) break;
    const cur = sets[sets.length - 1]!;
    if (p === "home") cur.h++;
    else cur.a++;
    if (setIsOver(cur, targetFor(sets.length, r), r.winBy2)) {
      if (cur.h > cur.a) sh++;
      else sa++;
      if (sh >= need) winner = "home";
      else if (sa >= need) winner = "away";
      else sets.push({ h: 0, a: 0 });
    }
  }
  return { sets, setsHome: sh, setsAway: sa, currentSet: sets.length, winner, setsToWin: need };
}

/** Readable partials: "25-20, 18-25, 15-12". Skips an empty set not yet started. */
export function setsText(sets: unknown, sep = ", ") {
  const list = Array.isArray(sets) ? (sets as SetScore[]) : [];
  return list
    .filter((s, i) => i < list.length - 1 || s.h + s.a > 0)
    .map((s) => `${s.h}-${s.a}`)
    .join(sep);
}

export function readSets(sets: unknown): SetScore[] {
  return Array.isArray(sets) ? (sets as SetScore[]).filter((s) => s && typeof s.h === "number" && typeof s.a === "number") : [];
}

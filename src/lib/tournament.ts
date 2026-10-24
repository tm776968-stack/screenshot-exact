export type Sport =
  | "futebol"
  | "futsal"
  | "society"
  | "volei"
  | "basquete"
  | "beach_tennis"
  | "esports"
  | "outra";

export const SPORTS: { value: Sport; label: string }[] = [
  { value: "futebol", label: "Futebol" },
  { value: "futsal", label: "Futsal" },
  { value: "society", label: "Society" },
  { value: "volei", label: "Vôlei" },
  { value: "basquete", label: "Basquete" },
  { value: "beach_tennis", label: "Beach Tennis" },
  { value: "esports", label: "E-sports" },
  { value: "outra", label: "Outra" },
];

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
  saldo: "Saldo",
  gols_pro: "Gols pró",
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
};

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

const FOOT: EventPreset[] = [
  { key: "gol", name: "Gol", icon: "⚽", points: 1, score_target: "own" },
  { key: "gol_contra", name: "Gol contra", icon: "🥅", points: 1, score_target: "opponent" },
  { key: "assistencia", name: "Assistência", icon: "🅰️", points: 0, score_target: "own" },
  { key: "amarelo", name: "Cartão amarelo", icon: "🟨", points: 0, score_target: "own" },
  { key: "vermelho", name: "Cartão vermelho", icon: "🟥", points: 0, score_target: "own" },
  { key: "finalizacao", name: "Finalização", icon: "🎯", points: 0, score_target: "own" },
  { key: "falta", name: "Falta", icon: "✋", points: 0, score_target: "own" },
  { key: "defesa", name: "Defesa do goleiro", icon: "🧤", points: 0, score_target: "own" },
  { key: "substituicao", name: "Substituição", icon: "🔁", points: 0, score_target: "own" },
];

export function eventPresets(sport: string): EventPreset[] {
  if (sport === "volei" || sport === "beach_tennis")
    return [
      { key: "ataque", name: "Ponto de ataque", icon: "💥", points: 1, score_target: "own" },
      { key: "bloqueio", name: "Bloqueio", icon: "🧱", points: 1, score_target: "own" },
      { key: "ace", name: "Ace", icon: "🎯", points: 1, score_target: "own" },
      { key: "erro", name: "Erro", icon: "❌", points: 1, score_target: "opponent" },
    ];
  if (sport === "basquete")
    return [
      { key: "cesta1", name: "Cesta de 1", icon: "1️⃣", points: 1, score_target: "own" },
      { key: "cesta2", name: "Cesta de 2", icon: "2️⃣", points: 2, score_target: "own" },
      { key: "cesta3", name: "Cesta de 3", icon: "3️⃣", points: 3, score_target: "own" },
      { key: "rebote", name: "Rebote", icon: "🏀", points: 0, score_target: "own" },
      { key: "assistencia", name: "Assistência", icon: "🅰️", points: 0, score_target: "own" },
      { key: "falta", name: "Falta", icon: "✋", points: 0, score_target: "own" },
    ];
  if (sport === "esports")
    return [{ key: "ponto", name: "Ponto", icon: "🎮", points: 1, score_target: "own" }];
  return FOOT;
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
        home_team_id: r === 0 ? slots[i * 2] : null,
        away_team_id: r === 0 ? slots[i * 2 + 1] : null,
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
    [arr[i], arr[j]] = [arr[j], arr[i]];
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
    const g = names[row % 2 === 0 ? col : groups - 1 - col];
    res[g].push(id);
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

import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { ChevronLeft, Maximize, Minimize } from "lucide-react";
import { PageLoading } from "@/components/app-header";
import { isLive, liveNow, results, upcoming } from "@/components/public-view";
import { Countdown, currentSetPoints, LiveBadge, SetsLine, TeamCrest } from "@/components/sport";
import { Empty } from "@/components/views";
import { bundleById, bundleBySlug, teamMap, useTournamentsRealtime, type Bundle, type Match } from "@/lib/data";
import { themeVars } from "@/lib/images";
import { publicUrl } from "@/lib/manage";
import { divisionLabel, fmtDateTime, readSettings, STAGE_LABEL, standings } from "@/lib/tournament";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tv/$slug")({
  head: () => ({ meta: [{ title: "Modo TV — Placar Pro" }] }),
  component: TvPage,
});

const ROTATE_MS = 12000;

function TvPage() {
  const { slug } = Route.useParams();
  const q = useQuery(bundleBySlug(slug));
  const base = q.data;
  // Every category of the main tournament (or the tournament itself when it has none).
  const ids = base ? (base.divisions.length ? base.divisions.map((d) => d.id) : [base.tournament.id]) : [];
  const qs = useQueries({ queries: ids.map((id) => ({ ...bundleById(id), enabled: !!base })) });
  useTournamentsRealtime(ids);
  if (q.isLoading || qs.some((x) => x.isLoading)) return <PageLoading />;
  if (!base)
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Empty>Torneio não encontrado ou ainda não publicado.</Empty>
      </main>
    );
  const list = qs.map((x) => x.data).filter(Boolean) as Bundle[];
  return <Tv root={base} list={list} />;
}

type Slide = { key: string; kind: "placar" | "proximos" | "classificacao"; b?: Bundle };

/** A match together with the category it belongs to. */
type Item = { b: Bundle; m: Match };

function Tv({ root, list }: { root: Bundle; list: Bundle[] }) {
  const r = root.root;
  const many = list.length > 1;
  const slides: Slide[] = [
    { key: "placar", kind: "placar" },
    { key: "proximos", kind: "proximos" },
    ...list.filter((b) => b.matches.some((m) => m.stage === "liga" || m.stage === "grupo")).map((b) => ({ key: `tab-${b.tournament.id}`, kind: "classificacao" as const, b })),
  ];
  const [i, setI] = useState(0);
  const [full, setFull] = useState(false);
  const slide = slides[i % slides.length]!;
  const live: Item[] = list.flatMap((b) => liveNow(b).map((m) => ({ b, m })));
  const next: Item[] = list
    .flatMap((b) => upcoming(b).map((m) => ({ b, m })))
    .sort((x, y) => (x.m.scheduled_at ?? "9999").localeCompare(y.m.scheduled_at ?? "9999"));
  const last: Item[] = list
    .flatMap((b) => results(b).map((m) => ({ b, m })))
    .sort((x, y) => (y.m.scheduled_at ?? "").localeCompare(x.m.scheduled_at ?? ""));

  useEffect(() => {
    const t = setInterval(() => setI((x) => x + 1), ROTATE_MS);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background bg-pitch" style={themeVars(r.primary_color)}>
      <header className="flex items-center gap-4 px-8 py-5">
        {r.logo_url && <img src={r.logo_url} alt="" className="h-14 w-14 rounded-xl object-cover" />}
        <h1 className="min-w-0 flex-1 truncate text-5xl uppercase">{r.name}</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          {!full && (
            <Link to="/t/$slug" params={{ slug: r.slug }} className="rounded-lg p-2 hover:bg-secondary" aria-label="Voltar">
              <ChevronLeft className="h-6 w-6" />
            </Link>
          )}
          <button
            className="rounded-lg p-2 hover:bg-secondary"
            aria-label="Tela cheia"
            onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}
          >
            {full ? <Minimize className="h-6 w-6" /> : <Maximize className="h-6 w-6" />}
          </button>
        </div>
      </header>

      <main key={slide.key} className="min-h-0 flex-1 px-8 animate-in fade-in duration-700">
        {slide.kind === "placar" && <LiveSlide live={live} next={next[0]} last={last[0]} many={many} />}
        {slide.kind === "proximos" && <NextSlide list={next.slice(0, 6)} many={many} />}
        {slide.kind === "classificacao" && slide.b && <TableSlide b={slide.b} many={many} />}
      </main>

      <footer className="flex items-center gap-4 px-8 py-4">
        <div className="flex flex-1 gap-2">
          {slides.map((x, j) => (
            <span key={x.key} className={cn("h-1.5 flex-1 rounded-full", j === i % slides.length ? "bg-primary" : "bg-secondary")} />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-right text-sm text-muted-foreground">
            Acompanhe
            <br />
            pelo celular
          </span>
          <div className="rounded-lg bg-white p-1.5">
            <QRCodeSVG value={publicUrl(r.slug)} size={72} />
          </div>
        </div>
      </footer>
    </div>
  );
}

/** "Sub-17 · Feminino" in front of the round name when the tournament has several categories. */
function matchCaption({ b, m }: Item, many: boolean) {
  const round = m.stage === "grupo" ? `Grupo ${m.group_name}` : m.stage === "liga" ? `Rodada ${m.round}` : STAGE_LABEL[m.stage];
  return many && b.tournament.parent_id ? `${divisionLabel(b.tournament)} · ${round}` : round;
}

function SlideTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-6 flex items-center gap-3 text-4xl uppercase text-muted-foreground">{children}</h2>;
}

function BigMatch({ b, m, many }: { b: Bundle; m: Match; many: boolean }) {
  const teams = teamMap(b.teams);
  const pts = currentSetPoints(m);
  const h = m.home_team_id ? teams.get(m.home_team_id) : null;
  const a = m.away_team_id ? teams.get(m.away_team_id) : null;
  const live = isLive(m);
  const venue = b.venues.find((v) => v.id === m.venue_id);
  return (
    <div className={cn("rounded-3xl border bg-card/80 p-6", live && "border-live/50")}>
      <div className="mb-4 flex items-center justify-between text-xl text-muted-foreground">
        <span>{matchCaption({ b, m }, many)}</span>
        {venue && <span>{venue.name}</span>}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
        <div className="flex min-w-0 flex-col items-center gap-3 text-center">
          <TeamCrest team={h} size={96} />
          <span className="w-full truncate text-3xl font-bold">{h?.name ?? "A definir"}</span>
        </div>
        <div className="text-center">
          <div className="scoreboard text-[9rem] leading-none">
            {pts?.[0] ?? 0}
            <span className="mx-3 text-muted-foreground">:</span>
            {pts?.[1] ?? 0}
          </div>
          <div className="mt-2 flex items-center justify-center gap-3 text-3xl">
            <LiveBadge className="text-base" />
            <span className="scoreboard">
              {m.period}º set · sets {m.home_score}-{m.away_score}
            </span>
          </div>
          <div className="mt-2 flex justify-center">
            <SetsLine match={m} className="text-xl" />
          </div>
        </div>
        <div className="flex min-w-0 flex-col items-center gap-3 text-center">
          <TeamCrest team={a} size={96} />
          <span className="w-full truncate text-3xl font-bold">{a?.name ?? "A definir"}</span>
        </div>
      </div>
    </div>
  );
}

function LiveSlide({ live, next, last, many }: { live: Item[]; next: Item | undefined; last: Item | undefined; many: boolean }) {
  if (!live.length) {
    return (
      <div className="flex h-full flex-col justify-center">
        <SlideTitle>{next ? "Próximo jogo" : "Último resultado"}</SlideTitle>
        {next ? <NextRow b={next.b} m={next.m} many={many} big /> : last ? <ResultRow b={last.b} m={last.m} /> : <Empty>Nenhum jogo ainda.</Empty>}
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <SlideTitle>
        Ao vivo agora <LiveBadge className="text-base" />
      </SlideTitle>
      <div className={cn("grid flex-1 content-start gap-6", live.length > 1 && "lg:grid-cols-2")}>
        {live.slice(0, 4).map(({ b, m }) => (
          <BigMatch key={m.id} b={b} m={m} many={many} />
        ))}
      </div>
    </div>
  );
}

function NextRow({ b, m, big, many }: { b: Bundle; m: Match; big?: boolean; many: boolean }) {
  const teams = teamMap(b.teams);
  const h = m.home_team_id ? teams.get(m.home_team_id) : null;
  const a = m.away_team_id ? teams.get(m.away_team_id) : null;
  const venue = b.venues.find((v) => v.id === m.venue_id);
  return (
    <div className={cn("grid grid-cols-[1fr_auto_1fr_14rem] items-center gap-4 rounded-2xl border bg-card/80 px-6", big ? "py-8 text-4xl" : "py-4 text-2xl")}>
      <span className="flex min-w-0 items-center justify-end gap-3 font-bold">
        <span className="truncate">{h?.name ?? "A definir"}</span> <TeamCrest team={h} size={big ? 72 : 44} />
      </span>
      <span className="font-display text-muted-foreground">x</span>
      <span className="flex min-w-0 items-center gap-3 font-bold">
        <TeamCrest team={a} size={big ? 72 : 44} /> <span className="truncate">{a?.name ?? "A definir"}</span>
      </span>
      <span className="text-right text-lg text-muted-foreground">
        {many && b.tournament.parent_id && <span className="block font-semibold text-foreground">{divisionLabel(b.tournament)}</span>}
        {fmtDateTime(m.scheduled_at)}
        {venue && <span className="block">{venue.name}</span>}
        {m.scheduled_at && new Date(m.scheduled_at).getTime() > Date.now() && (
          <span className="block text-primary">
            <Countdown to={m.scheduled_at} />
          </span>
        )}
      </span>
    </div>
  );
}

function ResultRow({ b, m }: { b: Bundle; m: Match }) {
  const teams = teamMap(b.teams);
  const h = m.home_team_id ? teams.get(m.home_team_id) : null;
  const a = m.away_team_id ? teams.get(m.away_team_id) : null;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 rounded-2xl border bg-card/80 px-6 py-8 text-4xl">
      <span className="flex min-w-0 items-center justify-end gap-3 font-bold">
        <span className="truncate">{h?.name}</span> <TeamCrest team={h} size={72} />
      </span>
      <span className="scoreboard text-7xl">
        {m.home_score}:{m.away_score}
      </span>
      <span className="flex min-w-0 items-center gap-3 font-bold">
        <TeamCrest team={a} size={72} /> <span className="truncate">{a?.name}</span>
      </span>
    </div>
  );
}

function NextSlide({ list, many }: { list: Item[]; many: boolean }) {
  return (
    <div className="flex h-full flex-col">
      <SlideTitle>Próximos jogos</SlideTitle>
      {list.length === 0 && <Empty>Nenhum jogo agendado.</Empty>}
      <div className="space-y-3">
        {list.map(({ b, m }) => (
          <NextRow key={m.id} b={b} m={m} many={many} />
        ))}
      </div>
    </div>
  );
}

function TableSlide({ b, many }: { b: Bundle; many: boolean }) {
  const s = readSettings(b.tournament.settings);
  const teams = teamMap(b.teams);
  const ms = b.matches.filter((m) => m.stage === "liga" || m.stage === "grupo");
  const groups = [...new Set(ms.map((m) => m.group_name ?? ""))].sort();
  const qualifiers = b.tournament.format === "grupos_mata_mata" ? s.qualifiersPerGroup : 0;
  return (
    <div className="flex h-full flex-col">
      <SlideTitle>Classificação{many && b.tournament.parent_id ? ` · ${divisionLabel(b.tournament)}` : ""}</SlideTitle>
      <div className={cn("grid content-start gap-6", groups.length > 1 && "lg:grid-cols-2")}>
        {groups.slice(0, 4).map((g) => {
          const gm = ms.filter((m) => (m.group_name ?? "") === g);
          const ids = [...new Set(gm.flatMap((m) => [m.home_team_id, m.away_team_id]).filter(Boolean) as string[])];
          const rows = standings(ids, gm, s).slice(0, groups.length > 1 ? 6 : 10);
          return (
            <div key={g} className="overflow-hidden rounded-2xl border bg-card/80">
              {g && <div className="border-b px-5 py-2 font-display text-2xl">Grupo {g}</div>}
              <table className="w-full text-xl">
                <thead className="text-sm text-muted-foreground">
                  <tr className="[&>th]:px-3 [&>th]:py-2">
                    <th className="w-10 text-left">#</th>
                    <th className="text-left">Equipe</th>
                    <th>P</th>
                    <th>J</th>
                    <th>V</th>
                    <th>SS</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={r.team_id} className={cn("border-t text-center [&>td]:px-3 [&>td]:py-2", idx < qualifiers && "bg-primary/10")}>
                      <td className={cn("text-left font-display", idx < qualifiers && "text-primary")}>{idx + 1}</td>
                      <td className="text-left">
                        <span className="flex items-center gap-3">
                          <TeamCrest team={teams.get(r.team_id)} size={32} />
                          <span className="truncate font-semibold">{teams.get(r.team_id)?.name}</span>
                        </span>
                      </td>
                      <td className="scoreboard text-2xl">{r.points}</td>
                      <td>{r.played}</td>
                      <td>{r.wins}</td>
                      <td>{r.gd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}

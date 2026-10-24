import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { ChevronLeft, Maximize, Minimize } from "lucide-react";
import { PageLoading } from "@/components/app-header";
import { isLive, liveNow, results, upcoming } from "@/components/public-view";
import { Countdown, LiveBadge, MatchClock, TeamCrest } from "@/components/sport";
import { Empty } from "@/components/views";
import { bundleBySlug, teamMap, useTournamentRealtime, type Bundle, type Match } from "@/lib/data";
import { themeVars } from "@/lib/images";
import { publicUrl } from "@/lib/manage";
import { fmtDateTime, readSettings, STAGE_LABEL, standings } from "@/lib/tournament";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tv/$slug")({
  head: () => ({ meta: [{ title: "Modo TV — Placar Pro" }] }),
  component: TvPage,
});

const ROTATE_MS = 12000;

function TvPage() {
  const { slug } = Route.useParams();
  const q = useQuery(bundleBySlug(slug));
  useTournamentRealtime(q.data?.tournament.id);
  if (q.isLoading) return <PageLoading />;
  if (!q.data)
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Empty>Torneio não encontrado ou ainda não publicado.</Empty>
      </main>
    );
  return <Tv b={q.data} />;
}

type Slide = "placar" | "proximos" | "classificacao";

function Tv({ b }: { b: Bundle }) {
  const hasTable = b.matches.some((m) => m.stage === "liga" || m.stage === "grupo");
  const slides: Slide[] = ["placar", "proximos", ...(hasTable ? (["classificacao"] as Slide[]) : [])];
  const [i, setI] = useState(0);
  const [full, setFull] = useState(false);
  const slide = slides[i % slides.length]!;

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
    <div className="flex h-screen flex-col overflow-hidden bg-background bg-pitch" style={themeVars(b.tournament.primary_color)}>
      <header className="flex items-center gap-4 px-8 py-5">
        {b.tournament.logo_url && <img src={b.tournament.logo_url} alt="" className="h-14 w-14 rounded-xl object-cover" />}
        <h1 className="min-w-0 flex-1 truncate text-5xl uppercase">{b.tournament.name}</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
          {!full && (
            <Link to="/t/$slug" params={{ slug: b.tournament.slug }} className="rounded-lg p-2 hover:bg-secondary" aria-label="Voltar">
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

      <main key={slide} className="min-h-0 flex-1 px-8 animate-in fade-in duration-700">
        {slide === "placar" && <LiveSlide b={b} />}
        {slide === "proximos" && <NextSlide b={b} />}
        {slide === "classificacao" && <TableSlide b={b} />}
      </main>

      <footer className="flex items-center gap-4 px-8 py-4">
        <div className="flex flex-1 gap-2">
          {slides.map((s, j) => (
            <span key={s} className={cn("h-1.5 flex-1 rounded-full", j === i % slides.length ? "bg-primary" : "bg-secondary")} />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-right text-sm text-muted-foreground">
            Acompanhe
            <br />
            pelo celular
          </span>
          <div className="rounded-lg bg-white p-1.5">
            <QRCodeSVG value={publicUrl(b.tournament.slug)} size={72} />
          </div>
        </div>
      </footer>
    </div>
  );
}

function SlideTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-6 flex items-center gap-3 text-4xl uppercase text-muted-foreground">{children}</h2>;
}

function BigMatch({ b, m }: { b: Bundle; m: Match }) {
  const teams = teamMap(b.teams);
  const h = m.home_team_id ? teams.get(m.home_team_id) : null;
  const a = m.away_team_id ? teams.get(m.away_team_id) : null;
  const live = isLive(m);
  const venue = b.venues.find((v) => v.id === m.venue_id);
  return (
    <div className={cn("rounded-3xl border bg-card/80 p-6", live && "border-live/50")}>
      <div className="mb-4 flex items-center justify-between text-xl text-muted-foreground">
        <span>{m.stage === "grupo" ? `Grupo ${m.group_name}` : m.stage === "liga" ? `Rodada ${m.round}` : STAGE_LABEL[m.stage]}</span>
        {venue && <span>{venue.name}</span>}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
        <div className="flex min-w-0 flex-col items-center gap-3 text-center">
          <TeamCrest team={h} size={96} />
          <span className="w-full truncate text-3xl font-bold">{h?.name ?? "A definir"}</span>
        </div>
        <div className="text-center">
          <div className="scoreboard text-[9rem]">
            {m.home_score}
            <span className="mx-3 text-muted-foreground">:</span>
            {m.away_score}
          </div>
          <div className="mt-2 flex items-center justify-center gap-3 text-3xl">
            <LiveBadge className="text-base" />
            <span className="scoreboard">{m.status === "intervalo" ? "Intervalo" : <MatchClock match={m} />}</span>
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

function LiveSlide({ b }: { b: Bundle }) {
  const live = liveNow(b);
  if (!live.length) {
    const next = upcoming(b)[0];
    const last = results(b)[0];
    return (
      <div className="flex h-full flex-col justify-center">
        <SlideTitle>{next ? "Próximo jogo" : "Último resultado"}</SlideTitle>
        {next ? <NextRow b={b} m={next} big /> : last ? <ResultRow b={b} m={last} /> : <Empty>Nenhum jogo ainda.</Empty>}
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <SlideTitle>
        Ao vivo agora <LiveBadge className="text-base" />
      </SlideTitle>
      <div className={cn("grid flex-1 content-start gap-6", live.length > 1 && "lg:grid-cols-2")}>
        {live.slice(0, 4).map((m) => (
          <BigMatch key={m.id} b={b} m={m} />
        ))}
      </div>
    </div>
  );
}

function NextRow({ b, m, big }: { b: Bundle; m: Match; big?: boolean }) {
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

function NextSlide({ b }: { b: Bundle }) {
  const list = upcoming(b).slice(0, 6);
  return (
    <div className="flex h-full flex-col">
      <SlideTitle>Próximos jogos</SlideTitle>
      {list.length === 0 && <Empty>Nenhum jogo agendado.</Empty>}
      <div className="space-y-3">
        {list.map((m) => (
          <NextRow key={m.id} b={b} m={m} />
        ))}
      </div>
    </div>
  );
}

function TableSlide({ b }: { b: Bundle }) {
  const s = readSettings(b.tournament.settings);
  const teams = teamMap(b.teams);
  const ms = b.matches.filter((m) => m.stage === "liga" || m.stage === "grupo");
  const groups = [...new Set(ms.map((m) => m.group_name ?? ""))].sort();
  const qualifiers = b.tournament.format === "grupos_mata_mata" ? s.qualifiersPerGroup : 0;
  return (
    <div className="flex h-full flex-col">
      <SlideTitle>Classificação</SlideTitle>
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
                    <th>SG</th>
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

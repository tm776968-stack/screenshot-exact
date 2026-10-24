import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Plus, Settings2, Tv, Users } from "lucide-react";
import { toast } from "sonner";
import { AppHeader, PageLoading } from "@/components/app-header";
import { Empty } from "@/components/views";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/lib/auth";
import type { Tournament } from "@/lib/data";
import { createTournament, errMsg } from "@/lib/manage";
import { FORMATS, fmtDate, SPORTS, STATUS_LABEL } from "@/lib/tournament";

export const Route = createFileRoute("/painel/")({
  head: () => ({ meta: [{ title: "Meus torneios — Placar Pro" }] }),
  component: Painel,
});

function useMyTournaments(userId: string | undefined, email: string | undefined) {
  return useQuery({
    queryKey: ["my-tournaments", userId],
    enabled: !!userId,
    queryFn: async () => {
      const own = await supabase.from("tournaments").select("*").eq("owner_id", userId!).order("created_at", { ascending: false });
      if (own.error) throw own.error;
      const mem = await supabase.from("tournament_members").select("tournament_id").ilike("email", email ?? "");
      const sharedIds = (mem.data ?? []).map((m) => m.tournament_id).filter((id) => !own.data.some((t) => t.id === id));
      let shared: Tournament[] = [];
      if (sharedIds.length) {
        const r = await supabase.from("tournaments").select("*").in("id", sharedIds);
        if (r.error) throw r.error;
        shared = r.data;
      }
      return { own: own.data, shared };
    },
  });
}

function Painel() {
  const { user, loading } = useRequireAuth();
  const q = useMyTournaments(user?.id, user?.email);
  const [open, setOpen] = useState(false);
  if (loading || !user) return <PageLoading />;
  const all = [...(q.data?.own ?? []), ...(q.data?.shared ?? [])];
  const live = all.filter((t) => t.status === "andamento").length;
  return (
    <div className="min-h-screen">
      <AppHeader email={user.email} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-4xl uppercase">Meus torneios</h1>
            <p className="text-sm text-muted-foreground">
              {all.length} torneio{all.length === 1 ? "" : "s"} · {live} em andamento
            </p>
          </div>
          <Button onClick={() => setOpen(true)} className="shadow-glow">
            <Plus /> Novo torneio
          </Button>
        </div>

        <div className="mt-6 space-y-3">
          {q.isLoading && <PageLoading />}
          {q.error && <Empty>Não foi possível carregar: {errMsg(q.error)}</Empty>}
          {q.data && all.length === 0 && (
            <Empty>
              Você ainda não criou nenhum torneio.
              <div className="mt-4">
                <Button onClick={() => setOpen(true)}>
                  <Plus /> Criar o primeiro
                </Button>
              </div>
            </Empty>
          )}
          {q.data?.own.map((t) => <TournamentRow key={t.id} t={t} />)}
          {!!q.data?.shared.length && (
            <>
              <h2 className="pt-4 text-xl uppercase text-muted-foreground">Como co-organizador</h2>
              {q.data.shared.map((t) => (
                <TournamentRow key={t.id} t={t} shared />
              ))}
            </>
          )}
        </div>
      </main>
      <NewTournamentDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function TournamentRow({ t, shared }: { t: Tournament; shared?: boolean }) {
  const sport = SPORTS.find((s) => s.value === t.sport)?.label ?? t.sport;
  const format = FORMATS.find((f) => f.value === t.format)?.label ?? t.format;
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
      <Link to="/painel/$id" params={{ id: t.id }} className="flex min-w-0 flex-1 items-center gap-3">
        {t.logo_url ? (
          <img src={t.logo_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
        ) : (
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary font-display text-lg"
            style={t.primary_color ? { background: t.primary_color } : undefined}
          >
            {t.name.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-display text-xl">{t.name}</span>
            <Badge variant={t.status === "andamento" ? "default" : "secondary"}>{STATUS_LABEL[t.status]}</Badge>
            {!t.published && <Badge variant="outline">Não publicado</Badge>}
            {shared && (
              <Badge variant="outline">
                <Users className="mr-1 h-3 w-3" /> Co-organizador
              </Badge>
            )}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {sport} · {format}
            {t.start_date && ` · ${fmtDate(t.start_date)}`}
            {t.location && ` · ${t.location}`}
          </div>
        </div>
      </Link>
      <div className="flex gap-2">
        <Button asChild size="sm" variant="secondary" className="flex-1 sm:flex-none">
          <Link to="/painel/$id" params={{ id: t.id }}>
            <Settings2 /> Gerenciar
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="flex-1 sm:flex-none">
          <Link to="/t/$slug" params={{ slug: t.slug }}>
            <ExternalLink /> Página
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" aria-label="Modo TV">
          <Link to="/tv/$slug" params={{ slug: t.slug }}>
            <Tv />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function NewTournamentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [name, setName] = useState("");
  const [sport, setSport] = useState("futebol");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">Novo torneio</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            setBusy(true);
            try {
              const t = await createTournament(name.trim(), sport);
              qc.invalidateQueries({ queryKey: ["my-tournaments"] });
              onOpenChange(false);
              navigate({ to: "/painel/$id", params: { id: t.id } });
            } catch (err) {
              toast.error(errMsg(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="tname">Nome do torneio</Label>
            <Input id="tname" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Copa da Vila 2026" />
          </div>
          <div className="space-y-1.5">
            <Label>Modalidade</Label>
            <Select value={sport} onValueChange={setSport}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={busy || !name.trim()}>
            {busy ? "Criando..." : "Criar e continuar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

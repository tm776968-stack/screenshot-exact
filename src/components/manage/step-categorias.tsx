import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FlaskConical, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Bundle, Tournament } from "@/lib/data";
import { createDivision, removeTestData, seedTestData, updateDivision, type DivisionInput } from "@/lib/manage";
import {
  CATEGORY_SUGGESTIONS,
  divisionLabel,
  NAIPES,
  readSettings,
  sportLabel,
  TEAM_SIZES,
  teamSizeLabel,
  volleyDefaults,
} from "@/lib/tournament";
import { cn } from "@/lib/utils";
import { Field, Section, useAction } from "./shared";

/** Teams and games per category, for the list. */
export function useDivisionCounts(ids: string[]) {
  return useQuery({
    queryKey: ["bundle", "division-counts", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const [teams, matches] = await Promise.all([
        supabase.from("teams").select("tournament_id").in("tournament_id", ids),
        supabase.from("matches").select("tournament_id, status, home_team_id, away_team_id").in("tournament_id", ids),
      ]);
      if (teams.error) throw teams.error;
      if (matches.error) throw matches.error;
      const out: Record<string, { teams: number; matches: number; done: number; live: number }> = {};
      for (const id of ids) out[id] = { teams: 0, matches: 0, done: 0, live: 0 };
      for (const t of teams.data) out[t.tournament_id]!.teams++;
      for (const m of matches.data) {
        if (!m.home_team_id || !m.away_team_id) continue;
        const c = out[m.tournament_id]!;
        c.matches++;
        if (m.status === "encerrado" || m.status === "wo") c.done++;
        if (m.status === "ao_vivo" || m.status === "intervalo") c.live++;
      }
      return out;
    },
  });
}

export function StepCategorias({ b }: { b: Bundle }) {
  const root = b.root;
  const [editing, setEditing] = useState<Tournament | "new" | null>(null);
  const counts = useDivisionCounts(b.divisions.map((d) => d.id));
  return (
    <div className="space-y-4">
      <Section
        title={`Categorias e naipes (${b.divisions.length})`}
        description={`Cada categoria tem equipes, formato, chave e jogos próprios. Modalidade: ${sportLabel(root.sport)}.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <TestDataButtons b={b} />
            <Button onClick={() => setEditing("new")}>
              <Plus /> Categoria
            </Button>
          </div>
        }
      >
        {b.divisions.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma categoria ainda. Crie a primeira, por exemplo “Adulto · Masculino” ou “Sub-17 · Feminino”.
            <div className="mt-3">
              <Button size="sm" onClick={() => setEditing("new")}>
                <Plus /> Criar categoria
              </Button>
            </div>
          </div>
        )}
        <div className="space-y-2">
          {b.divisions.map((d) => {
            const s = readSettings(d.settings);
            const c = counts.data?.[d.id];
            return (
              <div key={d.id} className="flex flex-col gap-3 rounded-xl border bg-background/40 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-xl uppercase">{divisionLabel(d)}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{teamSizeLabel(s.teamSize)}</span>
                    {!!c?.live && <span className="rounded-full bg-live/15 px-2 py-0.5 text-xs font-semibold text-live">{c.live} ao vivo</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Melhor de {s.bestOf} set{s.bestOf > 1 ? "s" : ""} · sets de {s.setPoints} pontos
                    {s.bestOf > 1 && ` · decisivo de ${s.tieBreakPoints}`}
                    {c && ` · ${c.teams} equipe${c.teams === 1 ? "" : "s"} · ${c.done}/${c.matches} jogos encerrados`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" aria-label={`Editar ${divisionLabel(d)}`} onClick={() => setEditing(d)}>
                    <Pencil />
                  </Button>
                  <Button asChild size="sm" variant="secondary" className="flex-1 sm:flex-none">
                    <Link to="/painel/$id" params={{ id: d.id }} search={{ etapa: "equipes" }}>
                      Gerenciar <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Section>
      {editing && <DivisionDialog b={b} div={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TestDataButtons({ b }: { b: Bundle }) {
  const { busy, run } = useAction();
  const [step, setStep] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  if (confirmRemove)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-2 py-1 text-sm">
        Apagar equipes “Teste” e os jogos dessas categorias?
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={async () => {
            await run(async () => {
              const n = await removeTestData(b.divisions);
              if (!n) throw new Error("Não há dados de teste para apagar.");
            }, "Dados de teste apagados.");
            setConfirmRemove(false);
          }}
        >
          Apagar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>
          Cancelar
        </Button>
      </div>
    );
  return (
    <>
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() =>
          run(async () => {
            const r = await seedTestData(b.root, b.divisions, setStep);
            setStep(null);
            if (!r.filled) throw new Error("Todas as categorias já têm equipes. Os dados de teste só entram em categorias vazias.");
          }, "Dados de teste criados: 4 equipes e jogos em cada categoria.")
        }
      >
        <FlaskConical /> {busy && step ? step : "Criar dados de teste"}
      </Button>
      {b.divisions.length > 0 && (
        <Button variant="ghost" disabled={busy} onClick={() => setConfirmRemove(true)}>
          Apagar testes
        </Button>
      )}
    </>
  );
}

function DivisionDialog({ b, div, onClose }: { b: Bundle; div: Tournament | null; onClose: () => void }) {
  const root = b.root;
  const cur = div ? readSettings(div.settings) : null;
  const base = volleyDefaults(root.sport);
  const [f, setF] = useState<DivisionInput>({
    category: div?.category ?? "",
    naipe: div?.naipe ?? "Masculino",
    teamSize: cur?.teamSize ?? base.teamSize,
    bestOf: cur?.bestOf ?? base.bestOf,
    setPoints: cur?.setPoints ?? base.setPoints,
    tieBreakPoints: cur?.tieBreakPoints ?? base.tieBreakPoints,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { busy, run } = useAction();
  const set = <K extends keyof DivisionInput>(k: K, v: DivisionInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const duplicate = b.divisions.some(
    (d) => d.id !== div?.id && (d.category ?? "").trim().toLowerCase() === f.category.trim().toLowerCase() && d.naipe === f.naipe,
  );

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">{div ? "Editar categoria" : "Nova categoria"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run(() => (div ? updateDivision(root, div, f) : createDivision(root, f)), div ? "Categoria salva." : "Categoria criada.");
            if (ok) onClose();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoria" hint="Escolha da lista ou digite (ex.: Sub-17, Adulto, Master 40+).">
              <Input list="categorias-sugestoes" required value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="Ex.: Adulto" />
              <datalist id="categorias-sugestoes">
                {CATEGORY_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Naipe">
              <div className="grid grid-cols-3 gap-1.5">
                {NAIPES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => set("naipe", n)}
                    className={cn("rounded-md border px-2 py-2 text-sm", f.naipe === n ? "border-primary bg-primary/10 text-primary" : "bg-background/40")}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          {duplicate && <p className="text-sm text-warning">Já existe uma categoria com esse nome e naipe.</p>}

          <Field label="Formato do time">
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {TEAM_SIZES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => set("teamSize", t.value)}
                  className={cn("rounded-md border px-2 py-2 text-left", f.teamSize === t.value ? "border-primary bg-primary/10" : "bg-background/40")}
                >
                  <span className="block font-display text-lg uppercase">{t.label}</span>
                  <span className="block text-xs text-muted-foreground">{t.value} em quadra</span>
                </button>
              ))}
            </div>
          </Field>

          <SetRulesFields value={f} onChange={(patch) => setF((x) => ({ ...x, ...patch }))} />

          {confirmDelete && div && (
            <div className="space-y-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
              <p>
                Excluir <b>{divisionLabel(div)}</b> com todas as equipes, jogos e súmulas? Isso não pode ser desfeito.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    const ok = await run(async () => {
                      const { error } = await supabase.from("tournaments").delete().eq("id", div.id);
                      if (error) throw error;
                    }, "Categoria excluída.");
                    if (ok) onClose();
                  }}
                >
                  Excluir categoria
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            {div && !confirmDelete && (
              <Button type="button" variant="destructive" disabled={busy} aria-label="Excluir categoria" onClick={() => setConfirmDelete(true)}>
                <Trash2 />
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={busy || !f.category.trim() || duplicate}>
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Sets per match and points per set. Shared with the Formato e regras step. */
export function SetRulesFields({
  value,
  onChange,
}: {
  value: { bestOf: number; setPoints: number; tieBreakPoints: number };
  onChange: (patch: { bestOf?: number; setPoints?: number; tieBreakPoints?: number }) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Sets por jogo">
        <Select value={String(value.bestOf)} onValueChange={(v) => onChange({ bestOf: Number(v) })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 set</SelectItem>
            <SelectItem value="3">Melhor de 3 (vence quem fizer 2)</SelectItem>
            <SelectItem value="5">Melhor de 5 (vence quem fizer 3)</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Pontos por set">
        <Input type="number" min={5} max={99} required value={value.setPoints} onChange={(e) => onChange({ setPoints: Math.max(1, Number(e.target.value) || 1) })} />
      </Field>
      <Field label="Pontos do set decisivo" {...(value.bestOf === 1 ? { hint: "Não se aplica a jogo de 1 set." } : {})}>
        <Input
          type="number"
          min={5}
          max={99}
          required
          disabled={value.bestOf === 1}
          value={value.tieBreakPoints}
          onChange={(e) => onChange({ tieBreakPoints: Math.max(1, Number(e.target.value) || 1) })}
        />
      </Field>
    </div>
  );
}

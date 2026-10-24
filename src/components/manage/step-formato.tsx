import { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import type { Bundle, EventType } from "@/lib/data";
import { readExt, resetEventTypes, saveSettings, type ExtSettings } from "@/lib/manage";
import { eventPresets, FORMATS, SPORTS, TIEBREAKER_LABEL, type Tiebreaker } from "@/lib/tournament";
import { cn } from "@/lib/utils";
import { Field, moveItem, Section, useAction, useDragList } from "./shared";

const FORMAT_HELP: Record<string, string> = {
  mata_mata: "Quem perde está fora. Pode ter disputa de 3º lugar.",
  pontos_corridos: "Todos jogam contra todos. Vence quem somar mais pontos.",
  grupos_mata_mata: "Fase de grupos e os melhores de cada grupo vão para o mata-mata.",
  dupla_eliminacao: "Chave dos vencedores e dos perdedores. É eliminado quem perde duas vezes.",
};

export function StepFormato({ b }: { b: Bundle }) {
  const t = b.tournament;
  const [format, setFormat] = useState(t.format);
  const [s, setS] = useState<ExtSettings>(() => readExt(t.settings));
  const { busy, run } = useAction();
  const set = <K extends keyof ExtSettings>(k: K, v: ExtSettings[K]) => setS((cur) => ({ ...cur, [k]: v }));
  const tb = useDragList<Tiebreaker>(s.tiebreakers, (v) => set("tiebreakers", v));
  const knockoutish = format === "mata_mata" || format === "grupos_mata_mata" || format === "dupla_eliminacao";
  const leagueish = format === "pontos_corridos" || format === "grupos_mata_mata";
  const hasMatches = b.matches.length > 0;

  return (
    <div className="space-y-4">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const { error } = await supabase.from("tournaments").update({ format }).eq("id", t.id);
            if (error) throw error;
            await saveSettings({ ...t, format }, s);
          }, "Formato e regras salvos.");
        }}
      >
        <Section title="Formato" description={hasMatches ? "Se mudar o formato, gere a tabela de jogos de novo na etapa 5." : undefined}>
          <div className="grid gap-2 sm:grid-cols-2">
            {FORMATS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFormat(f.value)}
                className={cn(
                  "rounded-xl border p-4 text-left transition",
                  format === f.value ? "border-primary bg-primary/10 shadow-glow" : "bg-background/40 hover:border-primary/40",
                )}
              >
                <div className="font-display text-xl uppercase">{f.label}</div>
                <div className="text-sm text-muted-foreground">{FORMAT_HELP[f.value]}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {format === "grupos_mata_mata" && (
              <>
                <Field label="Número de grupos">
                  <Input type="number" min={2} max={16} value={s.groups} onChange={(e) => set("groups", Math.max(2, Number(e.target.value)))} />
                </Field>
                <Field label="Classificados por grupo">
                  <Input
                    type="number"
                    min={1}
                    max={8}
                    value={s.qualifiersPerGroup}
                    onChange={(e) => set("qualifiersPerGroup", Math.max(1, Number(e.target.value)))}
                  />
                </Field>
              </>
            )}
            {leagueish && (
              <Toggle label="Turno e returno" hint="Cada confronto acontece duas vezes, com mando invertido." checked={s.doubleRound} onChange={(v) => set("doubleRound", v)} />
            )}
            {(format === "mata_mata" || format === "grupos_mata_mata") && (
              <Toggle label="Disputa de 3º lugar" checked={s.thirdPlace} onChange={(v) => set("thirdPlace", v)} />
            )}
          </div>
        </Section>

        <Section title="Pontuação e empates">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Vitória">
              <Input type="number" value={s.win} onChange={(e) => set("win", Number(e.target.value))} />
            </Field>
            <Field label="Empate">
              <Input type="number" value={s.draw} onChange={(e) => set("draw", Number(e.target.value))} />
            </Field>
            <Field label="Derrota">
              <Input type="number" value={s.loss} onChange={(e) => set("loss", Number(e.target.value))} />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Toggle label="Permitir empate" hint="Se desligado, empates vão para os pênaltis." checked={s.allowDraw} onChange={(v) => set("allowDraw", v)} />
            {knockoutish && <Toggle label="Prorrogação no mata-mata" checked={s.extraTime} onChange={(v) => set("extraTime", v)} />}
            {knockoutish && <Toggle label="Pênaltis no mata-mata" checked={s.penalties} onChange={(v) => set("penalties", v)} />}
          </div>
        </Section>

        <Section title="Critérios de desempate" description="Arraste (ou use as setas) para definir a ordem.">
          <ol className="space-y-2">
            {s.tiebreakers.map((k, i) => (
              <li
                key={k}
                {...tb.props(i)}
                className={cn("flex items-center gap-2 rounded-lg border bg-background/40 px-3 py-2", tb.dragging === i && "opacity-50")}
              >
                <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
                <span className="w-5 font-display text-primary">{i + 1}</span>
                <span className="flex-1">{TIEBREAKER_LABEL[k]}</span>
                <Button type="button" size="icon" variant="ghost" disabled={i === 0} aria-label="Subir" onClick={() => set("tiebreakers", moveItem(s.tiebreakers, i, i - 1))}>
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={i === s.tiebreakers.length - 1}
                  aria-label="Descer"
                  onClick={() => set("tiebreakers", moveItem(s.tiebreakers, i, i + 1))}
                >
                  <ArrowDown />
                </Button>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Suspensão automática" description="O jogador fica fora do próximo jogo e a súmula avisa. Use 0 para desligar.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amarelos para suspender">
              <Input type="number" min={0} value={s.suspensionYellows} onChange={(e) => set("suspensionYellows", Math.max(0, Number(e.target.value)))} />
            </Field>
            <Field label="Vermelhos para suspender">
              <Input type="number" min={0} value={s.suspensionReds} onChange={(e) => set("suspensionReds", Math.max(0, Number(e.target.value)))} />
            </Field>
          </div>
        </Section>

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Salvando..." : "Salvar formato e regras"}
          </Button>
        </div>
      </form>
      <ScoutConfig b={b} />
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border bg-background/40 p-3">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function ScoutConfig({ b }: { b: Bundle }) {
  const { busy, run } = useAction();
  const [editing, setEditing] = useState<EventType | "new" | null>(null);
  const sport = SPORTS.find((x) => x.value === b.tournament.sport)?.label ?? "modalidade";
  const presetKeys = new Set(eventPresets(b.tournament.sport).map((p) => p.key));
  return (
    <Section
      title="Scout"
      description="Escolha quais eventos a súmula vai registrar. Os rankings públicos são gerados a partir deles."
      actions={
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => {
              if (!confirm(`Restaurar os eventos padrão de ${sport}? Eventos personalizados e os registros deles nas súmulas serão apagados.`)) return;
              run(() => resetEventTypes(b.tournament.id, b.tournament.sport), "Eventos restaurados.");
            }}
          >
            <RotateCcw /> Restaurar padrão
          </Button>
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus /> Evento
          </Button>
        </div>
      }
    >
      <div className="divide-y rounded-lg border">
        {b.eventTypes.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nenhum evento. Use “Restaurar padrão”.</p>}
        {b.eventTypes.map((e) => (
          <div key={e.id} className="flex items-center gap-3 px-3 py-2">
            <span className="w-7 text-center text-xl">{e.icon}</span>
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(e)}>
              <div className={cn("truncate font-semibold", !e.enabled && "text-muted-foreground line-through")}>{e.name}</div>
              <div className="text-xs text-muted-foreground">
                {e.points > 0 ? `${e.points} ponto${e.points > 1 ? "s" : ""} para ${e.score_target === "own" ? "a própria equipe" : "o adversário"}` : "Não altera o placar"}
                {!presetKeys.has(e.key) && " · personalizado"}
              </div>
            </button>
            <Switch
              checked={e.enabled}
              onCheckedChange={(v) =>
                run(async () => {
                  const { error } = await supabase.from("event_types").update({ enabled: v }).eq("id", e.id);
                  if (error) throw error;
                })
              }
            />
          </div>
        ))}
      </div>
      {editing && <EventTypeDialog b={b} et={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Section>
  );
}

function EventTypeDialog({ b, et, onClose }: { b: Bundle; et: EventType | null; onClose: () => void }) {
  const [f, setF] = useState({
    name: et?.name ?? "",
    icon: et?.icon ?? "⚡",
    points: et?.points ?? 0,
    score_target: et?.score_target ?? "own",
  });
  const { busy, run } = useAction();
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">{et ? "Editar evento" : "Novo evento"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const row = { name: f.name.trim(), icon: f.icon || "⚡", points: f.points, score_target: f.score_target };
            const ok = await run(async () => {
              const { error } = et
                ? await supabase.from("event_types").update(row).eq("id", et.id)
                : await supabase.from("event_types").insert({
                    ...row,
                    tournament_id: b.tournament.id,
                    key: `custom_${Date.now().toString(36)}`,
                    sort: b.eventTypes.length,
                    enabled: true,
                  });
              if (error) throw error;
            });
            if (ok) onClose();
          }}
        >
          <div className="grid grid-cols-4 gap-3">
            <Field label="Ícone">
              <Input value={f.icon} maxLength={4} onChange={(e) => setF({ ...f, icon: e.target.value })} className="text-center text-xl" />
            </Field>
            <Field label="Nome" className="col-span-3">
              <Input autoFocus required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Desarme" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Soma ao placar" hint="0 = só estatística">
              <Input type="number" min={0} max={10} value={f.points} onChange={(e) => setF({ ...f, points: Math.max(0, Number(e.target.value)) })} />
            </Field>
            <Field label="Pontos vão para">
              <Select value={f.score_target} onValueChange={(v) => setF({ ...f, score_target: v })} disabled={f.points === 0}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="own">A própria equipe</SelectItem>
                  <SelectItem value="opponent">O adversário</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="flex gap-2">
            {et && (
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={async () => {
                  if (!confirm(`Excluir “${et.name}”? Os registros desse evento nas súmulas também serão apagados.`)) return;
                  const ok = await run(async () => {
                    const { error } = await supabase.from("event_types").delete().eq("id", et.id);
                    if (error) throw error;
                  });
                  if (ok) onClose();
                }}
              >
                <Trash2 />
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={busy || !f.name.trim()}>
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

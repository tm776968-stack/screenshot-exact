import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Crown, GripVertical, Shuffle } from "lucide-react";
import { TeamCrest } from "@/components/sport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Bundle, Team } from "@/lib/data";
import { teamMap } from "@/lib/data";
import { readExt, saveSettings } from "@/lib/manage";
import { seedOrder, shuffle, splitGroups } from "@/lib/tournament";
import { cn } from "@/lib/utils";
import { Field, moveItem, Section, useAction, useDragList } from "./shared";

function initialOrder(teams: Team[]) {
  return [...teams].sort((x, y) => (x.seed ?? 9999) - (y.seed ?? 9999) || x.created_at.localeCompare(y.created_at)).map((t) => t.id);
}

export function StepChave({ b }: { b: Bundle }) {
  const s = readExt(b.tournament.settings);
  const format = b.tournament.format;
  const teams = teamMap(b.teams);
  const [order, setOrder] = useState(() => initialOrder(b.teams));
  const [heads, setHeads] = useState(() => s.heads ?? (format === "grupos_mata_mata" ? s.groups : 0));
  const groupNames = Array.from({ length: s.groups }, (_, i) => String.fromCharCode(65 + i));
  const [groups, setGroups] = useState<Record<string, string>>(() =>
    Object.fromEntries(b.teams.filter((t) => t.group_name).map((t) => [t.id, t.group_name!])),
  );
  const { busy, run } = useAction();
  const drag = useDragList(order, setOrder);

  // keep new teams in the list
  useEffect(() => {
    setOrder((cur) => [...cur.filter((id) => teams.has(id)), ...b.teams.map((t) => t.id).filter((id) => !cur.includes(id))]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b.teams.length]);

  if (b.teams.length < 2) return <Section title="Sorteio e chaveamento">Cadastre pelo menos 2 equipes na etapa Equipes.</Section>;

  function draw() {
    const h = Math.min(heads, order.length);
    const next = [...order.slice(0, h), ...shuffle(order.slice(h))];
    setOrder(next);
    if (format === "grupos_mata_mata") assignGroups(next);
  }
  function assignGroups(ids = order) {
    const g = splitGroups(ids, s.groups);
    const map: Record<string, string> = {};
    for (const [name, list] of Object.entries(g)) for (const id of list) map[id] = name;
    setGroups(map);
  }

  async function save() {
    await run(async () => {
      for (let i = 0; i < order.length; i++) {
        const id = order[i]!;
        const { error } = await supabase
          .from("teams")
          .update({ seed: i + 1, group_name: format === "grupos_mata_mata" ? groups[id] ?? null : null })
          .eq("id", id);
        if (error) throw error;
      }
      await saveSettings(b.tournament, { heads });
    }, "Chaveamento salvo. Agora gere a tabela de jogos.");
  }

  const isPow2 = (n: number) => n >= 4 && (n & (n - 1)) === 0;

  return (
    <div className="space-y-4">
      <Section
        title="Ordem e cabeças de chave"
        description={
          format === "pontos_corridos"
            ? "Em pontos corridos todos jogam contra todos; a ordem só define a sequência da tabela."
            : "As primeiras equipes da lista são as cabeças de chave. O sorteio embaralha só as demais."
        }
        actions={
          <Button type="button" variant="secondary" onClick={draw}>
            <Shuffle /> Sortear
          </Button>
        }
      >
        {format !== "pontos_corridos" && (
          <Field label="Quantidade de cabeças de chave" className="mb-4 max-w-xs">
            <Input type="number" min={0} max={order.length} value={heads} onChange={(e) => setHeads(Math.max(0, Number(e.target.value)))} />
          </Field>
        )}
        {format === "dupla_eliminacao" && !isPow2(order.length) && (
          <p className="mb-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            A dupla eliminação precisa de 4, 8, 16 ou 32 equipes. Hoje são {order.length}.
          </p>
        )}
        <ol className="space-y-1.5">
          {order.map((id, i) => {
            const t = teams.get(id);
            const head = i < heads && format !== "pontos_corridos";
            return (
              <li
                key={id}
                {...drag.props(i)}
                className={cn("flex items-center gap-2 rounded-lg border bg-background/40 px-2 py-1.5", drag.dragging === i && "opacity-50", head && "border-primary/50")}
              >
                <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
                <span className="w-6 text-center font-display text-muted-foreground">{i + 1}</span>
                <TeamCrest team={t} size={24} />
                <span className="min-w-0 flex-1 truncate font-semibold">{t?.name}</span>
                {head && <Crown className="h-4 w-4 text-primary" aria-label="Cabeça de chave" />}
                {format === "grupos_mata_mata" && (
                  <Select value={groups[id] ?? ""} onValueChange={(v) => setGroups({ ...groups, [id]: v })}>
                    <SelectTrigger className="h-8 w-24">
                      <SelectValue placeholder="Grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      {groupNames.map((g) => (
                        <SelectItem key={g} value={g}>
                          Grupo {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={i === 0} aria-label="Subir" onClick={() => setOrder(moveItem(order, i, i - 1))}>
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  disabled={i === order.length - 1}
                  aria-label="Descer"
                  onClick={() => setOrder(moveItem(order, i, i + 1))}
                >
                  <ArrowDown />
                </Button>
              </li>
            );
          })}
        </ol>
      </Section>

      {format === "grupos_mata_mata" && (
        <GroupsBoard
          names={groupNames}
          order={order}
          groups={groups}
          setGroup={(id, g) => setGroups({ ...groups, [id]: g })}
          teams={teams}
          onAuto={() => assignGroups()}
        />
      )}
      {(format === "mata_mata" || format === "dupla_eliminacao") && <FirstRoundPreview order={order} teams={teams} />}

      <div className="flex justify-end">
        <Button size="lg" onClick={save} disabled={busy}>
          {busy ? "Salvando..." : "Salvar chaveamento"}
        </Button>
      </div>
    </div>
  );
}

function GroupsBoard({
  names,
  order,
  groups,
  setGroup,
  teams,
  onAuto,
}: {
  names: string[];
  order: string[];
  groups: Record<string, string>;
  setGroup: (id: string, g: string) => void;
  teams: Map<string, Team>;
  onAuto: () => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const unassigned = order.filter((id) => !groups[id] || !names.includes(groups[id]!));
  return (
    <Section
      title="Grupos"
      description="Arraste as equipes entre os grupos ou escolha o grupo na lista acima. A distribuição automática separa as cabeças de chave."
      actions={
        <Button type="button" variant="secondary" size="sm" onClick={onAuto}>
          Distribuir pela ordem
        </Button>
      }
    >
      {unassigned.length > 0 && (
        <p className="mb-3 text-sm text-warning">
          {unassigned.length} equipe{unassigned.length > 1 ? "s" : ""} sem grupo.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {names.map((g) => (
          <div
            key={g}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId) setGroup(dragId, g);
              setDragId(null);
            }}
            className="min-h-24 rounded-lg border bg-background/40 p-2"
          >
            <div className="mb-2 font-display text-lg">Grupo {g}</div>
            <div className="space-y-1">
              {order
                .filter((id) => groups[id] === g)
                .map((id) => (
                  <div
                    key={id}
                    draggable
                    onDragStart={() => setDragId(id)}
                    className="flex cursor-grab items-center gap-2 rounded-md bg-card px-2 py-1.5 text-sm"
                  >
                    <TeamCrest team={teams.get(id)} size={20} />
                    <span className="truncate">{teams.get(id)?.name}</span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function FirstRoundPreview({ order, teams }: { order: string[]; teams: Map<string, Team> }) {
  const pairs = useMemo(() => {
    let size = 1;
    while (size < order.length) size *= 2;
    const slots = seedOrder(size).map((sd) => order[sd - 1] ?? null);
    const out: [string | null, string | null][] = [];
    for (let i = 0; i < size; i += 2) out.push([slots[i] ?? null, slots[i + 1] ?? null]);
    return out;
  }, [order]);
  return (
    <Section title="Prévia da 1ª rodada" description="Vagas vazias são folgas: a equipe avança direto.">
      <div className="grid gap-2 sm:grid-cols-2">
        {pairs.map(([h, a], i) => (
          <div key={i} className="rounded-lg border bg-background/40 text-sm">
            {[h, a].map((id, j) => (
              <div key={j} className={cn("flex items-center gap-2 px-3 py-1.5", j === 0 && "border-b")}>
                <TeamCrest team={id ? teams.get(id) : null} size={18} />
                <span className={cn("truncate", !id && "text-muted-foreground")}>{id ? teams.get(id)?.name : "Folga"}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Section>
  );
}

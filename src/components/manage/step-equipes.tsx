import { useState } from "react";
import { ChevronDown, MapPin, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { TeamCrest } from "@/components/sport";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Bundle, Player, Team } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Field, ImagePicker, Section, useAction } from "./shared";

export function StepEquipes({ b }: { b: Bundle }) {
  const [editing, setEditing] = useState<Team | "new" | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <Section
        title={`Equipes (${b.teams.length})`}
        description="Cadastre as equipes e, se quiser, o elenco de cada uma."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus /> Equipe
          </Button>
        }
      >
        {b.teams.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma equipe cadastrada ainda.</p>}
        <div className="divide-y rounded-lg border">
          {b.teams.map((t) => {
            const players = b.players.filter((p) => p.team_id === t.id);
            const isOpen = open === t.id;
            return (
              <div key={t.id}>
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <button type="button" onClick={() => setOpen(isOpen ? null : t.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <TeamCrest team={t} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{t.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {players.length} jogador{players.length === 1 ? "" : "es"}
                        {t.manager && ` · ${t.manager}`}
                        {t.contact && ` · ${t.contact}`}
                      </div>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition", isOpen && "rotate-180")} />
                  </button>
                  <Button variant="ghost" size="icon" aria-label="Editar equipe" onClick={() => setEditing(t)}>
                    <Pencil />
                  </Button>
                </div>
                {isOpen && <Roster b={b} team={t} players={players} />}
              </div>
            );
          })}
        </div>
      </Section>
      <Venues b={b} />
      {editing && <TeamDialog b={b} team={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TeamDialog({ b, team, onClose }: { b: Bundle; team: Team | null; onClose: () => void }) {
  const [f, setF] = useState({
    name: team?.name ?? "",
    color: team?.color ?? "#3b82f6",
    manager: team?.manager ?? "",
    contact: team?.contact ?? "",
    logo_url: team?.logo_url ?? null,
  });
  const { busy, run } = useAction();
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">{team ? "Editar equipe" : "Nova equipe"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const row = {
              name: f.name.trim(),
              color: f.color,
              manager: f.manager || null,
              contact: f.contact || null,
              logo_url: f.logo_url,
            };
            const ok = await run(async () => {
              const { error } = team
                ? await supabase.from("teams").update(row).eq("id", team.id)
                : await supabase.from("teams").insert({ ...row, tournament_id: b.tournament.id, seed: b.teams.length + 1 });
              if (error) throw error;
            });
            if (ok) onClose();
          }}
        >
          <Field label="Nome">
            <Input autoFocus required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Escudo">
              <ImagePicker value={f.logo_url} label="Escudo" onChange={(v) => setF({ ...f, logo_url: v })} />
            </Field>
            <Field label="Cor">
              <input
                type="color"
                value={f.color}
                onChange={(e) => setF({ ...f, color: e.target.value })}
                className="h-14 w-full cursor-pointer rounded-md border bg-transparent"
              />
            </Field>
          </div>
          <Field label="Responsável">
            <Input value={f.manager} onChange={(e) => setF({ ...f, manager: e.target.value })} />
          </Field>
          <Field label="Contato">
            <Input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder="Telefone ou e-mail" />
          </Field>
          <div className="flex gap-2">
            {team && (
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={async () => {
                  if (!confirm(`Excluir ${team.name} e todo o elenco?`)) return;
                  const ok = await run(async () => {
                    const { error } = await supabase.from("teams").delete().eq("id", team.id);
                    if (error) throw error;
                  });
                  if (ok) onClose();
                }}
              >
                <Trash2 /> Excluir
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

function Roster({ b, team, players }: { b: Bundle; team: Team; players: Player[] }) {
  const [editing, setEditing] = useState<Player | "new" | null>(null);
  return (
    <div className="space-y-2 bg-background/40 px-3 pb-3">
      {players.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => setEditing(p)}
          className="flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left hover:border-primary/50"
        >
          {p.photo_url ? (
            <img src={p.photo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary font-display">{p.number ?? "–"}</span>
          )}
          <span className="min-w-0 flex-1 truncate text-sm">
            <b>{p.nickname || p.name}</b>
            {p.nickname && <span className="text-muted-foreground"> · {p.name}</span>}
          </span>
          <span className="text-xs text-muted-foreground">{p.position}</span>
          {p.number != null && <span className="font-display text-muted-foreground">#{p.number}</span>}
        </button>
      ))}
      <Button variant="secondary" size="sm" onClick={() => setEditing("new")}>
        <UserPlus /> Jogador
      </Button>
      {editing && <PlayerDialog b={b} team={team} player={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function PlayerDialog({ b, team, player, onClose }: { b: Bundle; team: Team; player: Player | null; onClose: () => void }) {
  const [f, setF] = useState({
    name: player?.name ?? "",
    nickname: player?.nickname ?? "",
    number: player?.number?.toString() ?? "",
    position: player?.position ?? "",
    photo_url: player?.photo_url ?? null,
  });
  const { busy, run } = useAction();
  const save = async (another: boolean) => {
    const row = {
      name: f.name.trim(),
      nickname: f.nickname || null,
      number: f.number === "" ? null : Number(f.number),
      position: f.position || null,
      photo_url: f.photo_url,
    };
    const ok = await run(async () => {
      const { error } = player
        ? await supabase.from("players").update(row).eq("id", player.id)
        : await supabase.from("players").insert({ ...row, team_id: team.id, tournament_id: b.tournament.id });
      if (error) throw error;
    });
    if (!ok) return;
    if (another) setF({ name: "", nickname: "", number: "", position: "", photo_url: null });
    else onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">
            {player ? "Editar jogador" : "Novo jogador"} · {team.name}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save(false);
          }}
        >
          <Field label="Foto">
            <ImagePicker value={f.photo_url} label="Foto" maxSize={128} onChange={(v) => setF({ ...f, photo_url: v })} />
          </Field>
          <Field label="Nome">
            <Input autoFocus required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Apelido" className="col-span-2">
              <Input value={f.nickname} onChange={(e) => setF({ ...f, nickname: e.target.value })} />
            </Field>
            <Field label="Camisa">
              <Input type="number" inputMode="numeric" min={0} value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} />
            </Field>
          </div>
          <Field label="Posição">
            <Input value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} placeholder="Ex.: Goleiro, Ala, Pivô" />
          </Field>
          <div className="flex flex-wrap gap-2">
            {player && (
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={async () => {
                  if (!confirm(`Excluir ${player.name}?`)) return;
                  const ok = await run(async () => {
                    const { error } = await supabase.from("players").delete().eq("id", player.id);
                    if (error) throw error;
                  });
                  if (ok) onClose();
                }}
              >
                <Trash2 />
              </Button>
            )}
            {!player && (
              <Button type="button" variant="secondary" disabled={busy || !f.name.trim()} onClick={() => save(true)}>
                Salvar e adicionar outro
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

function Venues({ b }: { b: Bundle }) {
  const [name, setName] = useState("");
  const { busy, run } = useAction();
  return (
    <Section title="Locais e quadras" description="Cadastre mais de um local para jogos simultâneos.">
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const ok = await run(async () => {
            const { error } = await supabase.from("venues").insert({ name: name.trim(), tournament_id: b.tournament.id });
            if (error) throw error;
          });
          if (ok) setName("");
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Quadra 1" />
        <Button type="submit" disabled={busy || !name.trim()}>
          <Plus /> Adicionar
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {b.venues.map((v) => (
          <span key={v.id} className="inline-flex items-center gap-1.5 rounded-full border bg-secondary px-3 py-1 text-sm">
            <MapPin className="h-3.5 w-3.5 text-primary" /> {v.name}
            <button
              type="button"
              aria-label={`Remover ${v.name}`}
              className="text-muted-foreground hover:text-destructive"
              onClick={() =>
                run(async () => {
                  const { error } = await supabase.from("venues").delete().eq("id", v.id);
                  if (error) throw error;
                })
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
    </Section>
  );
}

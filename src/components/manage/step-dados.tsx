import { useEffect, useState } from "react";
import { Pipette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Bundle } from "@/lib/data";
import { dominantColor } from "@/lib/images";
import { SPORTS, STATUS_LABEL } from "@/lib/tournament";
import { Field, ImagePicker, Section, useAction } from "./shared";

export function StepDados({ b }: { b: Bundle }) {
  const t = b.tournament;
  const [f, setF] = useState(() => ({
    name: t.name,
    sport: t.sport,
    location: t.location ?? "",
    start_date: t.start_date ?? "",
    end_date: t.end_date ?? "",
    status: t.status,
    logo_url: t.logo_url,
    banner_url: t.banner_url,
    primary_color: t.primary_color ?? "",
    rules: t.rules ?? "",
  }));
  useEffect(() => {
    setF((cur) => ({ ...cur, status: t.status }));
  }, [t.status]);
  const { busy, run } = useAction();
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((cur) => ({ ...cur, [k]: v }));

  async function pickFromLogo(src: string | null) {
    if (!src) return;
    const c = await dominantColor(src);
    if (c) set("primary_color", c);
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const { error } = await supabase
            .from("tournaments")
            .update({
              name: f.name.trim() || t.name,
              sport: f.sport,
              location: f.location || null,
              start_date: f.start_date || null,
              end_date: f.end_date || null,
              status: f.status,
              logo_url: f.logo_url,
              banner_url: f.banner_url,
              primary_color: f.primary_color || null,
              rules: f.rules || null,
            })
            .eq("id", t.id);
          if (error) throw error;
        }, "Dados salvos.");
      }}
    >
      <Section title="Dados do torneio">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" className="sm:col-span-2">
            <Input value={f.name} onChange={(e) => set("name", e.target.value)} required />
          </Field>
          <Field label="Modalidade" hint="Para trocar os eventos do scout, use 'Restaurar padrão' na etapa Formato e regras.">
            <Select value={f.sport} onValueChange={(v) => set("sport", v)}>
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
          </Field>
          <Field label="Status">
            <Select value={f.status} onValueChange={(v) => set("status", v as typeof f.status)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Local" className="sm:col-span-2">
            <Input value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="Ex.: Ginásio Municipal" />
          </Field>
          <Field label="Data de início">
            <Input type="date" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} />
          </Field>
          <Field label="Data de término">
            <Input type="date" value={f.end_date} onChange={(e) => set("end_date", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Identidade visual" description="A cor principal é usada na página pública do torneio.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Logo">
            <ImagePicker
              value={f.logo_url}
              label="Logo"
              onChange={(v) => {
                set("logo_url", v);
                if (v && !f.primary_color) pickFromLogo(v);
              }}
            />
          </Field>
          <Field label="Banner">
            <ImagePicker value={f.banner_url} label="Banner" shape="wide" maxSize={1200} onChange={(v) => set("banner_url", v)} />
          </Field>
          <Field label="Cor principal" className="sm:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="color"
                value={f.primary_color || "#b8f53d"}
                onChange={(e) => set("primary_color", e.target.value)}
                className="h-9 w-14 cursor-pointer rounded-md border bg-transparent"
                aria-label="Cor principal"
              />
              <Input value={f.primary_color} onChange={(e) => set("primary_color", e.target.value)} placeholder="Padrão do sistema" className="w-36" />
              <Button type="button" variant="secondary" size="sm" disabled={!f.logo_url} onClick={() => pickFromLogo(f.logo_url)}>
                <Pipette /> Usar cor do logo
              </Button>
              {f.primary_color && (
                <Button type="button" variant="ghost" size="sm" onClick={() => set("primary_color", "")}>
                  Usar padrão
                </Button>
              )}
            </div>
          </Field>
        </div>
      </Section>

      <Section title="Regulamento">
        <Textarea value={f.rules} onChange={(e) => set("rules", e.target.value)} rows={8} placeholder="Regras, horários, critérios, contato da organização..." />
      </Section>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Salvando..." : "Salvar dados"}
        </Button>
      </div>
    </form>
  );
}

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Download, ExternalLink, Mail, Trash2, Tv } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import type { Bundle } from "@/lib/data";
import { publicUrl } from "@/lib/manage";
import { Section, useAction } from "./shared";

export function StepPublicar({ b, isOwner }: { b: Bundle; isOwner: boolean }) {
  const t = b.tournament;
  const { busy, run } = useAction();
  const url = publicUrl(t.slug);
  const checks = [
    { ok: b.teams.length >= 2, text: "Pelo menos 2 equipes cadastradas" },
    { ok: b.matches.length > 0, text: "Tabela de jogos gerada" },
    { ok: b.matches.some((m) => m.scheduled_at), text: "Horários definidos" },
  ];

  function downloadQr() {
    const svg = document.getElementById("qr-torneio");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `qrcode-${t.slug}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-4">
      <Section title="Publicação" description="Só torneios publicados aparecem para quem tem o link.">
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border bg-background/40 p-4">
          <span>
            <span className="block font-display text-xl uppercase">{t.published ? "Publicado" : "Não publicado"}</span>
            <span className="text-sm text-muted-foreground">
              {t.published ? "Qualquer pessoa com o link ou QR Code acompanha ao vivo." : "Só você e os co-organizadores conseguem ver."}
            </span>
          </span>
          <Switch
            checked={t.published}
            disabled={busy}
            onCheckedChange={(v) =>
              run(async () => {
                const patch = v && t.status === "rascunho" ? { published: v, status: "inscricoes" as const } : { published: v };
                const { error } = await supabase.from("tournaments").update(patch).eq("id", t.id);
                if (error) throw error;
              }, v ? "Torneio publicado!" : "Torneio despublicado.")
            }
          />
        </label>
        <ul className="mt-3 space-y-1 text-sm">
          {checks.map((c) => (
            <li key={c.text} className={c.ok ? "text-success" : "text-muted-foreground"}>
              {c.ok ? "✓" : "○"} {c.text}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Link e QR Code">
        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="self-center rounded-xl bg-white p-3">
            <QRCodeSVG id="qr-torneio" value={url} size={168} level="M" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={url} onFocus={(e) => e.target.select()} />
              <Button
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(url);
                  toast.success("Link copiado!");
                }}
              >
                <Copy /> Copiar
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={downloadQr}>
                <Download /> Baixar QR Code
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/t/$slug" params={{ slug: t.slug }}>
                  <ExternalLink /> Abrir página pública
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/tv/$slug" params={{ slug: t.slug }}>
                  <Tv /> Modo TV/telão
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Section>

      <CoOrganizers tournamentId={t.id} isOwner={isOwner} />
    </div>
  );
}

function CoOrganizers({ tournamentId, isOwner }: { tournamentId: string; isOwner: boolean }) {
  const [email, setEmail] = useState("");
  const { busy, run } = useAction();
  const q = useQuery({
    queryKey: ["members", tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("tournament_members").select("*").eq("tournament_id", tournamentId).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  return (
    <Section
      title="Co-organizadores"
      description="Eles editam este torneio com as mesmas permissões que você. Basta entrar (ou criar conta) com o e-mail convidado."
    >
      {isOwner && (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const v = email.trim().toLowerCase();
            if (!v) return;
            const ok = await run(async () => {
              const { error } = await supabase.from("tournament_members").insert({ tournament_id: tournamentId, email: v });
              if (error) throw error.code === "23505" ? new Error("Este e-mail já foi convidado.") : error;
              await q.refetch();
            }, "Convite registrado.");
            if (ok) setEmail("");
          }}
        >
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
          <Button type="submit" disabled={busy || !email.trim()}>
            <Mail /> Convidar
          </Button>
        </form>
      )}
      <div className="mt-3 space-y-2">
        {q.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum co-organizador.</p>}
        {q.data?.map((m) => (
          <div key={m.id} className="flex items-center gap-2 rounded-lg border bg-background/40 px-3 py-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 truncate">{m.email}</span>
            {isOwner && (
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Remover ${m.email}`}
                onClick={() =>
                  run(async () => {
                    const { error } = await supabase.from("tournament_members").delete().eq("id", m.id);
                    if (error) throw error;
                    await q.refetch();
                  })
                }
              >
                <Trash2 />
              </Button>
            )}
          </div>
        ))}
      </div>
      {isOwner && (
        <p className="mt-3 text-xs text-muted-foreground">
          O sistema não envia e-mail automaticamente: avise a pessoa e mande o link do painel.
        </p>
      )}
    </Section>
  );
}

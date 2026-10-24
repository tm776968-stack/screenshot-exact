import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, KeyRound, Lock, LockOpen, Shield, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AppHeader, PageLoading } from "@/components/app-header";
import { Empty } from "@/components/views";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  amIAdmin,
  createUser,
  deleteUser,
  listUsers,
  setUserAdmin,
  setUserPassword,
  unlockUser,
  type AdminUser,
} from "@/lib/admin.functions";
import { useRequireAuth } from "@/lib/auth";
import { errMsg } from "@/lib/manage";
import { fmtDateTime } from "@/lib/tournament";

export const Route = createFileRoute("/usuarios")({
  head: () => ({ meta: [{ title: "Usuários — Placar Pro" }] }),
  component: Usuarios,
});

function useIsAdmin(enabled: boolean) {
  return useQuery({ queryKey: ["am-i-admin"], enabled, queryFn: () => amIAdmin() });
}

function Usuarios() {
  const { user, loading } = useRequireAuth();
  const adm = useIsAdmin(!!user);
  const users = useQuery({ queryKey: ["admin-users"], enabled: !!adm.data?.admin, queryFn: () => listUsers() });
  const [creating, setCreating] = useState(false);
  const [pwFor, setPwFor] = useState<AdminUser | null>(null);
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.success(ok);
      await refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  if (loading || !user || adm.isLoading) return <PageLoading />;
  return (
    <div className="min-h-screen">
      <AppHeader email={user.email} />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Link to="/painel" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ChevronLeft className="h-4 w-4" /> Meus torneios
        </Link>
        {!adm.data?.admin ? (
          <div className="mt-6">
            <Empty>Apenas o administrador do sistema acessa esta página.</Empty>
          </div>
        ) : (
          <>
            <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-4xl uppercase">Usuários</h1>
                <p className="text-sm text-muted-foreground">Só o administrador cadastra contas. Após 5 senhas erradas a conta fica bloqueada até ser liberada aqui.</p>
              </div>
              <Button onClick={() => setCreating(true)}>
                <UserPlus /> Novo usuário
              </Button>
            </div>
            <div className="mt-6 space-y-2">
              {users.isLoading && <PageLoading />}
              {users.error && <Empty>Não foi possível carregar: {errMsg(users.error)}</Empty>}
              {users.data?.map((u) => (
                <div key={u.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">{u.name || u.email}</span>
                      {u.is_admin && (
                        <Badge>
                          <Shield className="mr-1 h-3 w-3" /> Admin
                        </Badge>
                      )}
                      {u.locked ? (
                        <Badge variant="destructive">
                          <Lock className="mr-1 h-3 w-3" /> Bloqueado
                        </Badge>
                      ) : (
                        u.failed > 0 && <Badge variant="outline">{u.failed} tentativa{u.failed > 1 ? "s" : ""} errada{u.failed > 1 ? "s" : ""}</Badge>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {u.email} · último acesso: {u.last_sign_in_at ? fmtDateTime(u.last_sign_in_at) : "nunca"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(u.locked || u.failed > 0) && (
                      <Button size="sm" onClick={() => act(() => unlockUser({ data: { email: u.email } }), "Conta desbloqueada.")}>
                        <LockOpen /> Desbloquear
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => setPwFor(u)}>
                      <KeyRound /> Senha
                    </Button>
                    {u.id !== user.id && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            act(
                              () => setUserAdmin({ data: { email: u.email, admin: !u.is_admin } }),
                              u.is_admin ? "Acesso de administrador removido." : "Agora é administrador.",
                            )
                          }
                        >
                          <Shield /> {u.is_admin ? "Tirar admin" : "Tornar admin"}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Excluir ${u.email}`}
                          onClick={() => {
                            if (!confirm(`Excluir a conta ${u.email}? Os torneios criados por ela continuam no banco, mas ficam sem dono.`)) return;
                            act(() => deleteUser({ data: { id: u.id, email: u.email } }), "Conta excluída.");
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
      {creating && <CreateUserDialog onClose={() => setCreating(false)} onDone={refresh} />}
      {pwFor && <PasswordDialog u={pwFor} onClose={() => setPwFor(null)} onDone={refresh} />}
    </div>
  );
}

function CreateUserDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: "", email: "", password: "", admin: false });
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">Novo usuário</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await createUser({ data: f });
              toast.success(`Conta criada. Passe o e-mail e a senha para ${f.name || f.email}.`);
              onDone();
              onClose();
            } catch (err) {
              toast.error(errMsg(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="u-name">Nome</Label>
            <Input id="u-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-email">E-mail</Label>
            <Input id="u-email" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-pass">Senha inicial</Label>
            <Input id="u-pass" type="text" minLength={6} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="off" />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
            Também é administrador
            <Switch checked={f.admin} onCheckedChange={(v) => setF({ ...f, admin: v })} />
          </label>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Criando..." : "Criar conta"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({ u, onClose, onDone }: { u: AdminUser; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">Nova senha</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await setUserPassword({ data: { id: u.id, email: u.email, password } });
              toast.success("Senha alterada e conta desbloqueada.");
              onDone();
              onClose();
            } catch (err) {
              toast.error(errMsg(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="text-sm text-muted-foreground">{u.email}</p>
          <Input type="text" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
          <Button type="submit" className="w-full" disabled={busy}>
            Salvar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

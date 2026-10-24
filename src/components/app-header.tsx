import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";

export function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Trophy className="h-4 w-4" />
      </span>
      <span className="font-display text-xl font-bold uppercase tracking-wide">Placar Pro</span>
    </Link>
  );
}

export function AppHeader({ children, email }: { children?: ReactNode; email?: string | null }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Brand />
        <div className="flex flex-1 items-center justify-end gap-2">
          {children}
          {email && <span className="hidden truncate text-xs text-muted-foreground sm:inline">{email}</span>}
          {email && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sair"
              onClick={async () => {
                await signOut();
                navigate({ to: "/" });
              }}
            >
              <LogOut />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export function PageLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

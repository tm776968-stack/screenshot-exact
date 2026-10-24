import { useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fileToDataUrl } from "@/lib/images";
import { errMsg } from "@/lib/manage";

export function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["bundle"] });
}

/** Runs an async action with a toast on error and a refresh afterwards. */
export function useAction() {
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>, success?: string) {
    setBusy(true);
    try {
      await fn();
      if (success) toast.success(success);
      await refresh();
      return true;
    } catch (e) {
      toast.error(errMsg(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

export function Section({ title, description, children, actions }: { title: string; description?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-2xl uppercase">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, children, className, hint }: { label: string; children: ReactNode; className?: string; hint?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ImagePicker({
  value,
  onChange,
  maxSize = 256,
  label = "Imagem",
  shape = "round",
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  maxSize?: number;
  label?: string;
  shape?: "round" | "wide";
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden border border-dashed bg-secondary text-muted-foreground hover:border-primary",
          shape === "round" ? "h-14 w-14 rounded-full" : "h-14 w-28 rounded-lg",
        )}
      >
        {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-5 w-5" />}
      </button>
      <div className="flex flex-col items-start gap-1">
        <Button type="button" size="sm" variant="secondary" onClick={() => ref.current?.click()}>
          {value ? "Trocar" : "Enviar"} {label.toLowerCase()}
        </Button>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
            <X className="h-3 w-3" /> Remover
          </button>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            onChange(await fileToDataUrl(f, maxSize));
          } catch (err) {
            toast.error(errMsg(err));
          }
        }}
      />
    </div>
  );
}

/** Small reorderable list: drag on desktop, arrow buttons on touch screens. */
export function moveItem<T>(arr: T[], from: number, to: number) {
  const a = [...arr];
  const [x] = a.splice(from, 1);
  if (x === undefined) return arr;
  a.splice(Math.max(0, Math.min(a.length, to)), 0, x);
  return a;
}

export function useDragList<T>(items: T[], setItems: (v: T[]) => void) {
  const [dragging, setDragging] = useState<number | null>(null);
  const props = (i: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      setDragging(i);
      e.dataTransfer.effectAllowed = "move";
    },
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (dragging != null && dragging !== i) setItems(moveItem(items, dragging, i));
      setDragging(null);
    },
    onDragEnd: () => setDragging(null),
  });
  return { dragging, props };
}

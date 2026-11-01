import type { CSSProperties } from "react";

/**
 * Images (logos, crests, player photos) are resized in the browser and stored
 * as small data URLs in the existing *_url columns, so no storage bucket is needed.
 */
export function fileToDataUrl(file: File, maxSize = 256, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Arquivo de imagem inválido."));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas indisponível."));
        ctx.drawImage(img, 0, 0, w, h);
        const png = file.type === "image/png" || file.type === "image/svg+xml";
        resolve(canvas.toDataURL(png ? "image/png" : "image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Most frequent saturated color of an image, as #rrggbb. */
export function dominantColor(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onerror = () => resolve(null);
    img.onload = () => {
      try {
        const size = 48;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!, a = data[i + 3]!;
          if (a < 128) continue;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          if (max < 40 || max - min < 40) continue; // skip dark / grey / white
          const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
          const cur = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
          cur.n++; cur.r += r; cur.g += g; cur.b += b;
          buckets.set(key, cur);
        }
        const best = [...buckets.values()].sort((x, y) => y.n - x.n)[0];
        if (!best) return resolve(null);
        const hex = (v: number) => Math.round(v / best.n).toString(16).padStart(2, "0");
        resolve(`#${hex(best.r)}${hex(best.g)}${hex(best.b)}`);
      } catch {
        resolve(null);
      }
    };
    img.src = src;
  });
}

/** Black or white text for a background color. */
export function readableOn(hex: string) {
  const m = hex.replace("#", "");
  if (m.length !== 6) return "#111111";
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#111111" : "#ffffff";
}

/** CSS variables that recolor the theme with the tournament's primary color. */
export function themeVars(color: string | null | undefined): CSSProperties | undefined {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return undefined;
  return {
    ["--primary" as string]: color,
    ["--ring" as string]: color,
    ["--primary-foreground" as string]: readableOn(color),
  } as CSSProperties;
}

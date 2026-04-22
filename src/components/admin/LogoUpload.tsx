"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Helper, Input, Label } from "@/components/ui/primitives";

interface Props {
  value: string | null; // data URL or public URL
  alt: string | null;
  onChange: (logoUrl: string | null, alt: string | null) => void;
}

const MAX_DISPLAY_WIDTH = 400;
const MAX_BYTES = 250 * 1024; // target ~250KB after compression

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

async function compressImage(file: File): Promise<string> {
  const dataUrl = await fileToDataUrl(file);
  // SVGs and small PNGs — keep as-is if already small
  if (file.type === "image/svg+xml" || file.size <= MAX_BYTES) {
    return dataUrl;
  }
  // Raster → downscale via canvas
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not decode image"));
    el.src = dataUrl;
  });
  const scale = Math.min(1, MAX_DISPLAY_WIDTH / img.naturalWidth);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  // Re-encode as PNG to preserve transparency (logos usually have alpha).
  return canvas.toDataURL("image/png");
}

export function LogoUpload({ value, alt, onChange }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("Please choose an image file (PNG, JPG, SVG).");
      }
      if (file.size > 2 * 1024 * 1024) {
        throw new Error("Image must be under 2 MB before compression.");
      }
      const dataUrl = await compressImage(file);
      onChange(dataUrl, alt || file.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {value ? (
        <div className="flex items-start gap-4 rounded-2xl border border-[#D9DFDA] bg-white p-4">
          <div className="flex h-20 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#F7F9F7]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={alt ?? "Campaign logo"}
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Label label="Alt text">
              <Input
                value={alt ?? ""}
                onChange={(e) => onChange(value, e.target.value || null)}
                placeholder="Acme Health Network logo"
              />
            </Label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#D9DFDA] bg-white px-3 text-xs font-medium text-[#1C1C1C] hover:bg-[#F7F9F7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5D54] focus-visible:ring-offset-2"
              >
                <Upload className="h-3.5 w-3.5" />
                Replace
              </button>
              <button
                type="button"
                onClick={() => onChange(null, null)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#F4C6C6] bg-white px-3 text-xs font-medium text-[#991B1B] hover:bg-[#FEE2E2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B85C5C] focus-visible:ring-offset-2"
              >
                <X className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#C7D0CA] bg-[#F7F9F7] px-4 py-8 text-sm text-[#374151] hover:bg-[#DCE8E4]/40 focus-within:ring-2 focus-within:ring-[#2F5D54]">
          <Upload className="h-4 w-4" />
          <span className="font-medium">
            {busy ? "Processing…" : "Upload a logo (PNG, JPG, or SVG)"}
          </span>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
        </label>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      {error && (
        <p className="rounded-xl bg-[#FEE2E2] px-3 py-2 text-sm text-[#991B1B]">
          {error}
        </p>
      )}
      <Helper>
        Shown in the top-left of every survey screen. PNG with transparent
        background works best; raster images are auto-resized to 400 px wide.
      </Helper>
    </div>
  );
}

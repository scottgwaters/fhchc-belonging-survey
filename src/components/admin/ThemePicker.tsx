"use client";

import { Check } from "lucide-react";
import { THEME_IDS, THEMES, type ThemeId } from "@/lib/themes";

interface Props {
  value: ThemeId;
  onChange: (v: ThemeId) => void;
}

export function ThemePicker({ value, onChange }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Campaign theme"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      {THEME_IDS.map((id) => {
        const t = THEMES[id];
        const selected = id === value;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(id)}
            className={[
              "flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5D54] focus-visible:ring-offset-2",
              selected
                ? "border-[#2F5D54] ring-2 ring-[#2F5D54]/25 bg-white"
                : "border-[#D9DFDA] bg-white hover:border-[#C7D0CA]",
            ].join(" ")}
          >
            {/* Swatch preview */}
            <div className="flex shrink-0 flex-col gap-1">
              <span
                className="h-10 w-10 rounded-lg"
                style={{ background: t.vars.accent }}
                aria-hidden
              />
              <span className="flex gap-1">
                <span
                  className="h-3 w-4 rounded"
                  style={{ background: t.vars.accentStrong }}
                  aria-hidden
                />
                <span
                  className="h-3 w-4 rounded border border-[#E8ECE8]"
                  style={{ background: t.vars.accentSoft }}
                  aria-hidden
                />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="t-label">{t.label}</p>
                {selected && <Check className="h-3.5 w-3.5 text-[#244943]" />}
              </div>
              <p className="mt-0.5 text-xs text-[#6B7280] leading-snug">
                {t.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

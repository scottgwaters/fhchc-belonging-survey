import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { resolveTheme, themeStyle, type ThemeId } from "@/lib/themes";

interface Props {
  children: ReactNode;
  progressFraction?: number; // 0..1
  stepLabel?: string;
  /** Theme applied to the respondent view. Default 'teal'. */
  theme?: ThemeId | string | null;
  /** Optional logo URL (data URL or public path). Shown in the top-left. */
  logoUrl?: string | null;
  logoAlt?: string | null;
}

/**
 * PRD §13A.3 / §13A.4 - chrome shared by every survey screen.
 * Reads its accent palette from CSS vars, which can be overridden per
 * campaign via `themeStyle()`.
 */
export function SurveyChrome({
  children,
  progressFraction = 0,
  stepLabel,
  theme,
  logoUrl,
  logoAlt,
}: Props) {
  const pct = Math.max(0, Math.min(1, progressFraction)) * 100;
  const themeDef = resolveTheme(theme ?? null);
  return (
    <div
      className="min-h-screen"
      style={{
        ...themeStyle(themeDef),
        background: "var(--bg-subtle)",
      }}
    >
      <header className="sticky top-0 z-40 border-b border-[#D9DFDA] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5 text-base font-semibold text-[#1C1C1C]">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={logoAlt ?? "Campaign logo"}
                className="h-8 w-auto max-w-[140px] object-contain"
              />
            ) : (
              <>
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-white text-xs font-bold"
                  style={{ background: "var(--accent)" }}
                >
                  B
                </span>
                <span>Belonging Index</span>
              </>
            )}
          </div>
          <div
            className="flex items-center gap-1.5 text-xs font-medium"
            style={{ color: "var(--accent-strong)" }}
          >
            <Lock className="h-3.5 w-3.5" />
            Confidential
          </div>
        </div>
        <div className="h-1 w-full bg-[#EFF3EF]">
          <div
            className="h-full transition-[width] duration-500"
            style={{ width: `${pct}%`, background: "var(--accent)" }}
          />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">
        {stepLabel && (
          <p
            className="mb-4 text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--accent-strong)" }}
          >
            {stepLabel}
          </p>
        )}
        {children}
      </main>
    </div>
  );
}

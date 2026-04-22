/**
 * Accent palette options. Each theme supplies the four variables the survey
 * respondent chrome and the admin app read from CSS custom properties.
 *
 * Default admin theme = `teal`. Campaigns can override with their own theme;
 * that override is scoped to the respondent-facing surface (SurveyChrome).
 */

export interface ThemeVars {
  accent: string; // primary accent (buttons, progress, focus)
  accentStrong: string; // pressed / text color on soft surfaces
  accentSoft: string; // tinted bg for pill badges, progress track
  accentRing: string; // rgba focus ring
  bgSubtle: string; // tinted page background for respondent screens
}

export interface ThemeDef {
  id: ThemeId;
  label: string;
  description: string;
  vars: ThemeVars;
}

export const THEME_IDS = ["slate", "teal", "terracotta", "plum", "navy"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const THEMES: Record<ThemeId, ThemeDef> = {
  slate: {
    id: "slate",
    label: "Slate / graphite",
    description: "Premium, neutral, very restrained. Like Linear.",
    vars: {
      accent: "#4B5563",
      accentStrong: "#374151",
      accentSoft: "#E5E7EB",
      accentRing: "rgba(75, 85, 99, 0.35)",
      bgSubtle: "#FAFAFA",
    },
  },
  teal: {
    id: "teal",
    label: "Deep teal",
    description: "Calm, confident, healthcare-appropriate.",
    vars: {
      accent: "#2F5D54",
      accentStrong: "#244943",
      accentSoft: "#DCE8E4",
      accentRing: "rgba(47, 93, 84, 0.35)",
      bgSubtle: "#F6FAF8",
    },
  },
  terracotta: {
    id: "terracotta",
    label: "Warm terracotta",
    description: "Warm, approachable, grounded.",
    vars: {
      accent: "#A8604C",
      accentStrong: "#8C4E3E",
      accentSoft: "#F1DED6",
      accentRing: "rgba(168, 96, 76, 0.35)",
      bgSubtle: "#FDF9F7",
    },
  },
  plum: {
    id: "plum",
    label: "Dusty plum",
    description: "Softer than indigo, editorial feel.",
    vars: {
      accent: "#7A5E72",
      accentStrong: "#614A5B",
      accentSoft: "#E8DEE5",
      accentRing: "rgba(122, 94, 114, 0.35)",
      bgSubtle: "#FBF8FA",
    },
  },
  navy: {
    id: "navy",
    label: "Ink navy",
    description: "Traditional, trustworthy — without Bootstrap blue.",
    vars: {
      accent: "#243B5A",
      accentStrong: "#1A2D47",
      accentSoft: "#DDE4EE",
      accentRing: "rgba(36, 59, 90, 0.35)",
      bgSubtle: "#F7F9FC",
    },
  },
};

export const DEFAULT_THEME: ThemeId = "teal";

export function resolveTheme(id: string | null | undefined): ThemeDef {
  if (id && (THEME_IDS as readonly string[]).includes(id)) {
    return THEMES[id as ThemeId];
  }
  return THEMES[DEFAULT_THEME];
}

/**
 * Produce an inline style object that binds theme vars at a DOM scope.
 * Pass as `style={themeStyle(theme)}` on any element to scope a theme override.
 */
export function themeStyle(theme: ThemeDef | ThemeId): React.CSSProperties {
  const def = typeof theme === "string" ? resolveTheme(theme) : theme;
  return {
    // keys are CSS vars consumed by globals.css
    ["--accent" as string]: def.vars.accent,
    ["--accent-strong" as string]: def.vars.accentStrong,
    ["--accent-soft" as string]: def.vars.accentSoft,
    ["--accent-ring" as string]: def.vars.accentRing,
    ["--bg-subtle" as string]: def.vars.bgSubtle,
  };
}

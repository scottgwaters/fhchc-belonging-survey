import { z } from "zod";

/**
 * Copy shown on the respondent-facing welcome page (trust cards +
 * "How it works" principles section). Every string is admin-editable per
 * campaign; unset fields fall back to DEFAULT_WELCOME_COPY.
 */
export interface TrustCardCopy {
  title: string;
  body: string;
}

export interface PrincipleCopy {
  eyebrow: string;
  title: string;
  body: string;
}

export interface WelcomeCopy {
  trustCards: [TrustCardCopy, TrustCardCopy, TrustCardCopy];
  principlesEyebrow: string;
  principlesTitle: string;
  principlesIntro: string;
  principles: [PrincipleCopy, PrincipleCopy, PrincipleCopy, PrincipleCopy];
  readyTitle: string;
  readyBody: string;
}

export const DEFAULT_WELCOME_COPY: WelcomeCopy = {
  trustCards: [
    {
      title: "Confidential",
      body: "Individual responses are never shared with your manager or team.",
    },
    {
      title: "Four minutes",
      body: "Five short steps. You can pause and pick up where you left off.",
    },
    {
      title: "Aggregated",
      body: "Patterns are reported company-wide, never tied to a person.",
    },
  ],
  principlesEyebrow: "How it works",
  principlesTitle: "Four principles. One goal.",
  principlesIntro:
    "A few principles guide how we run this survey — and how we treat what you tell us.",
  principles: [
    {
      eyebrow: "01 — Privacy",
      title: "Completely confidential.",
      body: "Responses are encrypted and stored separately from any identifying information.",
    },
    {
      eyebrow: "02 — Time",
      title: "Four minutes, five steps.",
      body: "Short by design. Each question is chosen to make your time produce meaningful insight.",
    },
    {
      eyebrow: "03 — Reporting",
      title: "Aggregated, never attributed.",
      body: "Patterns of five or more are reported. Individual answers are never traceable.",
    },
    {
      eyebrow: "04 — Impact",
      title: "Acted on, openly.",
      body: "Results are shared alongside the actions leadership commits to.",
    },
  ],
  readyTitle: "Ready when you are.",
  readyBody: "You can pause and return — your progress is saved.",
};

const trustCardSchema = z.object({
  title: z.string().min(1).max(60),
  body: z.string().min(1).max(300),
});

const principleSchema = z.object({
  eyebrow: z.string().min(1).max(40),
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(400),
});

export const welcomeCopySchema = z.object({
  trustCards: z.tuple([trustCardSchema, trustCardSchema, trustCardSchema]),
  principlesEyebrow: z.string().min(1).max(60),
  principlesTitle: z.string().min(1).max(120),
  principlesIntro: z.string().min(1).max(500),
  principles: z.tuple([
    principleSchema,
    principleSchema,
    principleSchema,
    principleSchema,
  ]),
  readyTitle: z.string().min(1).max(80),
  readyBody: z.string().min(1).max(200),
});

/**
 * Merge any stored override with the defaults. Missing fields fall back so
 * older campaigns keep rendering even if only a partial copy payload is set.
 */
export function resolveWelcomeCopy(stored: unknown): WelcomeCopy {
  if (!stored || typeof stored !== "object") return DEFAULT_WELCOME_COPY;
  const s = stored as Partial<WelcomeCopy>;
  const d = DEFAULT_WELCOME_COPY;
  return {
    trustCards: [
      { ...d.trustCards[0], ...(s.trustCards?.[0] ?? {}) },
      { ...d.trustCards[1], ...(s.trustCards?.[1] ?? {}) },
      { ...d.trustCards[2], ...(s.trustCards?.[2] ?? {}) },
    ],
    principlesEyebrow: s.principlesEyebrow ?? d.principlesEyebrow,
    principlesTitle: s.principlesTitle ?? d.principlesTitle,
    principlesIntro: s.principlesIntro ?? d.principlesIntro,
    principles: [
      { ...d.principles[0], ...(s.principles?.[0] ?? {}) },
      { ...d.principles[1], ...(s.principles?.[1] ?? {}) },
      { ...d.principles[2], ...(s.principles?.[2] ?? {}) },
      { ...d.principles[3], ...(s.principles?.[3] ?? {}) },
    ],
    readyTitle: s.readyTitle ?? d.readyTitle,
    readyBody: s.readyBody ?? d.readyBody,
  };
}

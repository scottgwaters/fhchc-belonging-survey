import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

// PRD §8.12 - production-data filter (excludes test + preview rows)
// Use everywhere reporting + exports query responses.
export function productionResponseWhere(campaignId: string): Prisma.ResponseWhereInput {
  return {
    campaignId,
    isComplete: true,
    isTestData: false,
    isPreview: false,
  };
}

export interface ReportContext {
  anonymityThreshold: number;
}

// Suppress any cell where n_substantive < threshold (BR-1, §8.14 floor).
// "n_substantive" excludes "Don't Know" rows — see calcAgreement.
export function suppress<T>(
  value: T,
  count: number,
  ctx: ReportContext
): T | { suppressed: true; reason: string } {
  if (count < ctx.anonymityThreshold) {
    return {
      suppressed: true,
      reason: `Suppressed — fewer than ${ctx.anonymityThreshold} substantive responses`,
    };
  }
  return value;
}

// ----------------------------------------------------------------------------
// Slider (0-100)
// ----------------------------------------------------------------------------

export interface SliderResult {
  type: "slider";
  n: number;
  mean: number | null;
  median: number | null;
  favorablePct: number | null; // % at-or-above favorable threshold
  favorableThreshold: number;
  reverseScored: boolean;
  // For multi-item sliders, per-item breakdown
  perItem?: Record<string, SliderResult>;
}

interface SliderItem {
  responseId: string;
  numeric: number | null;
  json: unknown;
}

export function calcSlider(
  rows: SliderItem[],
  reverseScore: boolean,
  favorableThreshold = 60,
  perItemReverse: string[] = []
): SliderResult {
  // Determine if multi-item (any row has json with object values)
  const hasMulti = rows.some(
    (r) => r.json && typeof r.json === "object" && !Array.isArray(r.json)
  );

  if (hasMulti) {
    const itemValues: Record<string, number[]> = {};
    for (const r of rows) {
      if (!r.json || typeof r.json !== "object") continue;
      for (const [k, v] of Object.entries(r.json as Record<string, unknown>)) {
        if (typeof v === "number") {
          (itemValues[k] = itemValues[k] || []).push(v);
        }
      }
    }
    const perItem: Record<string, SliderResult> = {};
    for (const [k, vals] of Object.entries(itemValues)) {
      const itemReverse = reverseScore || perItemReverse.includes(k);
      perItem[k] = computeSliderStats(vals, itemReverse, favorableThreshold);
    }
    // Aggregate across items: average of each item's mean (only when computable)
    const itemMeans = Object.values(perItem)
      .map((p) => p.mean)
      .filter((m): m is number => m !== null);
    return {
      type: "slider",
      n: rows.length,
      mean: itemMeans.length > 0 ? avg(itemMeans) : null,
      median: null,
      favorablePct: null,
      favorableThreshold,
      reverseScored: reverseScore,
      perItem,
    };
  }

  const values = rows
    .map((r) => r.numeric)
    .filter((n): n is number => n !== null);
  return computeSliderStats(values, reverseScore, favorableThreshold);
}

function computeSliderStats(
  values: number[],
  reverseScore: boolean,
  favorableThreshold: number
): SliderResult {
  const n = values.length;
  if (n === 0) {
    return {
      type: "slider",
      n: 0,
      mean: null,
      median: null,
      favorablePct: null,
      favorableThreshold,
      reverseScored: reverseScore,
    };
  }
  const adjusted = reverseScore ? values.map((v) => 100 - v) : values;
  const favorableCount = adjusted.filter((v) => v >= favorableThreshold).length;
  return {
    type: "slider",
    n,
    mean: round1(avg(adjusted)),
    median: median(adjusted),
    favorablePct: pct(favorableCount, n),
    favorableThreshold,
    reverseScored: reverseScore,
  };
}

function avg(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function pct(num: number, denom: number): number {
  return Math.round((num / denom) * 1000) / 10;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ----------------------------------------------------------------------------
// Single-select agreement / frequency
// ----------------------------------------------------------------------------

export interface SelectResult {
  type: "single_select";
  n: number; // total responses
  nAnswered: number; // n excluding "Don't Know" — used for percentages (PRD §8.14)
  nDontKnow: number;
  countsByOption: Record<string, number>;
  favorablePct: number | null;
  favorableOptions: string[];
  reverseScored: boolean;
}

const AGREE_FAVORABLE = ["Agree", "Strongly AGREE"];
const AGREE_UNFAVORABLE = ["Disagree", "Strongly DISAGREE"];
const FREQ_FAVORABLE_DEFAULT = ["Often", "Daily or almost", "Weekly", "Multiple times"];
const FREQ_FAVORABLE_REVERSE = ["Never", "Rarely", "1 or 2 times"];
const DONT_KNOW = "Don't Know";

export function calcSelect(
  rows: { value: string }[],
  options: string[],
  reverseScore: boolean,
  configFavorableOptions?: string[]
): SelectResult {
  const counts: Record<string, number> = {};
  for (const o of options) counts[o] = 0;
  let dk = 0;
  for (const r of rows) {
    if (r.value === DONT_KNOW || r.value === "Don't know") {
      dk++;
      continue;
    }
    counts[r.value] = (counts[r.value] ?? 0) + 1;
  }
  const nAnswered = rows.length - dk;

  // Determine favorable bucket
  let favorable: string[];
  if (configFavorableOptions && configFavorableOptions.length) {
    favorable = configFavorableOptions;
  } else {
    const isAgreement = options.includes("Agree") || options.includes("Strongly AGREE");
    if (isAgreement) {
      favorable = reverseScore ? AGREE_UNFAVORABLE : AGREE_FAVORABLE;
    } else {
      favorable = reverseScore ? FREQ_FAVORABLE_REVERSE : FREQ_FAVORABLE_DEFAULT;
    }
  }
  const favorableCount = favorable.reduce(
    (s, opt) => s + (counts[opt] ?? 0),
    0
  );

  return {
    type: "single_select",
    n: rows.length,
    nAnswered,
    nDontKnow: dk,
    countsByOption: counts,
    favorablePct: nAnswered > 0 ? pct(favorableCount, nAnswered) : null,
    favorableOptions: favorable,
    reverseScored: reverseScore,
  };
}

// ----------------------------------------------------------------------------
// Multi-select
// ----------------------------------------------------------------------------

export interface MultiSelectResult {
  type: "multi_select";
  n: number;
  countsByOption: Record<string, number>;
  otherCount: number;
}

export function calcMultiSelect(
  rows: { json: unknown }[],
  options: string[]
): MultiSelectResult {
  const counts: Record<string, number> = {};
  for (const o of options) counts[o] = 0;
  let other = 0;
  for (const r of rows) {
    const obj = r.json as { selected?: string[]; other_text?: string } | null;
    if (!obj) continue;
    for (const sel of obj.selected ?? []) {
      counts[sel] = (counts[sel] ?? 0) + 1;
      if (sel === "Other" && obj.other_text) other++;
    }
  }
  return {
    type: "multi_select",
    n: rows.length,
    countsByOption: counts,
    otherCount: other,
  };
}

// ----------------------------------------------------------------------------
// Top-level: per-question report for a campaign
// ----------------------------------------------------------------------------

export interface LikertGridResult {
  type: "likert_grid";
  n: number;
  perStatement: Record<
    string,
    { label: string; result: SelectResult | { suppressed: true; reason: string } }
  >;
}

export interface NumericResult {
  type: "numeric";
  n: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
}

export interface RawCountResult {
  type: "date" | "ranking";
  n: number;
}

export type QuestionReport =
  | (SliderResult & { questionId: string; metricCode: string | null; prompt: string })
  | (SelectResult & { questionId: string; metricCode: string | null; prompt: string })
  | (MultiSelectResult & { questionId: string; metricCode: string | null; prompt: string })
  | (LikertGridResult & { questionId: string; metricCode: string | null; prompt: string })
  | (NumericResult & { questionId: string; metricCode: string | null; prompt: string })
  | (RawCountResult & { questionId: string; metricCode: string | null; prompt: string })
  | {
      type: "open_text";
      questionId: string;
      metricCode: string | null;
      prompt: string;
      n: number;
    }
  | {
      type: "suppressed";
      questionId: string;
      metricCode: string | null;
      prompt: string;
      reason: string;
    };

export function calcLikertGrid(
  rows: { json: unknown }[],
  statements: { key: string; label: string }[],
  scale: string[],
  reverseScore: boolean,
  ctx: ReportContext,
  configFavorableOptions?: string[]
): LikertGridResult {
  const perStatement: LikertGridResult["perStatement"] = {};
  for (const s of statements) {
    const stmtRows: { value: string }[] = [];
    for (const r of rows) {
      const obj = (r.json ?? {}) as Record<string, string>;
      const v = obj[s.key];
      if (typeof v === "string" && v.length > 0) stmtRows.push({ value: v });
    }
    const res = calcSelect(stmtRows, scale, reverseScore, configFavorableOptions);
    const supp = suppress(res, res.nAnswered, ctx);
    perStatement[s.key] = {
      label: s.label,
      result: "suppressed" in supp ? { suppressed: true, reason: supp.reason } : res,
    };
  }
  return { type: "likert_grid", n: rows.length, perStatement };
}

export function calcNumeric(rows: { numeric: number | null }[]): NumericResult {
  const values = rows
    .map((r) => r.numeric)
    .filter((n): n is number => typeof n === "number" && !Number.isNaN(n));
  if (values.length === 0) {
    return { type: "numeric", n: 0, mean: null, median: null, min: null, max: null };
  }
  return {
    type: "numeric",
    n: values.length,
    mean: round1(avg(values)),
    median: median(values),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export async function computeCampaignReport(
  campaignId: string
): Promise<{
  campaign: { id: string; name: string; anonymityThreshold: number; status: string };
  totals: { invited: number; completed: number; emt: number; nonEmt: number };
  questions: QuestionReport[];
}> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, name: true, anonymityThreshold: true, status: true },
  });
  if (!campaign) throw new Error("Campaign not found");

  const ctx: ReportContext = { anonymityThreshold: campaign.anonymityThreshold };

  const invited = await prisma.distributionRecipient.count({
    where: { campaignId, deletedAt: null },
  });
  const responses = await prisma.response.findMany({
    where: productionResponseWhere(campaignId),
    select: { id: true, isEmtFlagged: true },
  });
  const responseIds = responses.map((r) => r.id);
  const emtIds = new Set(responses.filter((r) => r.isEmtFlagged).map((r) => r.id));

  const totals = {
    invited,
    completed: responses.length,
    emt: emtIds.size,
    nonEmt: responses.length - emtIds.size,
  };

  // Latest schema's active questions
  const schema = await prisma.questionSchema.findFirst({
    where: { campaignId },
    orderBy: { createdAt: "desc" },
    include: {
      questions: {
        where: { activeStatus: "active" },
        orderBy: [{ sectionKey: "asc" }, { displayOrder: "asc" }],
      },
    },
  });
  const questions = schema?.questions ?? [];

  // Bulk-load all response items in one pass
  const items = await prisma.responseItem.findMany({
    where: { responseId: { in: responseIds } },
    select: {
      responseId: true,
      questionId: true,
      valueText: true,
      valueNumber: true,
      valueJson: true,
    },
  });
  const itemsByQ = new Map<string, typeof items>();
  for (const it of items) {
    const list = itemsByQ.get(it.questionId) ?? [];
    list.push(it);
    itemsByQ.set(it.questionId, list);
  }

  const reports: QuestionReport[] = questions.map((q) => {
    const rows = itemsByQ.get(q.id) ?? [];
    const opts = (q.optionsJson ?? {}) as {
      options?: string[];
      favorableOptions?: string[];
    };
    const cfg = (q.reportingConfigJson ?? {}) as {
      favorableThreshold?: number;
      perItemReverse?: string[];
      favorableOptions?: string[];
    };

    if (q.responseType === "slider") {
      const r = calcSlider(
        rows.map((it) => ({
          responseId: it.responseId,
          numeric: it.valueNumber === null ? null : Number(it.valueNumber),
          json: it.valueJson,
        })),
        q.reverseScore,
        cfg.favorableThreshold ?? 60,
        cfg.perItemReverse ?? []
      );
      const supp = suppress(r, r.n, ctx);
      if ("suppressed" in supp) {
        return { type: "suppressed", questionId: q.id, metricCode: q.metricCode, prompt: q.prompt, reason: supp.reason };
      }
      return { ...r, questionId: q.id, metricCode: q.metricCode, prompt: q.prompt };
    }

    if (q.responseType === "single_select") {
      const r = calcSelect(
        rows.map((it) => ({ value: it.valueText ?? "" })),
        opts.options ?? [],
        q.reverseScore,
        cfg.favorableOptions ?? opts.favorableOptions
      );
      // PRD §8.14 - n_answered floor
      const supp = suppress(r, r.nAnswered, ctx);
      if ("suppressed" in supp) {
        return { type: "suppressed", questionId: q.id, metricCode: q.metricCode, prompt: q.prompt, reason: supp.reason };
      }
      return { ...r, questionId: q.id, metricCode: q.metricCode, prompt: q.prompt };
    }

    if (q.responseType === "multi_select") {
      const r = calcMultiSelect(
        rows.map((it) => ({ json: it.valueJson })),
        opts.options ?? []
      );
      const supp = suppress(r, r.n, ctx);
      if ("suppressed" in supp) {
        return { type: "suppressed", questionId: q.id, metricCode: q.metricCode, prompt: q.prompt, reason: supp.reason };
      }
      return { ...r, questionId: q.id, metricCode: q.metricCode, prompt: q.prompt };
    }

    if (q.responseType === "likert_grid") {
      const gridOpts = (q.optionsJson ?? {}) as {
        statements?: { key: string; label: string }[];
        scale?: string[];
      };
      const r = calcLikertGrid(
        rows.map((it) => ({ json: it.valueJson })),
        gridOpts.statements ?? [],
        gridOpts.scale ?? [],
        q.reverseScore,
        ctx,
        cfg.favorableOptions
      );
      const supp = suppress(r, r.n, ctx);
      if ("suppressed" in supp) {
        return { type: "suppressed", questionId: q.id, metricCode: q.metricCode, prompt: q.prompt, reason: supp.reason };
      }
      return { ...r, questionId: q.id, metricCode: q.metricCode, prompt: q.prompt };
    }

    if (q.responseType === "numeric") {
      const r = calcNumeric(
        rows.map((it) => ({
          numeric: it.valueNumber === null ? null : Number(it.valueNumber),
        }))
      );
      const supp = suppress(r, r.n, ctx);
      if ("suppressed" in supp) {
        return { type: "suppressed", questionId: q.id, metricCode: q.metricCode, prompt: q.prompt, reason: supp.reason };
      }
      return { ...r, questionId: q.id, metricCode: q.metricCode, prompt: q.prompt };
    }

    if (q.responseType === "date" || q.responseType === "ranking") {
      const supp = suppress(rows.length, rows.length, ctx);
      if (typeof supp === "object" && "suppressed" in supp) {
        return { type: "suppressed", questionId: q.id, metricCode: q.metricCode, prompt: q.prompt, reason: supp.reason };
      }
      return {
        type: q.responseType,
        questionId: q.id,
        metricCode: q.metricCode,
        prompt: q.prompt,
        n: rows.length,
      };
    }

    // open_text
    const supp = suppress(rows.length, rows.length, ctx);
    if (typeof supp === "object" && "suppressed" in supp) {
      return { type: "suppressed", questionId: q.id, metricCode: q.metricCode, prompt: q.prompt, reason: supp.reason };
    }
    return {
      type: "open_text",
      questionId: q.id,
      metricCode: q.metricCode,
      prompt: q.prompt,
      n: rows.length,
    };
  });

  return { campaign, totals, questions: reports };
}

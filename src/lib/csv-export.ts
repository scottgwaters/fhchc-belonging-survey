import { prisma } from "./db";
import { productionResponseWhere } from "./reporting";

// PRD §8.12 / BR-7 - clean CSV exports honoring suppression + production-data filter

function escapeField(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(row.map(escapeField).join(","));
  return lines.join("\n") + "\n";
}

// ----------------------------------------------------------------------------
// Per-response wide CSV: one row per response, one column per question
// ----------------------------------------------------------------------------

export async function exportResponsesWide(campaignId: string): Promise<string> {
  const schema = await prisma.questionSchema.findFirst({
    where: { campaignId },
    orderBy: { createdAt: "desc" },
    include: {
      questions: {
        where: { activeStatus: { in: ["active", "hidden", "retired"] } },
        orderBy: [{ sectionKey: "asc" }, { displayOrder: "asc" }],
      },
    },
  });
  const questions = schema?.questions ?? [];

  const responses = await prisma.response.findMany({
    where: productionResponseWhere(campaignId),
    select: {
      id: true,
      anonymousSessionId: true,
      submittedAt: true,
      isEmtFlagged: true,
      emtValidationSource: true,
      respondentLocationCode: true,
      respondentRoleCode: true,
      respondentRollupGroup: true,
    },
  });
  const responseIds = responses.map((r) => r.id);
  const items = await prisma.responseItem.findMany({
    where: { responseId: { in: responseIds } },
  });
  const byResp = new Map<string, Map<string, typeof items[number]>>();
  for (const it of items) {
    const m = byResp.get(it.responseId) ?? new Map();
    m.set(it.questionId, it);
    byResp.set(it.responseId, m);
  }

  const fixedHeaders = [
    "anonymous_session_id",
    "submitted_at",
    "is_emt_flagged",
    "emt_validation_source",
    "location_code",
    "role_code",
    "rollup_group",
  ];
  const questionHeaders = questions.map(
    (q) => `${q.metricCode ?? q.id} (${q.responseType})`
  );
  const headers = [...fixedHeaders, ...questionHeaders];

  const rows = responses.map((r) => {
    const items = byResp.get(r.id) ?? new Map();
    const fixed = [
      r.anonymousSessionId,
      r.submittedAt?.toISOString() ?? "",
      r.isEmtFlagged ? "true" : "false",
      r.emtValidationSource ?? "",
      r.respondentLocationCode ?? "",
      r.respondentRoleCode ?? "",
      r.respondentRollupGroup ?? "",
    ];
    const qVals = questions.map((q) => {
      const it = items.get(q.id);
      if (!it) return "";
      if (it.valueText !== null) return it.valueText;
      if (it.valueNumber !== null) return Number(it.valueNumber);
      if (it.valueJson !== null) return JSON.stringify(it.valueJson);
      return "";
    });
    return [...fixed, ...qVals];
  });

  return toCsv(headers, rows);
}

// ----------------------------------------------------------------------------
// Aggregated CSV: per-question summary stats with suppression
// ----------------------------------------------------------------------------

export async function exportAggregated(campaignId: string): Promise<string> {
  const { computeCampaignReport } = await import("./reporting");
  const report = await computeCampaignReport(campaignId);

  const headers = [
    "metric_code",
    "prompt",
    "type",
    "n",
    "mean",
    "favorable_pct",
    "favorable_threshold_or_options",
    "reverse_scored",
    "suppressed",
    "suppression_reason",
  ];
  const rows = report.questions.map((q) => {
    if (q.type === "suppressed") {
      return [q.metricCode ?? "", q.prompt, "—", "", "", "", "", "", "true", q.reason];
    }
    if (q.type === "slider") {
      return [
        q.metricCode ?? "",
        q.prompt,
        "slider",
        q.n,
        q.mean ?? "",
        q.favorablePct ?? "",
        `≥${q.favorableThreshold}`,
        q.reverseScored ? "true" : "false",
        "false",
        "",
      ];
    }
    if (q.type === "single_select") {
      return [
        q.metricCode ?? "",
        q.prompt,
        "single_select",
        q.n,
        "",
        q.favorablePct ?? "",
        q.favorableOptions.join("|"),
        q.reverseScored ? "true" : "false",
        "false",
        "",
      ];
    }
    if (q.type === "multi_select") {
      const top = Object.entries(q.countsByOption)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
      return [q.metricCode ?? "", q.prompt, "multi_select", q.n, "", "", top, "false", "false", ""];
    }
    if (q.type === "open_text") {
      return [q.metricCode ?? "", q.prompt, "open_text", q.n, "", "", "", "false", "false", ""];
    }
    if (q.type === "likert_grid") {
      const summary = Object.values(q.perStatement)
        .map((s) =>
          "suppressed" in s.result
            ? `${s.label}=suppressed`
            : `${s.label}=${s.result.favorablePct ?? "—"}%`
        )
        .join("; ");
      return [q.metricCode ?? "", q.prompt, "likert_grid", q.n, "", "", summary, "false", "false", ""];
    }
    if (q.type === "numeric") {
      return [
        q.metricCode ?? "",
        q.prompt,
        "numeric",
        q.n,
        q.mean ?? "",
        "",
        q.min !== null && q.max !== null ? `[${q.min}, ${q.max}]` : "",
        "false",
        "false",
        "",
      ];
    }
    if (q.type === "date" || q.type === "ranking") {
      return [q.metricCode ?? "", q.prompt, q.type, q.n, "", "", "", "false", "false", ""];
    }
    return ["", "", "", "", "", "", "", "", "", ""];
  });

  return toCsv(headers, rows);
}

// ----------------------------------------------------------------------------
// Comments CSV with PRD §8.11 segment-blanking rule for small segments
// ----------------------------------------------------------------------------

export async function exportComments(campaignId: string): Promise<string> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { anonymityThreshold: true },
  });
  const threshold = campaign?.anonymityThreshold ?? 5;

  const openTextQuestions = await prisma.question.findMany({
    where: {
      schema: { campaignId },
      responseType: "open_text",
    },
    select: { id: true, metricCode: true, prompt: true },
  });

  // Count responses per segment so we can blank segment columns when n < threshold
  const segmentCounts = new Map<string, number>();
  const responses = await prisma.response.findMany({
    where: productionResponseWhere(campaignId),
    select: {
      id: true,
      respondentLocationCode: true,
      respondentRoleCode: true,
      respondentRollupGroup: true,
      isEmtFlagged: true,
    },
  });
  for (const r of responses) {
    const key = `${r.respondentLocationCode ?? ""}|${r.respondentRoleCode ?? ""}|${r.respondentRollupGroup ?? ""}|${r.isEmtFlagged ? "EMT" : "GEN"}`;
    segmentCounts.set(key, (segmentCounts.get(key) ?? 0) + 1);
  }

  const items = await prisma.responseItem.findMany({
    where: {
      responseId: { in: responses.map((r) => r.id) },
      questionId: { in: openTextQuestions.map((q) => q.id) },
      valueText: { not: null },
    },
    select: { responseId: true, questionId: true, valueText: true },
  });
  const responseById = new Map(responses.map((r) => [r.id, r]));
  const questionById = new Map(openTextQuestions.map((q) => [q.id, q]));

  const headers = [
    "metric_code",
    "prompt",
    "comment",
    "location_code",
    "role_code",
    "rollup_group",
    "is_emt_flagged",
    "segment_n",
    "segment_blanked",
  ];

  const rows = items.map((it) => {
    const r = responseById.get(it.responseId)!;
    const q = questionById.get(it.questionId)!;
    const key = `${r.respondentLocationCode ?? ""}|${r.respondentRoleCode ?? ""}|${r.respondentRollupGroup ?? ""}|${r.isEmtFlagged ? "EMT" : "GEN"}`;
    const segmentN = segmentCounts.get(key) ?? 0;
    const blank = segmentN < threshold;
    return [
      q.metricCode ?? "",
      q.prompt,
      it.valueText ?? "",
      blank ? "" : (r.respondentLocationCode ?? ""),
      blank ? "" : (r.respondentRoleCode ?? ""),
      blank ? "" : (r.respondentRollupGroup ?? ""),
      blank ? "" : (r.isEmtFlagged ? "true" : "false"),
      segmentN,
      blank ? "true" : "false",
    ];
  });

  return toCsv(headers, rows);
}

// ----------------------------------------------------------------------------
// Roll-up mapping CSV
// ----------------------------------------------------------------------------

export async function exportRollups(campaignId: string): Promise<string> {
  const rollups = await prisma.orgRollup.findMany({
    where: { campaignId },
    orderBy: [{ parentGroupCode: "asc" }, { rawGroupCode: "asc" }],
  });
  const headers = [
    "raw_group_code",
    "raw_group_label",
    "parent_group_code",
    "parent_group_label",
    "suppress_if_below_threshold",
  ];
  const rows = rollups.map((r) => [
    r.rawGroupCode,
    r.rawGroupLabel,
    r.parentGroupCode,
    r.parentGroupLabel,
    r.suppressIfBelowThreshold ? "true" : "false",
  ]);
  return toCsv(headers, rows);
}

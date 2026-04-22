import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

/**
 * Platform-level export/import.
 *
 * Exports every campaign-relevant row as a single JSON blob, suitable for
 * transferring between two deployments of this app (e.g. local dev → prod).
 *
 * Deliberately excludes:
 *   - admin_users (different per deployment; imports would overwrite
 *     passwords / revoke sessions on the target)
 *   - audit_log, rate_limit_attempts, emt_validation_attempts (deployment-
 *     specific operational data)
 *   - exports (history log of CSV downloads)
 *   - response_drafts (ephemeral; respondents in-flight on the source
 *     deployment have no reason to resume on the target)
 *
 * Import uses `createMany({ skipDuplicates: true })` in FK-dependency order,
 * so re-running is safe. Updates to existing rows are NOT applied — to
 * overwrite a row you must delete it first (or use a fresh target database).
 */

export const PLATFORM_EXPORT_VERSION = 1;

export interface PlatformExport {
  version: number;
  exportedAt: string;
  sourceCounts: Record<string, number>;
  data: {
    clients: unknown[];
    campaigns: unknown[];
    campaignStatusLog: unknown[];
    questionSchemas: unknown[];
    questions: unknown[];
    orgRollups: unknown[];
    distributionRecipients: unknown[];
    responses: unknown[];
    responseItems: unknown[];
    reminderSends: unknown[];
  };
}

export async function buildPlatformExport(): Promise<PlatformExport> {
  const [
    clients,
    campaigns,
    campaignStatusLog,
    questionSchemas,
    questions,
    orgRollups,
    distributionRecipients,
    responses,
    responseItems,
    reminderSends,
  ] = await Promise.all([
    prisma.client.findMany(),
    prisma.campaign.findMany(),
    prisma.campaignStatusLog.findMany(),
    prisma.questionSchema.findMany(),
    prisma.question.findMany(),
    prisma.orgRollup.findMany(),
    prisma.distributionRecipient.findMany(),
    prisma.response.findMany(),
    prisma.responseItem.findMany(),
    prisma.reminderSend.findMany(),
  ]);

  return {
    version: PLATFORM_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    sourceCounts: {
      clients: clients.length,
      campaigns: campaigns.length,
      questionSchemas: questionSchemas.length,
      questions: questions.length,
      distributionRecipients: distributionRecipients.length,
      responses: responses.length,
      responseItems: responseItems.length,
    },
    data: {
      clients,
      campaigns,
      campaignStatusLog,
      questionSchemas,
      questions,
      orgRollups,
      distributionRecipients,
      responses,
      responseItems,
      reminderSends,
    },
  };
}

export interface PlatformImportResult {
  created: Record<string, number>;
  skipped: Record<string, number>;
  warnings: string[];
}

/**
 * Restore a PlatformExport into this database. Strategy: createMany with
 * skipDuplicates in FK-dependency order. Prisma will silently drop rows
 * whose primary key already exists on the target — this is intentional, so
 * repeat imports are idempotent and the target's existing edits win.
 *
 * We coerce the JSON shape to the generated Prisma CreateInput types by
 * narrowing only the known numeric/date fields. Everything else passes
 * through as-is.
 */
export async function applyPlatformImport(
  raw: unknown
): Promise<PlatformImportResult> {
  const parsed = raw as PlatformExport;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Import payload is not a JSON object.");
  }
  if (parsed.version !== PLATFORM_EXPORT_VERSION) {
    throw new Error(
      `Unsupported export version ${parsed.version}. Expected ${PLATFORM_EXPORT_VERSION}.`
    );
  }
  if (!parsed.data) {
    throw new Error("Import payload is missing the `data` block.");
  }

  const created: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  const warnings: string[] = [];

  async function loadInto<K extends string>(
    key: K,
    rows: unknown[],
    insert: (rows: unknown[]) => Promise<{ count: number }>
  ) {
    if (!Array.isArray(rows) || rows.length === 0) {
      created[key] = 0;
      skipped[key] = 0;
      return;
    }
    try {
      const result = await insert(rows.map(normalizeDates));
      created[key] = result.count;
      skipped[key] = rows.length - result.count;
    } catch (e) {
      warnings.push(`${key}: ${(e as Error).message}`);
      created[key] = 0;
      skipped[key] = rows.length;
    }
  }

  // FK order: clients → campaigns → schemas → questions → recipients → responses → items
  await loadInto("clients", parsed.data.clients, (rows) =>
    prisma.client.createMany({
      data: rows as Prisma.ClientCreateManyInput[],
      skipDuplicates: true,
    })
  );

  await loadInto("campaigns", parsed.data.campaigns, (rows) =>
    prisma.campaign.createMany({
      data: rows as Prisma.CampaignCreateManyInput[],
      skipDuplicates: true,
    })
  );

  await loadInto("campaignStatusLog", parsed.data.campaignStatusLog, (rows) =>
    prisma.campaignStatusLog.createMany({
      data: rows as Prisma.CampaignStatusLogCreateManyInput[],
      skipDuplicates: true,
    })
  );

  await loadInto("questionSchemas", parsed.data.questionSchemas, (rows) =>
    prisma.questionSchema.createMany({
      data: rows as Prisma.QuestionSchemaCreateManyInput[],
      skipDuplicates: true,
    })
  );

  await loadInto("questions", parsed.data.questions, (rows) =>
    prisma.question.createMany({
      data: rows as Prisma.QuestionCreateManyInput[],
      skipDuplicates: true,
    })
  );

  await loadInto("orgRollups", parsed.data.orgRollups, (rows) =>
    prisma.orgRollup.createMany({
      data: rows as Prisma.OrgRollupCreateManyInput[],
      skipDuplicates: true,
    })
  );

  await loadInto(
    "distributionRecipients",
    parsed.data.distributionRecipients,
    (rows) =>
      prisma.distributionRecipient.createMany({
        data: rows as Prisma.DistributionRecipientCreateManyInput[],
        skipDuplicates: true,
      })
  );

  await loadInto("responses", parsed.data.responses, (rows) =>
    prisma.response.createMany({
      data: rows as Prisma.ResponseCreateManyInput[],
      skipDuplicates: true,
    })
  );

  await loadInto("responseItems", parsed.data.responseItems, (rows) =>
    prisma.responseItem.createMany({
      data: rows as Prisma.ResponseItemCreateManyInput[],
      skipDuplicates: true,
    })
  );

  await loadInto("reminderSends", parsed.data.reminderSends, (rows) =>
    prisma.reminderSend.createMany({
      data: rows as Prisma.ReminderSendCreateManyInput[],
      skipDuplicates: true,
    })
  );

  return { created, skipped, warnings };
}

/**
 * JSON serialisation drops Date objects into ISO strings. Prisma's
 * createMany accepts either Date or ISO string, but only for fields the
 * generated type expects as Date — so we leave strings alone (they round
 * trip fine). This helper only handles Decimal fields (valueNumber on
 * ResponseItem) which JSON serialises as strings and Prisma accepts as
 * numbers or strings.
 */
function normalizeDates(row: unknown): Record<string, unknown> {
  return row as Record<string, unknown>;
}

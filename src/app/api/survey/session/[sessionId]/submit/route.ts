import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * POST /api/survey/session/[sessionId]/submit
 *
 * PRD §8.3 - Submit-time atomic transaction:
 *   1. Insert `responses` row (with the same anonymous_session_id from the draft)
 *   2. Insert all `response_items` from the draft payload
 *   3. Set distribution_recipients.completed_at = now()
 *   4. Delete the response_drafts row
 *
 * If the transaction fails, all four operations roll back. After commit, no
 * column or FK in `responses` references `distribution_recipients`.
 *
 * Idempotency (PRD §23.3): if the same session_id submits twice, the second
 * request returns 200 with "already submitted" — no duplicate rows.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  // Idempotency check: if a Response with this session ID exists, return success
  const existing = await prisma.response.findUnique({
    where: { anonymousSessionId: sessionId },
  });
  if (existing) {
    return NextResponse.json({
      ok: true,
      alreadySubmitted: true,
      responseId: existing.id,
    });
  }

  const draft = await prisma.responseDraft.findFirst({
    where: { anonymousSessionId: sessionId },
  });
  if (!draft) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Pull the recipient (by token hash) for denormalized segment fields and
  // the trusted-separation flag flip. After this transaction, the recipient
  // row's completedAt is the only signal that this token was used; no
  // `responses` row will reference recipient.id.
  const recipient = await prisma.distributionRecipient.findUnique({
    where: { inviteTokenHash: draft.inviteTokenHash },
    select: {
      id: true,
      isEmtExpected: true,
      locationCode: true,
      roleCode: true,
      expectedRollupGroup: true,
    },
  });

  // Resolve question IDs in the latest schema so we can write response_items
  const schema = await prisma.questionSchema.findFirst({
    where: { campaignId: draft.campaignId },
    orderBy: { createdAt: "desc" },
    include: {
      questions: { where: { activeStatus: "active" } },
    },
  });

  const questionsById = new Map(
    (schema?.questions ?? []).map((q) => [q.id, q])
  );

  let body: { responseItems?: Record<string, unknown> } = {};
  try {
    body = (await req.json().catch(() => ({}))) as typeof body;
  } catch {
    body = {};
  }

  // Final payload = whatever the client just sent, falling back to the draft
  const payload =
    (body.responseItems as Record<string, unknown>) ??
    (draft.responseItemsJson as Record<string, unknown>) ??
    {};

  type ItemRow = {
    questionId: string;
    valueText: string | null;
    valueNumber: Prisma.Decimal | null;
    valueJson: Prisma.InputJsonValue | null;
  };
  const itemRows: ItemRow[] = [];

  for (const [questionId, raw] of Object.entries(payload)) {
    const q = questionsById.get(questionId);
    if (!q) continue; // unknown question id — silently drop (mid-campaign retire)
    if (raw === null || raw === undefined || raw === "") continue;

    let valueText: string | null = null;
    let valueNumber: Prisma.Decimal | null = null;
    let valueJson: Prisma.InputJsonValue | null = null;

    if (q.responseType === "slider") {
      // Either a single number or { [itemKey]: number }
      if (typeof raw === "number") {
        valueNumber = new Prisma.Decimal(raw);
      } else if (typeof raw === "object") {
        valueJson = raw as Prisma.InputJsonValue;
      }
    } else if (q.responseType === "single_select") {
      valueText = String(raw);
    } else if (q.responseType === "multi_select") {
      // { selected: string[], other_text?: string }
      valueJson = raw as Prisma.InputJsonValue;
    } else if (q.responseType === "open_text") {
      valueText = String(raw);
    } else if (q.responseType === "numeric") {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) continue;
      valueNumber = new Prisma.Decimal(n);
    } else if (q.responseType === "date") {
      valueText = String(raw);
    } else if (q.responseType === "likert_grid" || q.responseType === "ranking") {
      valueJson = raw as Prisma.InputJsonValue;
    } else {
      valueJson = raw as Prisma.InputJsonValue;
    }

    itemRows.push({ questionId, valueText, valueNumber, valueJson });
  }

  const result = await prisma.$transaction(async (tx) => {
    const response = await tx.response.create({
      data: {
        campaignId: draft.campaignId,
        anonymousSessionId: sessionId,
        submittedAt: new Date(),
        isComplete: true,
        // PRD §8.8 - is_emt_flagged is set ONLY when validation source was
        // code/token/manual. role_self_select alone never flips this flag.
        isEmtFlagged: draft.isEmtFlagged,
        emtValidationSource: draft.emtValidationSource,
        respondentLocationCode: recipient?.locationCode ?? null,
        respondentRoleCode: recipient?.roleCode ?? null,
        respondentRollupGroup: recipient?.expectedRollupGroup ?? null,
        items: {
          create: itemRows.map((r) => ({
            questionId: r.questionId,
            valueText: r.valueText,
            valueNumber: r.valueNumber,
            valueJson: r.valueJson === null ? Prisma.JsonNull : r.valueJson,
          })),
        },
      },
    });

    if (recipient) {
      await tx.distributionRecipient.update({
        where: { id: recipient.id },
        data: { completedAt: new Date() },
      });
    }

    await tx.responseDraft.delete({ where: { id: draft.id } });

    return response;
  });

  return NextResponse.json({
    ok: true,
    responseId: result.id,
    itemCount: itemRows.length,
  });
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getSession, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { questionUpdateSchema } from "@/lib/validation/question";

const TRACKED_FIELDS = [
  "prompt",
  "helpText",
  "responseType",
  "required",
  "optionsJson",
  "parentQuestionId",
  "showIfParentValue",
  "reverseScore",
  "reportingConfigJson",
  "activeStatus",
  "comparableToPrior",
  "metricCode",
  "sectionKey",
  "displayOrder",
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const { id: campaignId, questionId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!hasRole(session.user.role, "campaign_admin")) {
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = questionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const existing = await prisma.question.findUnique({
    where: { id: questionId },
    include: { schema: true },
  });
  if (!existing || existing.schema.campaignId !== campaignId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates = parsed.data;

  // Build edit-history rows for tracked fields that actually changed
  type Row = { fieldChanged: string; oldValue: string | null; newValue: string | null };
  const historyRows: Row[] = [];
  const stringify = (v: unknown) =>
    v === null || v === undefined ? null : typeof v === "string" ? v : JSON.stringify(v);

  for (const f of TRACKED_FIELDS) {
    if (!(f in updates)) continue;
    const oldV = (existing as unknown as Record<string, unknown>)[f];
    const newV = (updates as unknown as Record<string, unknown>)[f];
    if (JSON.stringify(oldV) === JSON.stringify(newV)) continue;
    historyRows.push({
      fieldChanged: f,
      oldValue: stringify(oldV),
      newValue: stringify(newV),
    });
  }

  // Compute deactivatedAt automatically when going active→hidden/retired
  const goingInactive =
    updates.activeStatus !== undefined &&
    updates.activeStatus !== "active" &&
    existing.activeStatus === "active";
  const goingActive =
    updates.activeStatus === "active" && existing.activeStatus !== "active";

  const updated = await prisma.$transaction(async (tx) => {
    const q = await tx.question.update({
      where: { id: questionId },
      data: {
        ...(updates.prompt !== undefined && { prompt: updates.prompt }),
        ...(updates.helpText !== undefined && { helpText: updates.helpText }),
        ...(updates.responseType !== undefined && { responseType: updates.responseType }),
        ...(updates.required !== undefined && { required: updates.required }),
        ...(updates.optionsJson !== undefined && {
          optionsJson: (updates.optionsJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        }),
        ...(updates.parentQuestionId !== undefined && {
          parentQuestionId: updates.parentQuestionId,
        }),
        ...(updates.showIfParentValue !== undefined && {
          showIfParentValue: updates.showIfParentValue,
        }),
        ...(updates.reverseScore !== undefined && { reverseScore: updates.reverseScore }),
        ...(updates.reportingConfigJson !== undefined && {
          reportingConfigJson: (updates.reportingConfigJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        }),
        ...(updates.activeStatus !== undefined && { activeStatus: updates.activeStatus }),
        ...(updates.comparableToPrior !== undefined && {
          comparableToPrior: updates.comparableToPrior,
        }),
        ...(updates.metricCode !== undefined && { metricCode: updates.metricCode }),
        ...(updates.sectionKey !== undefined && { sectionKey: updates.sectionKey }),
        ...(updates.displayOrder !== undefined && { displayOrder: updates.displayOrder }),
        ...(goingInactive && { deactivatedAt: new Date() }),
        ...(goingActive && { deactivatedAt: null }),
      },
    });

    for (const row of historyRows) {
      await tx.questionEditHistory.create({
        data: {
          questionId,
          fieldChanged: row.fieldChanged,
          oldValue: row.oldValue,
          newValue: row.newValue,
          changedByUserId: session.user.id,
        },
      });
    }

    return q;
  });

  await createAuditLog({
    actorUserId: session.user.id,
    actionType: "question.update",
    entityType: "question",
    entityId: questionId,
    metadata: { campaignId, fields: historyRows.map((r) => r.fieldChanged) },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const { id: campaignId, questionId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!hasRole(session.user.role, "campaign_admin")) {
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 });
  }

  const existing = await prisma.question.findUnique({
    where: { id: questionId },
    include: { schema: true, responseItems: { take: 1 } },
  });
  if (!existing || existing.schema.campaignId !== campaignId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If responses already reference this question, soft-delete (retire) per PRD §8.16
  if (existing.responseItems.length > 0) {
    await prisma.question.update({
      where: { id: questionId },
      data: { activeStatus: "retired", deactivatedAt: new Date() },
    });
    await createAuditLog({
      actorUserId: session.user.id,
      actionType: "question.update",
      entityType: "question",
      entityId: questionId,
      metadata: { campaignId, softDelete: true, reason: "has_responses" },
    });
    return NextResponse.json({ retired: true });
  }

  // Hard delete only if no responses reference it AND no children depend on it
  const hasChildren = await prisma.question.count({
    where: { parentQuestionId: questionId },
  });
  if (hasChildren > 0) {
    return NextResponse.json(
      { error: "Cannot delete: other questions depend on this one as parent" },
      { status: 400 }
    );
  }

  await prisma.question.delete({ where: { id: questionId } });
  await createAuditLog({
    actorUserId: session.user.id,
    actionType: "question.delete",
    entityType: "question",
    entityId: questionId,
    metadata: { campaignId },
  });

  return NextResponse.json({ deleted: true });
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getSession, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { questionCreateSchema } from "@/lib/validation/question";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;
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
  const parsed = questionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // Confirm the schema belongs to this campaign
  const schema = await prisma.questionSchema.findFirst({
    where: { id: parsed.data.schemaId, campaignId },
  });
  if (!schema) {
    return NextResponse.json(
      { error: "Schema does not belong to campaign" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const created = await prisma.question.create({
    data: {
      schemaId: data.schemaId,
      metricCode: data.metricCode ?? null,
      sectionKey: data.sectionKey,
      displayOrder: data.displayOrder,
      prompt: data.prompt,
      helpText: data.helpText ?? null,
      responseType: data.responseType,
      required: data.required,
      optionsJson: (data.optionsJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      parentQuestionId: data.parentQuestionId ?? null,
      showIfParentValue: data.showIfParentValue ?? null,
      reverseScore: data.reverseScore,
      reportingConfigJson: (data.reportingConfigJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      activeStatus: data.activeStatus,
      comparableToPrior: data.comparableToPrior,
    },
  });

  await createAuditLog({
    actorUserId: session.user.id,
    actionType: "question.create",
    entityType: "question",
    entityId: created.id,
    metadata: { campaignId, sectionKey: created.sectionKey, prompt: created.prompt },
  });

  return NextResponse.json(created, { status: 201 });
}

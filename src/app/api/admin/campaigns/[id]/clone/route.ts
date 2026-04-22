import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getSession, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { campaignCloneSchema } from "@/lib/validation/campaign";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const parsed = campaignCloneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const source = await prisma.campaign.findUnique({
    where: { id },
    include: {
      questionSchemas: { include: { questions: true } },
      orgRollups: true,
    },
  });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // PRD §8.19 - clone preserves question metric_codes; resets dates/status/recipients/responses
  const cloned = await prisma.$transaction(async (tx) => {
    const campaign = await tx.campaign.create({
      data: {
        clientId: parsed.data.targetClientId,
        year: parsed.data.newYear,
        name: parsed.data.newName,
        timezone: source.timezone,
        status: "draft",
        introCopy: source.introCopy,
        invitationCopy: source.invitationCopy,
        reminderCopyJson: source.reminderCopyJson ?? Prisma.JsonNull,
        anonymityThreshold: source.anonymityThreshold,
        isTemplate: false,
        templateSourceId: source.id,
      },
    });

    for (const schema of source.questionSchemas) {
      const newSchema = await tx.questionSchema.create({
        data: {
          campaignId: campaign.id,
          versionName: schema.versionName,
          schemaJson: (schema.schemaJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      });

      // Two-pass: parents first, then children referencing parent IDs
      const idMap = new Map<string, string>();
      const parents = schema.questions.filter((q) => !q.parentQuestionId);
      const children = schema.questions.filter((q) => q.parentQuestionId);

      for (const q of parents) {
        const created = await tx.question.create({
          data: {
            schemaId: newSchema.id,
            metricCode: q.metricCode,
            sectionKey: q.sectionKey,
            displayOrder: q.displayOrder,
            prompt: q.prompt,
            helpText: q.helpText,
            responseType: q.responseType,
            required: q.required,
            optionsJson: q.optionsJson ?? Prisma.JsonNull,
            reverseScore: q.reverseScore,
            reportingConfigJson: q.reportingConfigJson ?? Prisma.JsonNull,
            activeStatus: q.activeStatus,
            comparableToPrior: q.comparableToPrior,
          },
        });
        idMap.set(q.id, created.id);
      }

      for (const q of children) {
        const newParentId = q.parentQuestionId
          ? idMap.get(q.parentQuestionId)
          : null;
        await tx.question.create({
          data: {
            schemaId: newSchema.id,
            metricCode: q.metricCode,
            sectionKey: q.sectionKey,
            displayOrder: q.displayOrder,
            prompt: q.prompt,
            helpText: q.helpText,
            responseType: q.responseType,
            required: q.required,
            optionsJson: q.optionsJson ?? Prisma.JsonNull,
            parentQuestionId: newParentId ?? null,
            showIfParentValue: q.showIfParentValue,
            reverseScore: q.reverseScore,
            reportingConfigJson: q.reportingConfigJson ?? Prisma.JsonNull,
            activeStatus: q.activeStatus,
            comparableToPrior: q.comparableToPrior,
          },
        });
      }
    }

    for (const r of source.orgRollups) {
      await tx.orgRollup.create({
        data: {
          campaignId: campaign.id,
          rawGroupCode: r.rawGroupCode,
          rawGroupLabel: r.rawGroupLabel,
          parentGroupCode: r.parentGroupCode,
          parentGroupLabel: r.parentGroupLabel,
          suppressIfBelowThreshold: r.suppressIfBelowThreshold,
        },
      });
    }

    return campaign;
  });

  await createAuditLog({
    actorUserId: session.user.id,
    actionType: "campaign.clone",
    entityType: "campaign",
    entityId: cloned.id,
    metadata: { sourceCampaignId: source.id, name: cloned.name, year: cloned.year },
  });

  return NextResponse.json(cloned, { status: 201 });
}

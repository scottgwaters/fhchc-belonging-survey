import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/survey/session/[sessionId]
 *
 * Returns the full survey schema + draft state for the session. The session ID
 * is generated server-side and known only to the holder of the original token.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const draft = await prisma.responseDraft.findFirst({
    where: { anonymousSessionId: sessionId },
  });
  if (!draft) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: draft.campaignId },
    select: {
      id: true,
      name: true,
      status: true,
      introCopy: true,
      visibleCloseAt: true,
      anonymityThreshold: true,
      emtCodeHash: true,
    },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const campaignPublic = {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    introCopy: campaign.introCopy,
    visibleCloseAt: campaign.visibleCloseAt,
    anonymityThreshold: campaign.anonymityThreshold,
    emtCodeRequired: Boolean(campaign.emtCodeHash),
  };

  // Latest schema for the campaign, active questions only
  const schema = await prisma.questionSchema.findFirst({
    where: { campaignId: campaign.id },
    orderBy: { createdAt: "desc" },
    include: {
      questions: {
        where: { activeStatus: "active" },
        orderBy: [{ sectionKey: "asc" }, { displayOrder: "asc" }],
      },
    },
  });

  return NextResponse.json({
    campaign: campaignPublic,
    emt: {
      validated: draft.isEmtFlagged,
      attemptsRemaining: Math.max(0, 5 - draft.emtAttemptCount),
      locked: Boolean(draft.emtLockedAt),
    },
    schema: schema
      ? {
          id: schema.id,
          versionName: schema.versionName,
          questions: schema.questions.map((q) => ({
            id: q.id,
            metricCode: q.metricCode,
            sectionKey: q.sectionKey,
            displayOrder: q.displayOrder,
            prompt: q.prompt,
            helpText: q.helpText,
            responseType: q.responseType,
            required: q.required,
            optionsJson: q.optionsJson,
            parentQuestionId: q.parentQuestionId,
            showIfParentValue: q.showIfParentValue,
            reverseScore: q.reverseScore,
          })),
        }
      : null,
    draft: {
      responseItems: draft.responseItemsJson,
      sectionProgress: draft.sectionProgress,
      lastSavedAt: draft.lastSavedAt,
    },
  });
}

// silence unused import warning when running typecheck on partial edits
void NextResponse;

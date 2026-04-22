import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashInviteToken } from "@/lib/tokens";

/**
 * POST /api/survey/session/start
 *
 * PRD §8.3 / §23.1 - Creates (or returns existing) ResponseDraft for the token.
 * NEVER creates a row in `responses` until the user submits — this is the
 * trusted-separation invariant.
 *
 * Body: { token: string }
 */
export async function POST(req: NextRequest) {
  let body: { token?: string };
  try {
    body = (await req.json()) as { token?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const hash = hashInviteToken(token);

  const recipient = await prisma.distributionRecipient.findUnique({
    where: { inviteTokenHash: hash },
  });

  // Generic message to prevent enumeration
  if (!recipient || recipient.deletedAt) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }
  if (recipient.completedAt) {
    return NextResponse.json({ error: "Already submitted" }, { status: 410 });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: recipient.campaignId },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }
  if (campaign.status !== "live" && campaign.status !== "scheduled") {
    return NextResponse.json({ error: "Survey is not currently open" }, { status: 410 });
  }
  if (campaign.tokenExpiresAt && campaign.tokenExpiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 410 });
  }

  const existing = await prisma.responseDraft.findUnique({
    where: { inviteTokenHash: hash },
  });
  if (existing) {
    // Touch lastActivityAt on the recipient
    await prisma.distributionRecipient.update({
      where: { id: recipient.id },
      data: { lastActivityAt: new Date() },
    });
    return NextResponse.json({
      sessionId: existing.anonymousSessionId,
      resumed: true,
      responseItems: existing.responseItemsJson,
      sectionProgress: existing.sectionProgress,
    });
  }

  const sessionId = randomUUID();
  await prisma.$transaction(async (tx) => {
    await tx.responseDraft.create({
      data: {
        campaignId: campaign.id,
        inviteTokenHash: hash,
        anonymousSessionId: sessionId,
        responseItemsJson: {} as Prisma.InputJsonValue,
        sectionProgress: null,
      },
    });
    await tx.distributionRecipient.update({
      where: { id: recipient.id },
      data: { startedAt: new Date(), lastActivityAt: new Date() },
    });
  });

  return NextResponse.json({
    sessionId,
    resumed: false,
    responseItems: {},
    sectionProgress: null,
  });
}

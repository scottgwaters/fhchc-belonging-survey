import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { generateInviteToken, buildSurveyUrl } from "@/lib/tokens";
import {
  renderInvitationBody,
  renderInvitationHtml,
  sendEmail,
} from "@/lib/email";

interface SendBody {
  // If true, send to recipients who already have inviteSentAt (re-issues new tokens)
  resend?: boolean;
}

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

  let body: SendBody = {};
  try {
    body = (await req.json().catch(() => ({}))) as SendBody;
  } catch {
    body = {};
  }

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (campaign.status !== "live" && campaign.status !== "scheduled") {
    return NextResponse.json(
      { error: `Campaign must be scheduled or live to send invites (status: ${campaign.status})` },
      { status: 400 }
    );
  }

  const where = body.resend
    ? { campaignId: id, deletedAt: null }
    : {
        campaignId: id,
        deletedAt: null,
        inviteSentAt: null,
        completedAt: null,
        bounceStatus: null,
      };

  const recipients = await prisma.distributionRecipient.findMany({ where });

  if (recipients.length === 0) {
    return NextResponse.json({
      sent: 0,
      failed: 0,
      message: "No recipients eligible for invitation",
    });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  let sent = 0;
  let failed = 0;
  let dryRunFallback = 0;
  const failures: { recipientId: string; email: string; reason: string }[] = [];

  for (const recipient of recipients) {
    // Re-issue token on every send so any leaked old token becomes useless
    const token = generateInviteToken();
    const surveyUrl = buildSurveyUrl(baseUrl, token.raw);

    const ctx = {
      firstName: recipient.firstName,
      surveyUrl,
      closeDate: campaign.visibleCloseAt,
      campaignName: campaign.name,
      bodyTemplate: campaign.invitationCopy,
    };

    const result = await sendEmail({
      to: recipient.email,
      subject: `Your invitation: ${campaign.name}`,
      text: renderInvitationBody(ctx),
      html: renderInvitationHtml(ctx),
    });

    if (!result.ok) {
      failed++;
      failures.push({
        recipientId: recipient.id,
        email: recipient.email,
        reason: result.reason ?? "unknown",
      });
      continue;
    }

    await prisma.distributionRecipient.update({
      where: { id: recipient.id },
      data: {
        inviteTokenHash: token.hash,
        inviteSentAt: new Date(),
      },
    });
    sent++;
    if (!result.delivered) dryRunFallback++;
  }

  await createAuditLog({
    actorUserId: session.user.id,
    actionType: "distribution.send_invites",
    entityType: "campaign",
    entityId: id,
    metadata: {
      sent,
      failed,
      dryRunFallback,
      resend: body.resend ?? false,
    },
  });

  return NextResponse.json({
    sent,
    failed,
    dryRunFallback,
    failures: failures.slice(0, 50),
  });
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logCampaignStatusChange } from "@/lib/audit";
import { campaignStatusSchema, type CampaignStatus } from "@/lib/validation/campaign";
import {
  ConcurrencyConflictError,
  assertNotModified,
  findTransition,
  parseIfUnmodifiedSince,
} from "@/lib/campaigns";

export async function PATCH(
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

  const parsed = campaignStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const existing = await prisma.campaign.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    assertNotModified(existing.updatedAt, parseIfUnmodifiedSince(req));
  } catch (e) {
    if (e instanceof ConcurrencyConflictError) {
      return NextResponse.json(
        { error: "Conflict", currentUpdatedAt: e.currentUpdatedAt.toISOString() },
        { status: 409 }
      );
    }
    throw e;
  }

  const from = existing.status as CampaignStatus;
  const to = parsed.data.newStatus;
  const transition = findTransition(from, to);

  if (!transition) {
    return NextResponse.json(
      { error: `Transition ${from} → ${to} is not allowed` },
      { status: 400 }
    );
  }

  if (transition.warningRequired && !parsed.data.acknowledgedWarning) {
    return NextResponse.json(
      {
        error: "Warning acknowledgment required",
        warningMessage: transition.warningMessage,
        requiresAcknowledgement: true,
      },
      { status: 409 }
    );
  }

  // Atomic: update status + write status log + audit log
  await prisma.$transaction(async (tx) => {
    await tx.campaign.update({
      where: { id },
      data: { status: to },
    });
  });

  await logCampaignStatusChange(id, from, to, session.user.id, parsed.data.reason ?? undefined);

  const updated = await prisma.campaign.findUnique({ where: { id } });
  return NextResponse.json(updated);
}

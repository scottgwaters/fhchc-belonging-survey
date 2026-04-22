import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getSession, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { campaignUpdateSchema } from "@/lib/validation/campaign";
import {
  ConcurrencyConflictError,
  assertNotModified,
  defaultTokenExpiry,
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

  const parsed = campaignUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const existing = await prisma.campaign.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Status changes go through the dedicated /status endpoint
  if (
    "status" in (body as Record<string, unknown>) &&
    (body as Record<string, unknown>).status !== existing.status
  ) {
    return NextResponse.json(
      { error: "Use /status endpoint for status changes" },
      { status: 400 }
    );
  }

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

  const updates = parsed.data;
  const tokenExpiresAt =
    updates.tokenExpiresAt !== undefined
      ? updates.tokenExpiresAt
      : updates.visibleCloseAt
      ? defaultTokenExpiry(updates.visibleCloseAt)
      : undefined;

  try {
    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.year !== undefined && { year: updates.year }),
        ...(updates.timezone !== undefined && { timezone: updates.timezone }),
        ...(updates.startAt !== undefined && { startAt: updates.startAt }),
        ...(updates.visibleCloseAt !== undefined && {
          visibleCloseAt: updates.visibleCloseAt,
        }),
        ...(tokenExpiresAt !== undefined && { tokenExpiresAt }),
        ...(updates.introCopy !== undefined && { introCopy: updates.introCopy }),
        ...(updates.invitationCopy !== undefined && {
          invitationCopy: updates.invitationCopy,
        }),
        ...(updates.anonymityThreshold !== undefined && {
          anonymityThreshold: updates.anonymityThreshold,
        }),
        ...(updates.theme !== undefined && { theme: updates.theme }),
        ...(updates.logoUrl !== undefined && { logoUrl: updates.logoUrl }),
        ...(updates.logoAlt !== undefined && { logoAlt: updates.logoAlt }),
        ...(updates.welcomeCopyJson !== undefined && {
          welcomeCopyJson: updates.welcomeCopyJson ?? Prisma.JsonNull,
        }),
      },
    });

    await createAuditLog({
      actorUserId: session.user.id,
      actionType: "campaign.update",
      entityType: "campaign",
      entityId: updated.id,
      metadata: { fields: Object.keys(updates) },
    });

    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("Campaign update failed:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

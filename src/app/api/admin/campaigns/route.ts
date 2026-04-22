import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSession, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { campaignCreateSchema } from "@/lib/validation/campaign";
import { defaultTokenExpiry } from "@/lib/campaigns";

export async function POST(req: Request) {
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

  const parsed = campaignCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const tokenExpiresAt =
    data.tokenExpiresAt ??
    (data.visibleCloseAt ? defaultTokenExpiry(data.visibleCloseAt) : null);

  try {
    const campaign = await prisma.campaign.create({
      data: {
        clientId: data.clientId,
        year: data.year,
        name: data.name,
        timezone: data.timezone,
        startAt: data.startAt,
        visibleCloseAt: data.visibleCloseAt,
        tokenExpiresAt,
        introCopy: data.introCopy ?? null,
        invitationCopy: data.invitationCopy ?? null,
        anonymityThreshold: data.anonymityThreshold,
        theme: data.theme,
        logoUrl: data.logoUrl ?? null,
        logoAlt: data.logoAlt ?? null,
        welcomeCopyJson: data.welcomeCopyJson ?? undefined,
        isTemplate: data.isTemplate,
        templateSourceId: data.templateSourceId ?? null,
      },
    });

    await createAuditLog({
      actorUserId: session.user.id,
      actionType: "campaign.create",
      entityType: "campaign",
      entityId: campaign.id,
      metadata: { name: campaign.name, year: campaign.year },
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return NextResponse.json({ error: "Unknown clientId" }, { status: 400 });
    }
    console.error("Campaign create failed:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

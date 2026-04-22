import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { hashEmtCode, normalizeEmtCode } from "@/lib/tokens";

interface Body {
  code: string | null; // null clears
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  // PRD-aligned: only super_admin can set the EMT code
  if (!hasRole(session.user.role, "super_admin")) {
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let newHash: string | null = null;
  if (body.code !== null && body.code !== undefined && body.code !== "") {
    const normalized = normalizeEmtCode(body.code);
    if (normalized.length < 4 || normalized.length > 32) {
      return NextResponse.json(
        { error: "Code must be 4–32 characters after trim" },
        { status: 400 }
      );
    }
    newHash = hashEmtCode(normalized);
  }

  await prisma.campaign.update({
    where: { id },
    data: { emtCodeHash: newHash },
  });

  await createAuditLog({
    actorUserId: session.user.id,
    actionType: "campaign.update",
    entityType: "campaign",
    entityId: id,
    metadata: { fields: ["emtCodeHash"], cleared: newHash === null },
  });

  return NextResponse.json({ ok: true, configured: newHash !== null });
}

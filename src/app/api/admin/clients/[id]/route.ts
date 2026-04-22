import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

const clientUpdateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  logoUrl: z.string().url().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!hasRole(session.user.role, "super_admin")) {
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = clientUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const updated = await prisma.client.update({
    where: { id },
    data: parsed.data,
  });

  await createAuditLog({
    actorUserId: session.user.id,
    actionType: "admin.role_change",
    entityType: "admin_user",
    entityId: id,
    metadata: { kind: "client_updated", fields: Object.keys(parsed.data) },
  });

  return NextResponse.json(updated);
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession, hasRole, type AdminRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

const ROLES: AdminRole[] = ["super_admin", "campaign_admin", "viewer"];

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

  let body: { role?: string };
  try {
    body = (await req.json()) as { role?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const role = body.role as AdminRole | undefined;
  if (!role || !ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const target = await prisma.adminUser.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Prevent demoting the last super_admin
  if (target.role === "super_admin" && role !== "super_admin") {
    const otherSupers = await prisma.adminUser.count({
      where: { role: "super_admin", id: { not: id } },
    });
    if (otherSupers === 0) {
      return NextResponse.json(
        { error: "Cannot demote the last super_admin" },
        { status: 400 }
      );
    }
  }

  const previousRole = target.role;
  await prisma.adminUser.update({ where: { id }, data: { role } });

  await createAuditLog({
    actorUserId: session.user.id,
    actionType: "admin.role_change",
    entityType: "admin_user",
    entityId: id,
    metadata: { previousRole, newRole: role, targetEmail: target.email },
  });

  return NextResponse.json({ ok: true, role });
}

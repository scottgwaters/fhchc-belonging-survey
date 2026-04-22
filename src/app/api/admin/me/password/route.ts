import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

interface Body {
  currentPassword?: string;
  newPassword?: string;
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const newPassword = body.newPassword?.trim() ?? "";
  if (newPassword.length < 8 || newPassword.length > 128) {
    return NextResponse.json(
      { error: "Password must be 8–128 characters" },
      { status: 400 }
    );
  }

  const user = await prisma.adminUser.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // If the user already has a password (credentials account), require the current one.
  // Google-OAuth-only users (passwordHash = null) can set a password without it.
  if (user.passwordHash) {
    const current = body.currentPassword ?? "";
    if (!(await bcrypt.compare(current, user.passwordHash))) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }
  }

  await prisma.adminUser.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10) },
  });

  await createAuditLog({
    actorUserId: user.id,
    actionType: "admin.role_change",
    entityType: "admin_user",
    entityId: user.id,
    metadata: { action: "password_changed" },
  });

  return NextResponse.json({ ok: true });
}

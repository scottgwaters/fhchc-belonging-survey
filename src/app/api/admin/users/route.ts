import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getSession, hasRole, type AdminRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

const userCreateSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().max(120).optional().nullable(),
  role: z.enum(["super_admin", "campaign_admin", "viewer"]),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .optional()
    .nullable(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!hasRole(session.user.role, "super_admin")) {
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 });
  }

  const users = await prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      lastLoginAt: true,
      createdAt: true,
      passwordHash: true, // not returned; only used to compute hasPassword
    },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      hasPassword: u.passwordHash !== null,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    })),
  });
}

export async function POST(req: Request) {
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
  const parsed = userCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const passwordHash = parsed.data.password
    ? await bcrypt.hash(parsed.data.password, 10)
    : null;

  try {
    const created = await prisma.adminUser.create({
      data: {
        email,
        name: parsed.data.name ?? null,
        role: parsed.data.role as AdminRole,
        passwordHash,
      },
    });

    await createAuditLog({
      actorUserId: session.user.id,
      actionType: "admin.role_change",
      entityType: "admin_user",
      entityId: created.id,
      metadata: {
        kind: "user_created",
        email: created.email,
        role: created.role,
        passwordSet: passwordHash !== null,
      },
    });

    return NextResponse.json(
      {
        id: created.id,
        email: created.email,
        name: created.name,
        role: created.role,
        hasPassword: passwordHash !== null,
      },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "An admin user with that email already exists" },
        { status: 409 }
      );
    }
    throw e;
  }
}

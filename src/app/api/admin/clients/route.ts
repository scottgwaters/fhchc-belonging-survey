import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getSession, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

const clientCreateSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9][a-z0-9-]*$/, {
    message: "Slug must be lowercase letters, digits, and hyphens",
  }),
  status: z.enum(["active", "inactive"]).default("active"),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { campaigns: true } } },
  });
  return NextResponse.json({ clients });
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
  const parsed = clientCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const client = await prisma.client.create({ data: parsed.data });
    await createAuditLog({
      actorUserId: session.user.id,
      actionType: "campaign.create",
      entityType: "admin_user",
      entityId: client.id,
      metadata: { kind: "client_created", slug: client.slug, name: client.name },
    });
    return NextResponse.json(client, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "A client with that slug already exists" },
        { status: 409 }
      );
    }
    throw e;
  }
}

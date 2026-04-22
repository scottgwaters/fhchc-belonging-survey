import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import {
  exportResponsesWide,
  exportAggregated,
  exportComments,
  exportRollups,
} from "@/lib/csv-export";

const SUPPORTED = ["responses", "aggregated", "comments", "rollups"] as const;
type ExportKind = (typeof SUPPORTED)[number];

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

  const url = new URL(req.url);
  const kind = (url.searchParams.get("kind") ?? "responses") as ExportKind;
  if (!SUPPORTED.includes(kind)) {
    return NextResponse.json(
      { error: `Unsupported kind. Use: ${SUPPORTED.join(", ")}` },
      { status: 400 }
    );
  }

  let csv: string;
  switch (kind) {
    case "responses":
      csv = await exportResponsesWide(id);
      break;
    case "aggregated":
      csv = await exportAggregated(id);
      break;
    case "comments":
      csv = await exportComments(id);
      break;
    case "rollups":
      csv = await exportRollups(id);
      break;
  }

  // Record the export for audit history (storage_url is null since we stream)
  await prisma.export.create({
    data: {
      campaignId: id,
      exportType: kind,
      generatedBy: session.user.id,
    },
  });
  await createAuditLog({
    actorUserId: session.user.id,
    actionType: "export.generate",
    entityType: "campaign",
    entityId: id,
    metadata: { kind },
  });

  const filename = `${id}_${kind}_${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const exports = await prisma.export.findMany({
    where: { campaignId: id },
    orderBy: { generatedAt: "desc" },
    take: 50,
    include: { user: { select: { name: true, email: true } } },
  });
  return NextResponse.json({ exports });
}

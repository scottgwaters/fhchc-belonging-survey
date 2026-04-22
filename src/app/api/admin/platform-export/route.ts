import { NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { buildPlatformExport } from "@/lib/platform-transfer";

/**
 * GET /api/admin/platform-export
 *
 * Dumps every campaign-relevant row to JSON for cross-deployment migration.
 * Super-admin only — the payload includes identity-bearing recipient rows
 * and full response items.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!hasRole(session.user.role, "super_admin")) {
    return NextResponse.json({ error: "Super admin only" }, { status: 403 });
  }

  const payload = await buildPlatformExport();

  await createAuditLog({
    actorUserId: session.user.id,
    actionType: "platform.export",
    entityType: "platform",
    entityId: "export",
    metadata: payload.sourceCounts,
  });

  const filename = `belonging-index-export-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

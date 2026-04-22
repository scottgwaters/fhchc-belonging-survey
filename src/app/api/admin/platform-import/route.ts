import { NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { applyPlatformImport } from "@/lib/platform-transfer";

/**
 * POST /api/admin/platform-import
 *
 * Accepts a JSON body matching the PlatformExport shape and restores rows
 * that don't already exist (createMany + skipDuplicates per table in
 * FK-dependency order). Idempotent — re-running skips existing rows.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!hasRole(session.user.role, "super_admin")) {
    return NextResponse.json({ error: "Super admin only" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await applyPlatformImport(body);
    await createAuditLog({
      actorUserId: session.user.id,
      actionType: "platform.import",
      entityType: "platform",
      entityId: "import",
      metadata: result.created,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "Import failed" },
      { status: 400 }
    );
  }
}

// Body size — exports of a live campaign with many responses can be big.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
};

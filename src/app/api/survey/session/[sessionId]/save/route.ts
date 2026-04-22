import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * POST /api/survey/session/[sessionId]/save
 *
 * Auto-save endpoint (PRD §8.3). Body:
 * { responseItems: Record<questionId, value>, sectionProgress?: string }
 *
 * Updates the draft only — never touches the responses table.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  let body: { responseItems?: unknown; sectionProgress?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const draft = await prisma.responseDraft.findFirst({
    where: { anonymousSessionId: sessionId },
  });
  if (!draft) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const d = await tx.responseDraft.update({
      where: { id: draft.id },
      data: {
        responseItemsJson: (body.responseItems ?? {}) as Prisma.InputJsonValue,
        sectionProgress: body.sectionProgress ?? draft.sectionProgress,
      },
    });
    // Bump activity on the recipient so the reminder logic (PRD §8.10) can
    // exclude active drafts.
    await tx.distributionRecipient.updateMany({
      where: { inviteTokenHash: draft.inviteTokenHash },
      data: { lastActivityAt: new Date() },
    });
    return d;
  });

  return NextResponse.json({
    ok: true,
    lastSavedAt: updated.lastSavedAt.toISOString(),
  });
}

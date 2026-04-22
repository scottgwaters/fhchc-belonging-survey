import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { hashEmtCode, normalizeEmtCode } from "@/lib/tokens";
import { createAuditLog } from "@/lib/audit";
import {
  getClientIp,
  pruneRateLimitAttempts,
  recordAttempt,
} from "@/lib/rate-limit";

// PRD §15.4 limits
const PER_IP_LIMIT = 20;
const PER_IP_WINDOW_SEC = 3600; // 1 hour
const PER_SESSION_LIMIT = 5;

function constantTimeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * POST /api/survey/session/[sessionId]/validate-emt
 *
 * Body: { code: string }
 *
 * Returns 200 with { ok: true } on success, 401 on bad code, 429 on lockout.
 * Sets draft.is_emt_flagged + emt_validation_source on success. PRD §8.8 says
 * only sources "code"/"token"/"manual" set is_emt_flagged true.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  await pruneRateLimitAttempts();

  let body: { code?: string };
  try {
    body = (await req.json()) as { code?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const draft = await prisma.responseDraft.findFirst({
    where: { anonymousSessionId: sessionId },
  });
  if (!draft) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (draft.emtLockedAt) {
    return NextResponse.json(
      {
        error:
          "Too many incorrect attempts. Restart from your invitation link to try again.",
        locked: true,
      },
      { status: 429 }
    );
  }

  const ip = getClientIp(req);
  const ipCheck = await recordAttempt(
    `validate-emt:ip:${ip}`,
    PER_IP_LIMIT,
    PER_IP_WINDOW_SEC
  );
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(ipCheck.retryAfterSeconds ?? 3600) } }
    );
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: draft.campaignId },
    select: { id: true, emtCodeHash: true },
  });
  if (!campaign?.emtCodeHash) {
    return NextResponse.json(
      { error: "EMT code is not configured for this campaign." },
      { status: 400 }
    );
  }

  const submitted = (body.code ?? "").trim();
  if (!submitted) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  const submittedHash = hashEmtCode(normalizeEmtCode(submitted));
  const ok = constantTimeEq(submittedHash, campaign.emtCodeHash);

  if (!ok) {
    const newCount = draft.emtAttemptCount + 1;
    const lockNow = newCount >= PER_SESSION_LIMIT;
    await prisma.responseDraft.update({
      where: { id: draft.id },
      data: {
        emtAttemptCount: newCount,
        emtLockedAt: lockNow ? new Date() : null,
      },
    });
    await createAuditLog({
      actorUserId: null,
      actionType: "response.flag",
      entityType: "campaign",
      entityId: campaign.id,
      metadata: {
        kind: "emt_code_attempt_failed",
        sessionId,
        ip,
        attempt: newCount,
        sessionLocked: lockNow,
      },
    });
    return NextResponse.json(
      {
        error: lockNow
          ? "Too many incorrect attempts. Restart from your invitation link to try again."
          : "That code wasn't recognized.",
        attemptsRemaining: Math.max(0, PER_SESSION_LIMIT - newCount),
        locked: lockNow,
      },
      { status: lockNow ? 429 : 401 }
    );
  }

  await prisma.responseDraft.update({
    where: { id: draft.id },
    data: {
      isEmtFlagged: true,
      emtValidationSource: "code",
      emtAttemptCount: 0,
    },
  });

  return NextResponse.json({ ok: true });
}

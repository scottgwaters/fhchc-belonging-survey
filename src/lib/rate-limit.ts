import { prisma } from "./db";

// PRD §15.4 - sliding-window counter using Postgres
// Cheap and good enough for this scale; swap for Redis when introduced.

export interface RateLimitCheck {
  allowed: boolean;
  current: number;
  limit: number;
  retryAfterSeconds?: number;
}

/**
 * Records an attempt and returns whether the bucket is currently within its
 * sliding-window limit. The bucket convention: "<scope>:<key>", e.g.
 * "validate-emt:ip:1.2.3.4" or "validate-emt:session:<sid>".
 */
export async function recordAttempt(
  bucket: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitCheck> {
  const since = new Date(Date.now() - windowSeconds * 1000);
  const recent = await prisma.rateLimitAttempt.count({
    where: { bucket, attemptedAt: { gt: since } },
  });

  await prisma.rateLimitAttempt.create({ data: { bucket } });

  const current = recent + 1;
  if (current > limit) {
    return {
      allowed: false,
      current,
      limit,
      retryAfterSeconds: windowSeconds,
    };
  }
  return { allowed: true, current, limit };
}

/**
 * Periodically prune old rows so the table doesn't grow forever.
 * Called opportunistically from any rate-limit check.
 */
export async function pruneRateLimitAttempts(maxAgeSeconds = 3600) {
  const cutoff = new Date(Date.now() - maxAgeSeconds * 1000);
  // 1% chance to actually run so we don't tax every request
  if (Math.random() > 0.01) return;
  await prisma.rateLimitAttempt.deleteMany({
    where: { attemptedAt: { lt: cutoff } },
  });
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

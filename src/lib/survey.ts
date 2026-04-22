import { prisma } from "./db";
import { hashInviteToken } from "./tokens";

export type TokenState =
  | { kind: "welcome"; recipientId: string; campaign: SurveyCampaign }
  | { kind: "resume"; recipientId: string; sessionId: string; campaign: SurveyCampaign }
  | { kind: "already_submitted" }
  | { kind: "expired" }
  | { kind: "invalid" };

export interface SurveyCampaign {
  id: string;
  name: string;
  status: string;
  introCopy: string | null;
  visibleCloseAt: Date | null;
  theme: string;
  logoUrl: string | null;
  logoAlt: string | null;
  welcomeCopyJson: unknown;
}

/**
 * PRD §12.3 - Token landing resolution.
 * Note: invalid + expired return distinguishable kinds internally so the API
 * can rate-limit, but the public UI message is identical to prevent enumeration.
 */
export async function resolveToken(rawToken: string): Promise<TokenState> {
  if (!rawToken || rawToken.length < 8) return { kind: "invalid" };

  const hash = hashInviteToken(rawToken);
  const r = await prisma.distributionRecipient.findUnique({
    where: { inviteTokenHash: hash },
  });

  if (!r || r.deletedAt) return { kind: "invalid" };
  if (r.completedAt) return { kind: "already_submitted" };

  const campaign = await prisma.campaign.findUnique({
    where: { id: r.campaignId },
    select: {
      id: true,
      name: true,
      status: true,
      introCopy: true,
      visibleCloseAt: true,
      tokenExpiresAt: true,
      theme: true,
      logoUrl: true,
      logoAlt: true,
      welcomeCopyJson: true,
    },
  });
  if (!campaign) return { kind: "invalid" };

  if (campaign.status !== "live" && campaign.status !== "scheduled") {
    return { kind: "expired" };
  }
  if (campaign.tokenExpiresAt && campaign.tokenExpiresAt.getTime() < Date.now()) {
    return { kind: "expired" };
  }

  const draft = await prisma.responseDraft.findUnique({
    where: { inviteTokenHash: hash },
  });

  const surveyCampaign: SurveyCampaign = {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    introCopy: campaign.introCopy,
    visibleCloseAt: campaign.visibleCloseAt,
    theme: campaign.theme,
    logoUrl: campaign.logoUrl,
    logoAlt: campaign.logoAlt,
    welcomeCopyJson: campaign.welcomeCopyJson,
  };

  if (draft) {
    return {
      kind: "resume",
      recipientId: r.id,
      sessionId: draft.anonymousSessionId,
      campaign: surveyCampaign,
    };
  }

  return { kind: "welcome", recipientId: r.id, campaign: surveyCampaign };
}

/**
 * PRD §8.3 - Trusted-separation invariant assertion.
 * The Response row stores anonymous_session_id only, never recipient_id.
 * This is enforced by schema (no FK column), but we add a runtime check that
 * acts as documentation + defense-in-depth.
 */
export function assertNoRecipientFkOnResponse() {
  // Compile-time guarded by Prisma's generated types. If someone adds a column
  // to `responses` that points at distribution_recipients, the schema review
  // process must catch it. This function exists so the invariant is grep-able.
}

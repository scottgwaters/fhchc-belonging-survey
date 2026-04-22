import type { CampaignStatus } from "./validation/campaign";

// PRD §29 resolved 2026-04-20: default 3-day grace period
export const DEFAULT_TOKEN_EXPIRY_GRACE_DAYS = 3;

export function defaultTokenExpiry(visibleCloseAt: Date): Date {
  const d = new Date(visibleCloseAt);
  d.setUTCDate(d.getUTCDate() + DEFAULT_TOKEN_EXPIRY_GRACE_DAYS);
  return d;
}

// PRD §10.2 - State Transition Rules
type Transition = {
  from: CampaignStatus;
  to: CampaignStatus;
  warningRequired: boolean;
  warningMessage?: string;
};

const TRANSITIONS: Transition[] = [
  { from: "draft", to: "scheduled", warningRequired: false },
  { from: "scheduled", to: "draft", warningRequired: false },
  { from: "scheduled", to: "live", warningRequired: false },
  { from: "live", to: "closed", warningRequired: false },
  {
    from: "closed",
    to: "live",
    warningRequired: true,
    warningMessage: "Reopening a closed survey. Are you sure?",
  },
  { from: "closed", to: "archived", warningRequired: false },
  {
    from: "archived",
    to: "live",
    warningRequired: true,
    warningMessage: "Unarchiving to live. Are you sure?",
  },
];

export function findTransition(
  from: CampaignStatus,
  to: CampaignStatus
): Transition | null {
  if (from === to) return null;
  return TRANSITIONS.find((t) => t.from === from && t.to === to) ?? null;
}

export function allowedNextStatuses(from: CampaignStatus): Transition[] {
  return TRANSITIONS.filter((t) => t.from === from);
}

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  live: "Live",
  closed: "Closed",
  archived: "Archived",
};

// MVP optimistic concurrency (PRD §11)
export class ConcurrencyConflictError extends Error {
  constructor(
    public currentUpdatedAt: Date,
    message = "Record was modified by another user"
  ) {
    super(message);
    this.name = "ConcurrencyConflictError";
  }
}

/**
 * Parse If-Unmodified-Since header into a Date.
 * Per PRD §11 MVP guard: clients send the record's known updated_at;
 * server rejects with 409 if the record has changed since.
 */
export function parseIfUnmodifiedSince(req: Request): Date | null {
  const header = req.headers.get("If-Unmodified-Since");
  if (!header) return null;
  const parsed = new Date(header);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function assertNotModified(
  recordUpdatedAt: Date,
  ifUnmodifiedSince: Date | null
): void {
  if (!ifUnmodifiedSince) return;
  // Allow up to 1 second of clock skew; PG truncates to ms anyway
  if (recordUpdatedAt.getTime() > ifUnmodifiedSince.getTime() + 1000) {
    throw new ConcurrencyConflictError(recordUpdatedAt);
  }
}

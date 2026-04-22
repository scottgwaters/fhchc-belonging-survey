import type { CampaignStatus } from "@/lib/validation/campaign";
import { Badge } from "@/components/ui/primitives";
import { CAMPAIGN_STATUS_TONE } from "@/lib/badge-tones";

const LABELS: Record<CampaignStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  live: "Live",
  closed: "Closed",
  archived: "Archived",
};

export function CampaignStatusBadge({ status }: { status: string }) {
  const tone = CAMPAIGN_STATUS_TONE[status] ?? "gray";
  const label = LABELS[status as CampaignStatus] ?? status;
  return <Badge tone={tone}>{label}</Badge>;
}

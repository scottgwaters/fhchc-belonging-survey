"use client";

import Link from "next/link";
import { Calendar, Users, BarChart3 } from "lucide-react";
import type { AdminRole } from "@/lib/auth";
import { Badge, type BadgeTone } from "@/components/ui/primitives";
import { CAMPAIGN_STATUS_TONE } from "@/lib/badge-tones";

interface Campaign {
  id: string;
  name: string;
  year: number;
  status: string;
  isTemplate: boolean;
  startAt: Date | null;
  visibleCloseAt: Date | null;
  client: {
    name: string;
    slug: string;
  };
  _count: {
    recipients: number;
    responses: number;
  };
}

interface CampaignListProps {
  campaigns: Campaign[];
  userRole: AdminRole;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  live: "Live",
  closed: "Closed",
  archived: "Archived",
};

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function getResponseRate(recipients: number, responses: number): string {
  if (recipients === 0) return "—";
  const rate = (responses / recipients) * 100;
  return `${rate.toFixed(0)}%`;
}

export function CampaignList({ campaigns, userRole }: CampaignListProps) {
  if (campaigns.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[#C7D0CA] bg-white p-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#DCE8E4]">
          <BarChart3 className="h-6 w-6 text-[#244943]" />
        </div>
        <h3 className="t-section">No campaigns yet</h3>
        <p className="mt-1 t-helper">
          Create your first campaign to get started.
        </p>
        {(userRole === "super_admin" || userRole === "campaign_admin") && (
          <Link
            href="/admin/campaigns/new"
            className="mt-4 inline-flex h-11 items-center rounded-full bg-[#1C1C1C] px-5 text-sm font-medium text-white transition-colors hover:bg-[#1D3931] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5D54] focus-visible:ring-offset-2"
          >
            New campaign
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {campaigns.map((campaign) => {
        const tone: BadgeTone = campaign.isTemplate
          ? "sage"
          : CAMPAIGN_STATUS_TONE[campaign.status] ?? "gray";
        const label = campaign.isTemplate
          ? "Template"
          : STATUS_LABELS[campaign.status] ?? campaign.status;
        const responseRate = getResponseRate(
          campaign._count.recipients,
          campaign._count.responses
        );

        return (
          <Link
            key={campaign.id}
            href={`/admin/campaigns/${campaign.id}`}
            className="block rounded-2xl border border-[#D9DFDA] bg-white p-5 transition-colors hover:border-[#2F5D54] hover:bg-[#F7F9F7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5D54] focus-visible:ring-offset-2"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="truncate text-base font-semibold text-[#1C1C1C]">
                    {campaign.name}
                  </h3>
                  <Badge tone={tone}>{label}</Badge>
                </div>

                <p className="mt-1 t-helper">{campaign.client.name}</p>

                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#374151]">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-[#6B7280]" />
                    <span>
                      {formatDate(campaign.startAt)}
                      {campaign.visibleCloseAt && (
                        <> – {formatDate(campaign.visibleCloseAt)}</>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-[#6B7280]" />
                    <span>{campaign._count.recipients} invited</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <BarChart3 className="h-4 w-4 text-[#6B7280]" />
                    <span className="font-medium text-[#1C1C1C]">
                      {campaign._count.responses} responses
                    </span>
                    <span className="text-[#6B7280]">({responseRate})</span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

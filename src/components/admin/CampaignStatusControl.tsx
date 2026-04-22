"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CAMPAIGN_STATUS_LABELS,
  allowedNextStatuses,
} from "@/lib/campaigns";
import type { CampaignStatus } from "@/lib/validation/campaign";
import { CampaignStatusBadge } from "./CampaignStatusBadge";

interface Props {
  campaignId: string;
  currentStatus: CampaignStatus;
  updatedAt: string;
  canTransition: boolean;
}

export function CampaignStatusControl({
  campaignId,
  currentStatus,
  updatedAt,
  canTransition,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingTransition, setPendingTransition] = useState<{
    to: CampaignStatus;
    warningMessage: string;
  } | null>(null);
  const [reason, setReason] = useState("");

  const transitions = allowedNextStatuses(currentStatus);

  async function transitionTo(to: CampaignStatus, acknowledgedWarning = false) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/admin/campaigns/${campaignId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "If-Unmodified-Since": new Date(updatedAt).toUTCString(),
          },
          body: JSON.stringify({
            newStatus: to,
            reason: reason || undefined,
            acknowledgedWarning,
          }),
        }
      );

      if (res.status === 409) {
        const body = await res.json();
        if (body.requiresAcknowledgement) {
          setPendingTransition({ to, warningMessage: body.warningMessage });
          return;
        }
        setError(body.error ?? "Conflict");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }

      setPendingTransition(null);
      setReason("");
      router.refresh();
    });
  }

  if (!canTransition) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-[#6B7280]">Status</span>
        <CampaignStatusBadge status={currentStatus} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm text-[#6B7280]">Status</span>
        <CampaignStatusBadge status={currentStatus} />
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {transitions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#6B7280]">Move to:</span>
          {transitions.map((t) => (
            <button
              key={t.to}
              type="button"
              disabled={isPending}
              onClick={() => transitionTo(t.to)}
              className="rounded-full border border-[#E8ECE8] px-3 py-1 text-xs font-medium text-[#1C1C1C] hover:bg-[#F7F9F7] disabled:opacity-50"
            >
              {CAMPAIGN_STATUS_LABELS[t.to]}
              {t.warningRequired && " ⚠"}
            </button>
          ))}
        </div>
      )}

      {pendingTransition && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <p className="text-sm font-medium text-amber-900">
            {pendingTransition.warningMessage}
          </p>
          <label className="block">
            <span className="text-xs font-medium text-amber-900">
              Reason (recorded in audit log)
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"
              placeholder="e.g., Extended per client request"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => transitionTo(pendingTransition.to, true)}
              className="rounded-full bg-amber-700 px-4 py-2 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingTransition(null);
                setReason("");
              }}
              className="rounded-full border border-amber-200 px-4 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

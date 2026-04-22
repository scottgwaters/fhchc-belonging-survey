"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

interface Props {
  campaignId: string;
  pendingCount: number;
  campaignStatus: string;
}

export function SendInvitesButton({
  campaignId,
  pendingCount,
  campaignStatus,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const eligible =
    campaignStatus === "scheduled" || campaignStatus === "live";

  function send() {
    setResult(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/admin/campaigns/${campaignId}/send-invites`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      const body = await res.json();
      if (!res.ok) {
        setResult(`Failed: ${body.error ?? res.status}`);
        return;
      }
      const fallbackNote =
        body.dryRunFallback > 0
          ? ` (${body.dryRunFallback} logged to server console — SENDGRID_API_KEY not set)`
          : "";
      setResult(
        `Sent ${body.sent}, failed ${body.failed}${fallbackNote}.`
      );
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {!confirming ? (
        <button
          type="button"
          disabled={!eligible || pendingCount === 0 || isPending}
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#1C1C1C] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D3931] disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          Send {pendingCount} invitation{pendingCount === 1 ? "" : "s"}
        </button>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
          <span className="text-amber-900">
            Send invitations to {pendingCount} recipients?
          </span>
          <button
            type="button"
            onClick={send}
            disabled={isPending}
            className="rounded-full bg-amber-700 px-3 py-1 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50"
          >
            {isPending ? "Sending..." : "Confirm"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-full border border-amber-200 px-3 py-1 text-xs text-amber-900 hover:bg-amber-100"
          >
            Cancel
          </button>
        </div>
      )}

      {!eligible && pendingCount > 0 && (
        <p className="text-xs text-[#6B7280]">
          Move campaign to “Scheduled” or “Live” to send invitations.
        </p>
      )}

      {result && (
        <p className="text-xs text-[#374151]">{result}</p>
      )}
    </div>
  );
}

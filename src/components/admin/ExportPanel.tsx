"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText } from "lucide-react";

interface Props {
  campaignId: string;
  canDownload: boolean;
}

const KINDS = [
  {
    key: "responses",
    label: "Responses (wide CSV)",
    desc: "One row per response; one column per question. Excludes test/preview rows.",
  },
  {
    key: "aggregated",
    label: "Aggregated summary",
    desc: "Per-question favorability + suppression flags (PRD §8.14 floor enforced).",
  },
  {
    key: "comments",
    label: "Comments",
    desc: "Open-text responses. Segment columns blanked when segment n < anonymity threshold (PRD §8.11).",
  },
  {
    key: "rollups",
    label: "Roll-up mapping",
    desc: "raw_group → parent_group used by reporting.",
  },
] as const;

export function ExportPanel({ campaignId, canDownload }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeKind, setActiveKind] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function download(kind: string) {
    setError(null);
    setActiveKind(kind);
    startTransition(async () => {
      const res = await fetch(
        `/api/admin/campaigns/${campaignId}/exports?kind=${kind}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Failed (${res.status})`);
        setActiveKind(null);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const cd = res.headers.get("Content-Disposition");
      const m = cd?.match(/filename="?([^";]+)"?/);
      a.href = url;
      a.download = m?.[1] ?? `${kind}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setActiveKind(null);
      router.refresh();
    });
  }

  if (!canDownload) {
    return (
      <p className="text-sm text-[#6B7280]">
        Sign-in required, or insufficient role.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      {KINDS.map((k) => (
        <div
          key={k.key}
          className="flex items-start justify-between gap-4 rounded-2xl border border-[#D9DFDA] bg-white p-4"
        >
          <div className="flex-1">
            <p className="text-sm font-medium text-[#1C1C1C]">{k.label}</p>
            <p className="mt-1 text-xs text-[#6B7280]">{k.desc}</p>
          </div>
          <button
            type="button"
            onClick={() => download(k.key)}
            disabled={isPending && activeKind === k.key}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1C1C1C] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1D3931] disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {isPending && activeKind === k.key ? "Generating..." : "Download"}
          </button>
        </div>
      ))}
    </div>
  );
}

interface ExportLog {
  id: string;
  exportType: string;
  generatedAt: Date | string;
  user: { name: string | null; email: string };
}

const HISTORY_DATE_FMT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

export function ExportHistory({ exports }: { exports: ExportLog[] }) {
  if (exports.length === 0) {
    return (
      <p className="text-sm text-[#6B7280]">No exports generated yet.</p>
    );
  }
  return (
    <ul className="divide-y divide-[#E8ECE8]">
      {exports.map((e) => (
        <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
          <FileText className="h-3.5 w-3.5 text-[#9CA3AF]" />
          <span className="text-[#1C1C1C]">{e.exportType}</span>
          <span className="text-[#6B7280]">
            by {e.user.name ?? e.user.email}
          </span>
          <span className="ml-auto text-xs text-[#9CA3AF]">
            {HISTORY_DATE_FMT.format(new Date(e.generatedAt))}
          </span>
        </li>
      ))}
    </ul>
  );
}

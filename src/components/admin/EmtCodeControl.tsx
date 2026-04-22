"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Key, Trash2, Save } from "lucide-react";

interface Props {
  campaignId: string;
  currentlyConfigured: boolean;
  canEdit: boolean;
}

export function EmtCodeControl({
  campaignId,
  currentlyConfigured,
  canEdit,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/emt-code`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }
      setCode("");
      setMessage(body.configured ? "EMT code saved." : "EMT code cleared.");
      router.refresh();
    });
  }

  function clear() {
    if (!confirm("Clear the EMT code? Existing flagged responses are unaffected, but no new EMT validation can occur until a new code is set.")) return;
    setCode("");
    startTransition(async () => {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/emt-code`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }
      setMessage("EMT code cleared.");
      router.refresh();
    });
  }

  if (!canEdit) {
    return (
      <p className="text-sm text-[#6B7280]">
        EMT code: {currentlyConfigured ? "configured" : "not set"} (super_admin
        access required to change)
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-[#374151]">
        <Key className="h-4 w-4 text-[#244943]" />
        Current status:{" "}
        <span className="font-medium">
          {currentlyConfigured ? "configured" : "not set"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={currentlyConfigured ? "Enter new code to replace" : "4–32 chars"}
          autoComplete="off"
          className="flex-1 rounded-xl border border-[#E8ECE8] bg-white px-3 py-2 text-sm font-mono"
        />
        <button
          type="button"
          onClick={save}
          disabled={isPending || !code}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#1C1C1C] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D3931] disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          Save
        </button>
        {currentlyConfigured && (
          <button
            type="button"
            onClick={clear}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>
      <p className="text-xs text-[#9CA3AF]">
        Code is normalized (trimmed, uppercased) and stored as HMAC-SHA256 with
        a per-environment pepper (PRD §15.3.1). Communicate it to EMT members
        verbally — never by email.
      </p>
      {message && <p className="text-xs text-[#244943]">{message}</p>}
      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>
      )}
    </div>
  );
}

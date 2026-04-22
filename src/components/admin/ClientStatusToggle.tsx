"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Helper } from "@/components/ui/primitives";

interface Props {
  clientId: string;
  status: string;
}

export function ClientStatusToggle({ clientId, status }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isActive = status === "active";
  const nextStatus = isActive ? "inactive" : "active";

  function toggle() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <Helper>
        {isActive
          ? "Active clients appear in the new-campaign picker and can run live campaigns."
          : "Inactive clients are hidden from new-campaign creation but keep all existing data."}
      </Helper>
      {error && (
        <p className="rounded-xl bg-[#FEE2E2] px-3 py-2 text-sm text-[#991B1B]">
          {error}
        </p>
      )}
      <Button
        type="button"
        variant={isActive ? "secondary" : "primary"}
        onClick={toggle}
        disabled={isPending}
      >
        {isPending ? "Updating…" : isActive ? "Deactivate client" : "Reactivate client"}
      </Button>
    </div>
  );
}

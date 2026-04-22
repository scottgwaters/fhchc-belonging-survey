"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronRight } from "lucide-react";
import { Badge, Button, Input, Label } from "@/components/ui/primitives";

interface ClientRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  _count: { campaigns: number };
}

interface Props {
  clients: ClientRow[];
}

export function ClientsCard({ clients }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  function suggestedSlug(n: string): string {
    return n
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  }

  function create() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, status: "active" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }
      setCreating(false);
      setName("");
      setSlug("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        {!creating ? (
          <Button
            type="button"
            variant="primary"
            onClick={() => setCreating(true)}
            leftIcon={<Plus className="h-3.5 w-3.5" />}
          >
            Add client
          </Button>
        ) : null}
      </div>

      {error && (
        <p className="rounded-xl bg-[#FEE2E2] px-3 py-2.5 text-sm text-[#991B1B]">
          {error}
        </p>
      )}

      {creating && (
        <div className="rounded-2xl border border-[#D9DFDA] bg-white p-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Label label="Name" required>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slug) setSlug(suggestedSlug(e.target.value));
                }}
                placeholder="Acme Health Network"
                autoFocus
              />
            </Label>
            <Label label="Slug (URL-safe)" required>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="acme"
                className="font-mono"
              />
            </Label>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCreating(false);
                setError(null);
                setName("");
                setSlug("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={isPending || !name || !slug}
              onClick={create}
            >
              {isPending ? "Creating…" : "Create client"}
            </Button>
          </div>
        </div>
      )}

      {clients.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#C7D0CA] bg-white p-12 text-center">
          <h3 className="t-section">No clients yet</h3>
          <p className="mt-1 t-helper">
            Add your first client to start running campaigns.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#D9DFDA] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#F7F9F7] text-left text-xs font-semibold uppercase tracking-wide text-[#1C1C1C]">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Slug</th>
                <th className="px-6 py-3">Campaigns</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr
                  key={c.id}
                  className="group border-t border-[#E8ECE8] transition hover:bg-[#F7F9F7]"
                >
                  <td className="px-6 py-3">
                    <Link
                      href={`/admin/clients/${c.id}`}
                      className="font-medium text-[#1C1C1C] hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-[#374151]">
                    <code className="rounded bg-[#F7F9F7] px-1.5 py-0.5 text-xs">
                      {c.slug}
                    </code>
                  </td>
                  <td className="px-6 py-3 text-[#374151]">
                    {c._count.campaigns}
                  </td>
                  <td className="px-6 py-3">
                    <Badge tone={c.status === "active" ? "sage" : "gray"}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Link
                      href={`/admin/clients/${c.id}`}
                      aria-label={`View ${c.name}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#9CA3AF] group-hover:text-[#1C1C1C]"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

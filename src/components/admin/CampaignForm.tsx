"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RichTextEditor } from "./RichTextEditor";
import { ThemePicker } from "./ThemePicker";
import { LogoUpload } from "./LogoUpload";
import { WelcomeCopyEditor } from "./WelcomeCopyEditor";
import { DEFAULT_THEME, type ThemeId } from "@/lib/themes";
import {
  DEFAULT_WELCOME_COPY,
  resolveWelcomeCopy,
  type WelcomeCopy,
} from "@/lib/welcome-copy";
import {
  Button,
  Card,
  Input,
  Label,
  SectionHeader,
  Select,
} from "@/components/ui/primitives";

interface ClientOption {
  id: string;
  name: string;
}

interface CampaignFormProps {
  mode: "create" | "edit";
  clients: ClientOption[];
  initial?: {
    id: string;
    clientId: string;
    year: number;
    name: string;
    timezone: string;
    startAt: string | null;
    visibleCloseAt: string | null;
    tokenExpiresAt: string | null;
    introCopy: string | null;
    invitationCopy: string | null;
    anonymityThreshold: number;
    theme: ThemeId | string;
    logoUrl: string | null;
    logoAlt: string | null;
    welcomeCopyJson: unknown;
    updatedAt: string;
  };
}

function toDateInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function fromDateInput(value: string): string | null {
  if (!value) return null;
  return new Date(value + "T00:00:00.000Z").toISOString();
}

export function CampaignForm({ mode, clients, initial }: CampaignFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  const [form, setForm] = useState({
    clientId: initial?.clientId ?? clients[0]?.id ?? "",
    year: initial?.year ?? new Date().getUTCFullYear(),
    name: initial?.name ?? "",
    timezone: initial?.timezone ?? "America/New_York",
    startAt: toDateInput(initial?.startAt ?? null),
    visibleCloseAt: toDateInput(initial?.visibleCloseAt ?? null),
    tokenExpiresAt: toDateInput(initial?.tokenExpiresAt ?? null),
    introCopy: initial?.introCopy ?? "",
    invitationCopy: initial?.invitationCopy ?? "",
    anonymityThreshold: initial?.anonymityThreshold ?? 5,
    theme: ((initial?.theme as ThemeId) ?? DEFAULT_THEME) as ThemeId,
    logoUrl: initial?.logoUrl ?? null,
    logoAlt: initial?.logoAlt ?? null,
    welcomeCopy: initial?.welcomeCopyJson
      ? resolveWelcomeCopy(initial.welcomeCopyJson)
      : (null as WelcomeCopy | null),
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setConflict(null);

    const payload = {
      clientId: form.clientId,
      year: Number(form.year),
      name: form.name,
      timezone: form.timezone,
      startAt: fromDateInput(form.startAt),
      visibleCloseAt: fromDateInput(form.visibleCloseAt),
      tokenExpiresAt: fromDateInput(form.tokenExpiresAt),
      introCopy: form.introCopy || null,
      invitationCopy: form.invitationCopy || null,
      anonymityThreshold: Number(form.anonymityThreshold),
      theme: form.theme,
      logoUrl: form.logoUrl,
      logoAlt: form.logoAlt,
      welcomeCopyJson: form.welcomeCopy,
    };

    const url =
      mode === "create"
        ? "/api/admin/campaigns"
        : `/api/admin/campaigns/${initial!.id}`;
    const method = mode === "create" ? "POST" : "PATCH";

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (mode === "edit" && initial) {
      headers["If-Unmodified-Since"] = new Date(initial.updatedAt).toUTCString();
    }

    startTransition(async () => {
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        setConflict(
          `This campaign was modified by someone else (last server change: ${
            body.currentUpdatedAt ?? "unknown"
          }). Reload to see the latest, then re-apply your changes.`
        );
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Request failed (${res.status})`);
        return;
      }

      const saved = await res.json();
      router.push(`/admin/campaigns/${saved.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl bg-[#FEE2E2] px-4 py-3 text-sm text-[#991B1B]">
          {error}
        </div>
      )}
      {conflict && (
        <div className="rounded-xl bg-[#FEF3C7] px-4 py-3 text-sm text-[#92400E]">
          {conflict}
          <button
            type="button"
            onClick={() => router.refresh()}
            className="ml-2 font-medium underline"
          >
            Reload
          </button>
        </div>
      )}

      <Card>
        <SectionHeader
          title="Basics"
          description="Identify the campaign and the year it covers."
        />
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Label label="Client">
              <Select
                value={form.clientId}
                onChange={(e) => update("clientId", e.target.value)}
                required
                disabled={mode === "edit"}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Label>

            <Label label="Survey year">
              <Input
                type="number"
                min={2020}
                max={2100}
                value={form.year}
                onChange={(e) => update("year", Number(e.target.value))}
                required
              />
            </Label>
          </div>

          <Label label="Campaign name" required>
            <Input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="2026 Well-being & Belonging Survey"
              required
            />
          </Label>
        </div>
      </Card>

      <Card>
        <SectionHeader
          title="Schedule"
          description="When respondents can see and submit the survey."
        />
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Label label="Start">
              <Input
                type="date"
                value={form.startAt}
                onChange={(e) => update("startAt", e.target.value)}
              />
            </Label>
            <Label
              label="Visible close"
              helper="Shown to respondents as the close date."
            >
              <Input
                type="date"
                value={form.visibleCloseAt}
                onChange={(e) => update("visibleCloseAt", e.target.value)}
              />
            </Label>
            <Label
              label="Token expires"
              helper="Hard cutoff. Defaults to visible close + 3 days if blank."
            >
              <Input
                type="date"
                value={form.tokenExpiresAt}
                onChange={(e) => update("tokenExpiresAt", e.target.value)}
              />
            </Label>
          </div>

          <Label label="Timezone" required>
            <Input
              type="text"
              value={form.timezone}
              onChange={(e) => update("timezone", e.target.value)}
              placeholder="America/New_York"
              required
            />
          </Label>
        </div>
      </Card>

      <Card>
        <SectionHeader
          title="Copy"
          description="What respondents read on the welcome screen and in their invitation email."
        />
        <div className="space-y-6">
          <div>
            <span className="t-label mb-1.5 block">Survey intro (preamble)</span>
            <RichTextEditor
              value={form.introCopy}
              onChange={(v) => update("introCopy", v)}
              rows={6}
              placeholder="A short message respondents see on the welcome screen. Bold the things you want to stand out."
              helpText="Shown on the survey welcome page. Use the toolbar to format — switch to Preview to see how it'll look."
            />
          </div>

          <div>
            <span className="t-label mb-1.5 block">Invitation email body</span>
            <RichTextEditor
              value={form.invitationCopy}
              onChange={(v) => update("invitationCopy", v)}
              rows={8}
              placeholder={`Hi {{firstName}},\n\nWe're launching this year's survey. Click below to begin — it takes about 4 minutes.\n\n{{surveyLink}}`}
              variables={["firstName", "surveyLink", "closeDate", "campaignName"]}
              helpText="Click any chip above to drop a variable at the cursor. Preview replaces them with sample values so you can see exactly what recipients will read."
            />
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader
          title="Welcome page copy"
          description="Edit the trust cards and 'How it works' section shown on the survey welcome page. Leave fields blank (or reset) to use the defaults."
        />
        <WelcomeCopyEditor
          value={form.welcomeCopy ?? DEFAULT_WELCOME_COPY}
          onChange={(next) => update("welcomeCopy", next)}
          onReset={() => update("welcomeCopy", null)}
        />
      </Card>

      <Card>
        <SectionHeader
          title="Privacy"
          description="Anonymity protections applied to all reports and exports."
        />
        <Label
          label="Anonymity threshold"
          helper="Suppress any group with fewer than N responses (PRD BR-1; default 5)."
          className="max-w-xs"
        >
          <Input
            type="number"
            min={2}
            max={50}
            value={form.anonymityThreshold}
            onChange={(e) => update("anonymityThreshold", Number(e.target.value))}
            required
          />
        </Label>
      </Card>

      <Card>
        <SectionHeader
          title="Branding"
          description="Theme accent + logo shown on the respondent-facing survey (welcome screen, progress bar, selected options)."
        />
        <div className="space-y-6">
          <div>
            <p className="t-label mb-2">Theme</p>
            <ThemePicker
              value={form.theme}
              onChange={(v) => update("theme", v)}
            />
          </div>
          <div>
            <p className="t-label mb-2">Logo (optional)</p>
            <LogoUpload
              value={form.logoUrl}
              alt={form.logoAlt}
              onChange={(url, alt) => {
                update("logoUrl", url);
                update("logoAlt", alt);
              }}
            />
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending
            ? "Saving…"
            : mode === "create"
            ? "Create campaign"
            : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

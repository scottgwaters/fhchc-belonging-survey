import Link from "next/link";
import {
  Calendar,
  Users,
  BarChart3,
  FileText,
  Pencil,
  Mail,
  ListChecks,
  LineChart,
  Eye,
} from "lucide-react";
import type { CampaignStatus } from "@/lib/validation/campaign";
import type { AdminRole } from "@/lib/auth";
import { CampaignStatusBadge } from "./CampaignStatusBadge";
import { CampaignStatusControl } from "./CampaignStatusControl";
import { EmtCodeControl } from "./EmtCodeControl";

interface CampaignDetailProps {
  campaign: {
    id: string;
    name: string;
    year: number;
    status: string;
    timezone: string;
    startAt: Date | null;
    visibleCloseAt: Date | null;
    tokenExpiresAt: Date | null;
    introCopy: string | null;
    invitationCopy: string | null;
    anonymityThreshold: number;
    emtCodeHash: string | null;
    updatedAt: Date;
    client: { name: string; slug: string };
    questionSchemas: { id: string; versionName: string; questions: { id: string }[] }[];
    _count: { recipients: number; responses: number };
  };
  statusLogs: {
    id: string;
    previousStatus: string;
    newStatus: string;
    changedAt: Date;
    reason: string | null;
    changedByUser: { name: string | null; email: string };
  }[];
  canEdit: boolean;
  userRole: AdminRole;
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function navLinkClass(primary = false): string {
  if (primary) {
    return "inline-flex h-10 items-center gap-1.5 rounded-full bg-[#1C1C1C] px-4 text-sm font-medium text-white hover:bg-[#1D3931] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5D54] focus-visible:ring-offset-2";
  }
  return "inline-flex h-10 items-center gap-1.5 rounded-full border border-[#D9DFDA] bg-white px-4 text-sm font-medium text-[#1C1C1C] hover:bg-[#F7F9F7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5D54] focus-visible:ring-offset-2";
}

export function CampaignDetail({
  campaign,
  statusLogs,
  canEdit,
  userRole,
}: CampaignDetailProps) {
  const totalQuestions = campaign.questionSchemas.reduce(
    (sum, s) => sum + s.questions.length,
    0
  );
  const responseRate =
    campaign._count.recipients === 0
      ? "—"
      : `${Math.round(
          (campaign._count.responses / campaign._count.recipients) * 100
        )}%`;

  // Primary action by campaign lifecycle: pick the single most-likely next step.
  const primaryAction: "schema" | "recipients" | "results" =
    campaign.status === "draft" || totalQuestions === 0
      ? "schema"
      : campaign.status === "scheduled" || campaign._count.responses === 0
      ? "recipients"
      : "results";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="t-page-title">{campaign.name}</h1>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          <p className="mt-2 t-helper">
            {campaign.client.name} · {campaign.year}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/campaigns/${campaign.id}/schema`}
            className={navLinkClass(primaryAction === "schema")}
          >
            <ListChecks className="h-3.5 w-3.5" />
            Schema
          </Link>
          <Link
            href={`/admin/campaigns/${campaign.id}/recipients`}
            className={navLinkClass(primaryAction === "recipients")}
          >
            <Mail className="h-3.5 w-3.5" />
            Recipients
          </Link>
          <Link
            href={`/admin/campaigns/${campaign.id}/reporting`}
            className={navLinkClass(primaryAction === "results")}
          >
            <LineChart className="h-3.5 w-3.5" />
            Results
          </Link>
          <Link
            href={`/admin/campaigns/${campaign.id}/preview`}
            className={navLinkClass(false)}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Link>
          <Link
            href={`/admin/campaigns/${campaign.id}/exports`}
            className={navLinkClass(false)}
          >
            <FileText className="h-3.5 w-3.5" />
            Exports
          </Link>
          {canEdit && (
            <Link
              href={`/admin/campaigns/${campaign.id}/edit`}
              className={navLinkClass(false)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Link>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatTile
          label="Start"
          icon={<Calendar className="h-3.5 w-3.5" />}
          value={formatDate(campaign.startAt)}
        />
        <StatTile
          label="Visible close"
          icon={<Calendar className="h-3.5 w-3.5" />}
          value={formatDate(campaign.visibleCloseAt)}
          sub={`Tokens expire ${formatDate(campaign.tokenExpiresAt)}`}
        />
        <StatTile
          label="Invited"
          icon={<Users className="h-3.5 w-3.5" />}
          value={String(campaign._count.recipients)}
        />
        <StatTile
          label="Responses"
          icon={<BarChart3 className="h-3.5 w-3.5" />}
          value={`${campaign._count.responses}`}
          sub={`${responseRate} response rate`}
        />
      </div>

      {/* Status control */}
      <div className="rounded-2xl border border-[#D9DFDA] bg-white p-6">
        <h2 className="t-section mb-4">Status</h2>
        <CampaignStatusControl
          campaignId={campaign.id}
          currentStatus={campaign.status as CampaignStatus}
          updatedAt={campaign.updatedAt.toISOString()}
          canTransition={canEdit}
        />
      </div>

      {/* EMT code */}
      <div className="rounded-2xl border border-[#D9DFDA] bg-white p-6">
        <h2 className="t-section mb-4">EMT code</h2>
        <EmtCodeControl
          campaignId={campaign.id}
          currentlyConfigured={Boolean(campaign.emtCodeHash)}
          canEdit={userRole === "super_admin"}
        />
      </div>

      {/* Schema */}
      <div className="rounded-2xl border border-[#D9DFDA] bg-white p-6">
        <h2 className="t-section mb-4">Question schema</h2>
        {campaign.questionSchemas.length === 0 ? (
          <p className="t-helper">
            No schema attached. Schema authoring lands in a future milestone (PRD §8.17.1).
          </p>
        ) : (
          <ul className="space-y-2">
            {campaign.questionSchemas.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-[#E8ECE8] bg-[#F7F9F7] px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#6B7280]" />
                  <span className="font-medium text-[#1C1C1C]">
                    {s.versionName}
                  </span>
                  <span className="text-[#374151]">
                    · {s.questions.length} questions
                  </span>
                </div>
              </li>
            ))}
            <li className="t-helper">
              Total: {totalQuestions} questions across{" "}
              {campaign.questionSchemas.length} schema version(s)
            </li>
          </ul>
        )}
      </div>

      {/* Copy preview */}
      {(campaign.introCopy || campaign.invitationCopy) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {campaign.introCopy && (
            <div className="rounded-2xl border border-[#D9DFDA] bg-white p-6">
              <h3 className="t-section">Survey intro</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm text-[#1C1C1C]">
                {campaign.introCopy}
              </p>
            </div>
          )}
          {campaign.invitationCopy && (
            <div className="rounded-2xl border border-[#D9DFDA] bg-white p-6">
              <h3 className="t-section">Invitation email</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm text-[#1C1C1C]">
                {campaign.invitationCopy}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Status history */}
      <div className="rounded-2xl border border-[#D9DFDA] bg-white p-6">
        <h2 className="t-section mb-4">Status history</h2>
        {statusLogs.length === 0 ? (
          <p className="t-helper">No status changes yet.</p>
        ) : (
          <ol className="space-y-3">
            {statusLogs.map((log) => (
              <li key={log.id} className="text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <CampaignStatusBadge status={log.previousStatus} />
                  <span className="text-[#9CA3AF]">→</span>
                  <CampaignStatusBadge status={log.newStatus} />
                  <span className="t-helper">
                    {formatDateTime(log.changedAt)} by{" "}
                    {log.changedByUser.name ?? log.changedByUser.email}
                  </span>
                </div>
                {log.reason && (
                  <p className="mt-1 ml-2 text-xs text-[#6B7280]">
                    &ldquo;{log.reason}&rdquo;
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#D9DFDA] bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#1C1C1C]">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-xl font-semibold text-[#1C1C1C]">{value}</p>
      {sub && <p className="mt-1 text-xs text-[#374151]">{sub}</p>}
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Mail, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getSession, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { RecipientUpload } from "@/components/admin/RecipientUpload";
import { SendInvitesButton } from "@/components/admin/SendInvitesButton";

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(d);
}

export default async function RecipientsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, name: true, status: true },
  });
  if (!campaign) notFound();

  const recipients = await prisma.distributionRecipient.findMany({
    where: { campaignId: id, deletedAt: null },
    orderBy: [{ inviteSentAt: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      employeeIdentifier: true,
      firstName: true,
      locationCode: true,
      roleCode: true,
      isEmtExpected: true,
      inviteSentAt: true,
      reminderCount: true,
      completedAt: true,
      bounceStatus: true,
    },
  });

  const pending = recipients.filter(
    (r) => !r.inviteSentAt && !r.completedAt && !r.bounceStatus
  );
  const sent = recipients.filter((r) => r.inviteSentAt && !r.completedAt);
  const completed = recipients.filter((r) => r.completedAt);
  const bounced = recipients.filter((r) => r.bounceStatus);

  const canEdit = hasRole(session.user.role, "campaign_admin");

  return (
    <div className="min-h-screen">
      <AdminHeader user={session.user} />
      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <div>
          <Link
            href={`/admin/campaigns/${id}`}
            className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-[#374151] hover:text-[#1C1C1C]"
          >
            <ChevronLeft className="h-4 w-4" />
            {campaign.name}
          </Link>
          <h1 className="t-page-title">Recipients</h1>
          <p className="mt-2 t-helper max-w-2xl">
            Distribution list for this campaign. Identity stays here; survey responses are stored separately (PRD §8.3).
          </p>
        </div>

        {/* Summary tiles */}
        <div className="grid gap-3 sm:grid-cols-4">
          <Tile label="Pending" value={pending.length} />
          <Tile
            label="Invited"
            value={sent.length}
            icon={<Mail className="h-3.5 w-3.5" />}
          />
          <Tile
            label="Completed"
            value={completed.length}
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          />
          <Tile
            label="Bounced"
            value={bounced.length}
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
          />
        </div>

        {canEdit && <RecipientUpload campaignId={id} />}

        {canEdit && pending.length > 0 && (
          <div className="rounded-2xl border border-[#D9DFDA] bg-white p-6">
            <h2 className="t-section mb-3">Send invitations</h2>
            <SendInvitesButton
              campaignId={id}
              pendingCount={pending.length}
              campaignStatus={campaign.status}
            />
          </div>
        )}

        {/* Recipient table */}
        <div className="rounded-2xl border border-[#D9DFDA] bg-white overflow-hidden">
          <div className="border-b border-[#E8ECE8] px-6 py-4">
            <h2 className="t-section">All recipients <span className="font-normal text-[#6B7280]">({recipients.length})</span></h2>
          </div>
          {recipients.length === 0 ? (
            <p className="p-6 t-helper">
              No recipients yet. Upload a CSV to get started.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[#F7F9F7] text-left text-xs font-semibold uppercase tracking-wide text-[#1C1C1C]">
                <tr>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Location</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">EMT?</th>
                  <th className="px-6 py-3">Invited</th>
                  <th className="px-6 py-3">Completed</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.id} className="border-t border-[#E8ECE8]">
                    <td className="px-6 py-3 font-medium text-[#1C1C1C]">
                      {r.email}
                      {r.bounceStatus && (
                        <span className="ml-2 rounded-full bg-[#FEE2E2] px-2 py-0.5 text-xs text-[#991B1B]">
                          {r.bounceStatus}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-[#1C1C1C]">{r.firstName ?? "—"}</td>
                    <td className="px-6 py-3 text-[#374151]">{r.locationCode ?? "—"}</td>
                    <td className="px-6 py-3 text-[#374151]">{r.roleCode ?? "—"}</td>
                    <td className="px-6 py-3 text-[#374151]">
                      {r.isEmtExpected ? "Yes" : "—"}
                    </td>
                    <td className="px-6 py-3 text-[#374151]">
                      {formatDate(r.inviteSentAt)}
                    </td>
                    <td className="px-6 py-3 text-[#374151]">
                      {formatDate(r.completedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

function Tile({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#D9DFDA] bg-white p-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#1C1C1C]">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-3xl font-semibold text-[#1C1C1C]">{value}</p>
    </div>
  );
}

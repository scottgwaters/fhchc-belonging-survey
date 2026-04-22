import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getSession, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { CampaignForm } from "@/components/admin/CampaignForm";

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!hasRole(session.user.role, "campaign_admin")) {
    redirect(`/admin/campaigns/${id}`);
  }

  const [campaign, clients] = await Promise.all([
    prisma.campaign.findUnique({ where: { id } }),
    prisma.client.findMany({
      where: { status: "active" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!campaign) notFound();

  return (
    <div className="min-h-screen">
      <AdminHeader user={session.user} />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link
          href={`/admin/campaigns/${id}`}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-[#374151] hover:text-[#1C1C1C]"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to campaign
        </Link>
        <h1 className="mb-6 t-page-title">Edit campaign</h1>
        <CampaignForm
          mode="edit"
          clients={clients}
          initial={{
            id: campaign.id,
            clientId: campaign.clientId,
            year: campaign.year,
            name: campaign.name,
            timezone: campaign.timezone,
            startAt: campaign.startAt?.toISOString() ?? null,
            visibleCloseAt: campaign.visibleCloseAt?.toISOString() ?? null,
            tokenExpiresAt: campaign.tokenExpiresAt?.toISOString() ?? null,
            introCopy: campaign.introCopy,
            invitationCopy: campaign.invitationCopy,
            anonymityThreshold: campaign.anonymityThreshold,
            theme: campaign.theme,
            logoUrl: campaign.logoUrl,
            logoAlt: campaign.logoAlt,
            welcomeCopyJson: campaign.welcomeCopyJson,
            updatedAt: campaign.updatedAt.toISOString(),
          }}
        />
      </main>
    </div>
  );
}

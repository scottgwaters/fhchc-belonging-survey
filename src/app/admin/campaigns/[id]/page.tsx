import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getSession, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { CampaignDetail } from "@/components/admin/CampaignDetail";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      client: { select: { name: true, slug: true } },
      questionSchemas: {
        include: { questions: { select: { id: true } } },
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: {
          recipients: true,
          responses: {
            where: { isComplete: true, isTestData: false, isPreview: false },
          },
        },
      },
    },
  });

  if (!campaign) notFound();

  const statusLogs = await prisma.campaignStatusLog.findMany({
    where: { campaignId: id },
    include: {
      changedByUser: { select: { name: true, email: true } },
    },
    orderBy: { changedAt: "desc" },
    take: 20,
  });

  const canEdit = hasRole(session.user.role, "campaign_admin");

  return (
    <div className="min-h-screen">
      <AdminHeader user={session.user} />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Link
          href="/admin"
          className="mb-4 inline-flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#1C1C1C]"
        >
          <ChevronLeft className="h-4 w-4" />
          Campaigns
        </Link>
        <CampaignDetail
          campaign={campaign}
          statusLogs={statusLogs}
          canEdit={canEdit}
          userRole={session.user.role}
        />
      </main>
    </div>
  );
}

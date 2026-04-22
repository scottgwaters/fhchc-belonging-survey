import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getSession, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { ExportPanel, ExportHistory } from "@/components/admin/ExportPanel";

export default async function ExportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!campaign) notFound();

  const exports = await prisma.export.findMany({
    where: { campaignId: id },
    orderBy: { generatedAt: "desc" },
    take: 50,
    include: { user: { select: { name: true, email: true } } },
  });

  const canDownload = hasRole(session.user.role, "campaign_admin");

  return (
    <div className="min-h-screen">
      <AdminHeader user={session.user} />
      <main className="mx-auto max-w-3xl px-6 py-8 space-y-6">
        <div>
          <Link
            href={`/admin/campaigns/${id}`}
            className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-[#374151] hover:text-[#1C1C1C]"
          >
            <ChevronLeft className="h-4 w-4" />
            {campaign.name}
          </Link>
          <h1 className="t-page-title">Exports</h1>
          <p className="mt-2 t-helper max-w-2xl">
            CSV downloads for analysis tools. All exports apply the production-data
            filter (no test or preview rows).
          </p>
        </div>

        <ExportPanel campaignId={id} canDownload={canDownload} />

        <div className="rounded-2xl border border-[#D9DFDA] bg-white p-6">
          <h2 className="t-section mb-3">History</h2>
          <ExportHistory exports={exports} />
        </div>
      </main>
    </div>
  );
}

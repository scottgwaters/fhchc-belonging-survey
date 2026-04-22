import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeCampaignReport } from "@/lib/reporting";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { ReportView } from "@/components/admin/ReportView";

export default async function ReportingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, name: true, anonymityThreshold: true },
  });
  if (!campaign) notFound();

  const report = await computeCampaignReport(id);

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
          <h1 className="t-page-title">Results</h1>
          <p className="mt-2 t-helper max-w-2xl">
            All percentages exclude test/preview rows. Cells with fewer than{" "}
            {campaign.anonymityThreshold} substantive responses are suppressed
            (PRD BR-1, §8.14).
          </p>
        </div>

        <ReportView totals={report.totals} questions={report.questions} />
      </main>
    </div>
  );
}

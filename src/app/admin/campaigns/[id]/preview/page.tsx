import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CampaignPreview } from "@/components/admin/CampaignPreview";
import type { ThemeId } from "@/lib/themes";

export default async function CampaignPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      introCopy: true,
      visibleCloseAt: true,
      theme: true,
      logoUrl: true,
      logoAlt: true,
      welcomeCopyJson: true,
    },
  });
  if (!campaign) notFound();

  const schema = await prisma.questionSchema.findFirst({
    where: { campaignId: id },
    orderBy: { createdAt: "desc" },
    include: {
      questions: {
        where: { activeStatus: "active" },
        orderBy: [{ sectionKey: "asc" }, { displayOrder: "asc" }],
      },
    },
  });

  const questions = (schema?.questions ?? []).map((q) => ({
    id: q.id,
    metricCode: q.metricCode,
    sectionKey: q.sectionKey,
    displayOrder: q.displayOrder,
    prompt: q.prompt,
    helpText: q.helpText,
    responseType: q.responseType,
    required: q.required,
    optionsJson: q.optionsJson,
    parentQuestionId: q.parentQuestionId,
    showIfParentValue: q.showIfParentValue,
    reverseScore: q.reverseScore,
  }));

  return (
    <div className="min-h-screen">
      {/* Admin back-bar (lives above the preview ribbon) */}
      <div className="border-b border-[#D9DFDA] bg-white px-4 py-2 text-xs">
        <Link
          href={`/admin/campaigns/${campaign.id}`}
          className="inline-flex items-center gap-1 font-medium text-[#374151] hover:text-[#1C1C1C]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to {campaign.name}
        </Link>
      </div>

      <CampaignPreview
        campaign={{
          id: campaign.id,
          name: campaign.name,
          introCopy: campaign.introCopy,
          visibleCloseAt: campaign.visibleCloseAt,
          theme: campaign.theme as ThemeId,
          logoUrl: campaign.logoUrl,
          logoAlt: campaign.logoAlt,
          welcomeCopyJson: campaign.welcomeCopyJson,
        }}
        questions={questions}
      />
    </div>
  );
}

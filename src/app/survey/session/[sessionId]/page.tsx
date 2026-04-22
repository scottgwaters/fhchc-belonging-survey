import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SurveyShell } from "@/components/survey/SurveyShell";

export default async function SurveySessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const draft = await prisma.responseDraft.findFirst({
    where: { anonymousSessionId: sessionId },
  });
  if (!draft) notFound();

  const campaign = await prisma.campaign.findUnique({
    where: { id: draft.campaignId },
    select: {
      id: true,
      name: true,
      status: true,
      emtCodeHash: true,
      theme: true,
      logoUrl: true,
      logoAlt: true,
    },
  });
  if (!campaign) notFound();

  const schema = await prisma.questionSchema.findFirst({
    where: { campaignId: campaign.id },
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
    <SurveyShell
      sessionId={sessionId}
      campaign={{
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        theme: campaign.theme,
        logoUrl: campaign.logoUrl,
        logoAlt: campaign.logoAlt,
      }}
      emtCodeRequired={Boolean(campaign.emtCodeHash)}
      emtAlreadyValidated={draft.isEmtFlagged}
      questions={questions}
      initialResponses={
        (draft.responseItemsJson as Record<string, unknown>) ?? {}
      }
      initialSectionProgress={draft.sectionProgress}
    />
  );
}

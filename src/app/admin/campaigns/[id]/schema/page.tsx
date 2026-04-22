import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getSession, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { SchemaList } from "@/components/admin/SchemaList";

export default async function SchemaPage({
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

  // For MVP we use the most recently created schema. Versioning publish-flow
  // (PRD §8.17.1 freeze on schedule/live) is a follow-up.
  let schema = await prisma.questionSchema.findFirst({
    where: { campaignId: id },
    orderBy: { createdAt: "desc" },
    include: { questions: true },
  });

  if (!schema) {
    // Auto-create a default v1 schema so admin can start editing immediately
    schema = await prisma.questionSchema.create({
      data: {
        campaignId: id,
        versionName: `${new Date().getFullYear()}-v1`,
        schemaJson: {},
      },
      include: { questions: true },
    });
  }

  const questions = schema.questions
    .map((q) => ({
      id: q.id,
      schemaId: q.schemaId,
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
      reportingConfigJson: q.reportingConfigJson,
      activeStatus: q.activeStatus,
      comparableToPrior: q.comparableToPrior,
    }))
    .sort((a, b) =>
      a.sectionKey === b.sectionKey
        ? a.displayOrder - b.displayOrder
        : a.sectionKey.localeCompare(b.sectionKey)
    );

  // Candidate parents: any non-follow-up question of single_select type
  const candidateParents = questions
    .filter((q) => !q.parentQuestionId && q.responseType === "single_select")
    .map((q) => ({ id: q.id, prompt: q.prompt }));

  const canEdit = hasRole(session.user.role, "campaign_admin");
  const frozen = campaign.status === "live" || campaign.status === "closed";

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
          <h1 className="t-page-title">Question schema</h1>
          <p className="mt-2 t-helper">
            Version <code className="rounded bg-[#DCE8E4] px-1.5 py-0.5 text-[12px] text-[#1D3931]">{schema.versionName}</code> · {questions.length} question
            {questions.length === 1 ? "" : "s"}
          </p>
          {frozen && (
            <p className="mt-3 rounded-xl bg-[#FEF3C7] px-3 py-2 text-xs text-[#92400E]">
              Campaign is {campaign.status}. Schema edits during live/closed
              campaigns are still recorded but should be reserved for typo fixes —
              version-publish workflow is a follow-up (PRD §8.17.1).
            </p>
          )}
        </div>

        <SchemaList
          campaignId={id}
          schemaId={schema.id}
          questions={questions}
          candidateParents={candidateParents}
          canEdit={canEdit}
        />
      </main>
    </div>
  );
}

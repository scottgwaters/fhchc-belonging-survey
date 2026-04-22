"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  CheckCircle2,
  Eye,
} from "lucide-react";
import { SurveyChrome } from "@/components/survey/SurveyChrome";
import { SurveyWelcome } from "@/components/survey/SurveyWelcome";
import { QuestionRenderer, type Question } from "@/components/survey/QuestionRenderer";
import { renderMarkdownToHtml } from "@/lib/render-markdown";
import type { ThemeId } from "@/lib/themes";

export interface PreviewCampaign {
  id: string;
  name: string;
  introCopy: string | null;
  visibleCloseAt: Date | string | null;
  theme: ThemeId | string;
  logoUrl: string | null;
  logoAlt: string | null;
  welcomeCopyJson?: unknown;
}

interface Props {
  campaign: PreviewCampaign;
  questions: Question[];
}

type Phase = "welcome" | "survey" | "review" | "complete";

interface Step {
  sectionKey: string;
  questions: Question[];
}

function buildSteps(questions: Question[]): Step[] {
  const grouped = new Map<string, Question[]>();
  for (const q of questions) {
    if (q.parentQuestionId) continue;
    const list = grouped.get(q.sectionKey) ?? [];
    list.push(q);
    grouped.set(q.sectionKey, list);
  }
  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sectionKey, qs]) => ({
      sectionKey,
      questions: qs.sort((a, b) => a.displayOrder - b.displayOrder),
    }));
}

function formatDate(d: Date | string | null): string {
  if (!d) return "the deadline";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatAnswer(q: Question, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (q.responseType === "open_text") return String(v);
  if (q.responseType === "single_select") return String(v);
  if (q.responseType === "multi_select") {
    const obj = v as { selected?: string[]; other_text?: string };
    const sel = obj.selected ?? [];
    if (obj.other_text)
      return [...sel.filter((s) => s !== "Other"), `Other: ${obj.other_text}`].join(", ");
    return sel.join(", ");
  }
  if (q.responseType === "slider") {
    if (typeof v === "number") return String(v);
    if (typeof v === "object") {
      return Object.entries(v as Record<string, number>)
        .map(([k, n]) => `${k}: ${n}`)
        .join(", ");
    }
  }
  if (q.responseType === "likert_grid" && typeof v === "object") {
    return Object.entries(v as Record<string, string>)
      .map(([k, s]) => `${k}: ${s}`)
      .join(", ");
  }
  if (q.responseType === "ranking" && typeof v === "object") {
    const order = (v as { order?: string[] }).order ?? [];
    return order.map((o, i) => `${i + 1}. ${o}`).join(", ");
  }
  return JSON.stringify(v);
}

export function CampaignPreview({ campaign, questions }: Props) {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [stepIndex, setStepIndex] = useState(0);

  const steps = useMemo(() => buildSteps(questions), [questions]);
  const currentStep = steps[stepIndex];
  const totalSteps = steps.length;

  const introHtml = useMemo(
    () => (campaign.introCopy ? renderMarkdownToHtml(campaign.introCopy) : ""),
    [campaign.introCopy]
  );

  function update(qid: string, value: unknown) {
    setResponses((r) => {
      const next = { ...r, [qid]: value };
      const parent = questions.find((q) => q.id === qid);
      if (parent) {
        for (const fu of questions) {
          if (fu.parentQuestionId === parent.id) {
            const stillVisible = (value ?? "") === (fu.showIfParentValue ?? "");
            if (!stillVisible) delete next[fu.id];
          }
        }
      }
      return next;
    });
  }

  function findFollowUps(parentId: string, parentValue: unknown): Question[] {
    return questions.filter(
      (q) =>
        q.parentQuestionId === parentId &&
        (parentValue ?? "") === (q.showIfParentValue ?? "")
    );
  }

  function advance() {
    if (phase === "welcome") {
      setPhase(totalSteps === 0 ? "complete" : "survey");
      return;
    }
    if (phase === "survey") {
      if (stepIndex + 1 < totalSteps) {
        setStepIndex(stepIndex + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setPhase("review");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }
    if (phase === "review") {
      setPhase("complete");
      return;
    }
  }

  function back() {
    if (phase === "review") {
      setPhase("survey");
      return;
    }
    if (phase === "survey") {
      if (stepIndex > 0) setStepIndex(stepIndex - 1);
      else setPhase("welcome");
      return;
    }
  }

  function restart() {
    setResponses({});
    setStepIndex(0);
    setPhase("welcome");
  }

  const progress =
    phase === "welcome"
      ? 0
      : phase === "complete"
      ? 1
      : phase === "review"
      ? 1
      : totalSteps === 0
      ? 0
      : (stepIndex + 1) / (totalSteps + 1);

  return (
    <>
      <PreviewRibbon onRestart={restart} />
      <SurveyChrome
        progressFraction={progress}
        stepLabel={
          phase === "survey" && currentStep
            ? `${currentStep.sectionKey} · Step ${stepIndex + 1} of ${totalSteps}`
            : phase === "review"
            ? "Review"
            : undefined
        }
        theme={campaign.theme}
        logoUrl={campaign.logoUrl}
        logoAlt={campaign.logoAlt}
      >
        {phase === "welcome" && (
          <SurveyWelcome
            campaignName={campaign.name}
            introHtml={introHtml || undefined}
            visibleCloseDateLabel={formatDate(campaign.visibleCloseAt)}
            pendingLabel="Begin survey"
            onBegin={advance}
            copy={
              campaign.welcomeCopyJson as
                | import("@/lib/welcome-copy").WelcomeCopy
                | null
                | undefined
            }
          />
        )}

        {phase === "survey" && currentStep && (
          <div className="space-y-8">
            {currentStep.questions.map((q) => {
              const v = responses[q.id];
              const followUps = findFollowUps(q.id, v);
              return (
                <div key={q.id} className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold text-[#1C1C1C] leading-snug">
                      {q.prompt}
                    </h2>
                    {q.helpText && (
                      <p className="mt-1.5 text-sm text-[#374151]">{q.helpText}</p>
                    )}
                  </div>
                  <QuestionRenderer
                    question={q}
                    value={v}
                    onChange={(nv) => update(q.id, nv)}
                  />
                  {followUps.map((fu) => (
                    <div
                      key={fu.id}
                      className="ml-3 border-l-2 pl-4"
                      style={{ borderColor: "var(--accent)" }}
                    >
                      <p className="mb-2 text-base font-medium text-[#1C1C1C]">
                        {fu.prompt}
                      </p>
                      {fu.helpText && (
                        <p className="mb-2 text-sm text-[#374151]">{fu.helpText}</p>
                      )}
                      <QuestionRenderer
                        question={fu}
                        value={responses[fu.id]}
                        onChange={(nv) => update(fu.id, nv)}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {phase === "review" && (
          <ReviewPanel
            questions={questions}
            steps={steps}
            responses={responses}
            onEditStep={(idx) => {
              setStepIndex(idx);
              setPhase("survey");
            }}
          />
        )}

        {phase === "complete" && <CompleteCard onRestart={restart} />}

        {(phase === "survey" || phase === "review") && (
          <StickyNav
            onBack={back}
            onNext={advance}
            backDisabled={phase === "survey" && stepIndex === 0}
            nextLabel={
              phase === "review"
                ? "Submit responses"
                : stepIndex + 1 === totalSteps
                ? "Review"
                : "Continue"
            }
          />
        )}
      </SurveyChrome>
    </>
  );
}

function PreviewRibbon({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-[#E5E7EB] bg-[#FEF3C7] px-4 py-2 text-xs font-medium text-[#92400E]">
      <span className="inline-flex items-center gap-1.5">
        <Eye className="h-3.5 w-3.5" />
        Preview mode — responses aren&rsquo;t saved
      </span>
      <button
        type="button"
        onClick={onRestart}
        className="rounded-full border border-[#FDE68A] bg-white px-2.5 py-0.5 text-xs font-medium text-[#92400E] hover:bg-[#FEF3C7]"
      >
        Restart
      </button>
    </div>
  );
}

function CompleteCard({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="rounded-3xl border border-[#D9DFDA] bg-white p-10 text-center shadow-sm">
      <div
        className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: "var(--accent-soft)" }}
      >
        <CheckCircle2 className="h-7 w-7" style={{ color: "var(--accent-strong)" }} />
      </div>
      <h1 className="t-page-title">Thank you</h1>
      <p className="mt-3 text-base text-[#374151]">
        Your survey has been received. Results will be shared with leadership
        in aggregate — no individual response is linked to your identity.
      </p>
      <button
        type="button"
        onClick={onRestart}
        className="mt-6 inline-flex h-11 items-center rounded-full border border-[#D9DFDA] bg-white px-4 text-sm font-medium text-[#1C1C1C] hover:bg-[#F7F9F7]"
      >
        Restart preview
      </button>
    </div>
  );
}

function ReviewPanel({
  questions,
  steps,
  responses,
  onEditStep,
}: {
  questions: Question[];
  steps: Step[];
  responses: Record<string, unknown>;
  onEditStep: (idx: number) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="t-page-title">Review your responses</h1>
        <p className="mt-2 text-sm text-[#374151]">
          Take a moment to review. Your individual answers will be combined with
          everyone else&rsquo;s.
        </p>
      </div>
      {steps.map((step, idx) => (
        <div
          key={step.sectionKey}
          className="rounded-2xl border border-[#D9DFDA] bg-white p-6"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="t-section">{step.sectionKey}</h2>
            <button
              type="button"
              onClick={() => onEditStep(idx)}
              className="text-sm font-medium underline underline-offset-4"
              style={{ color: "var(--accent-strong)" }}
            >
              Edit
            </button>
          </div>
          <ul className="space-y-4 text-sm">
            {step.questions.map((q) => (
              <li key={q.id}>
                <p className="text-[#374151]">{q.prompt}</p>
                <p className="mt-1 font-medium text-[#1C1C1C]">
                  {formatAnswer(q, responses[q.id])}
                </p>
                {questions
                  .filter(
                    (fu) =>
                      fu.parentQuestionId === q.id &&
                      (responses[q.id] ?? "") === (fu.showIfParentValue ?? "")
                  )
                  .map((fu) => (
                    <div
                      key={fu.id}
                      className="ml-3 mt-2 border-l-2 pl-3"
                      style={{ borderColor: "var(--accent)" }}
                    >
                      <p className="text-[#374151]">{fu.prompt}</p>
                      <p className="mt-0.5 font-medium text-[#1C1C1C]">
                        {formatAnswer(fu, responses[fu.id])}
                      </p>
                    </div>
                  ))}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function StickyNav({
  onBack,
  onNext,
  backDisabled,
  nextLabel,
}: {
  onBack: () => void;
  onNext: () => void;
  backDisabled?: boolean;
  nextLabel: string;
}) {
  return (
    <div className="sticky bottom-0 mt-8 -mx-6 border-t border-[#D9DFDA] bg-white/90 px-6 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
        <button
          type="button"
          disabled={backDisabled}
          onClick={onBack}
          className="inline-flex h-11 items-center gap-1 rounded-full px-4 text-sm font-medium text-[#374151] hover:bg-[#F7F9F7] hover:text-[#1C1C1C] disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[#1C1C1C] px-5 text-sm font-medium text-white hover:bg-[#1D3931]"
        >
          {nextLabel}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

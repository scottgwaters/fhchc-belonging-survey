"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ArrowRight } from "lucide-react";
import { SurveyChrome } from "./SurveyChrome";
import { QuestionRenderer, type Question } from "./QuestionRenderer";
import { EmtCodeStep } from "./EmtCodeStep";

interface CampaignInfo {
  id: string;
  name: string;
  status: string;
  theme?: string | null;
  logoUrl?: string | null;
  logoAlt?: string | null;
}

interface Props {
  sessionId: string;
  campaign: CampaignInfo;
  emtCodeRequired: boolean;
  emtAlreadyValidated: boolean;
  questions: Question[];
  initialResponses: Record<string, unknown>;
  initialSectionProgress: string | null;
}

const AUTOSAVE_DEBOUNCE_MS = 800;
const AUTOSAVE_INTERVAL_MS = 30_000;

interface Step {
  sectionKey: string;
  questions: Question[]; // top-level questions in this section (excludes follow-ups)
}

function buildSteps(questions: Question[]): Step[] {
  const grouped = new Map<string, Question[]>();
  for (const q of questions) {
    if (q.parentQuestionId) continue; // follow-ups render inline
    const list = grouped.get(q.sectionKey) ?? [];
    list.push(q);
    grouped.set(q.sectionKey, list);
  }
  return Array.from(grouped.entries()).map(([sectionKey, qs]) => ({
    sectionKey,
    questions: qs.sort((a, b) => a.displayOrder - b.displayOrder),
  }));
}

function findFollowUps(parent: Question, all: Question[], parentValue: unknown): Question[] {
  return all.filter(
    (q) => q.parentQuestionId === parent.id && (parentValue ?? "") === (q.showIfParentValue ?? "")
  );
}

function isAnswered(q: Question, v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (q.responseType === "open_text") return typeof v === "string" && v.trim().length > 0;
  if (q.responseType === "single_select") return typeof v === "string" && v.length > 0;
  if (q.responseType === "multi_select") {
    const sel = (v as { selected?: string[] }).selected ?? [];
    return sel.length > 0;
  }
  if (q.responseType === "slider") return v !== undefined;
  return Boolean(v);
}

export function SurveyShell({
  sessionId,
  campaign,
  emtCodeRequired,
  emtAlreadyValidated,
  questions,
  initialResponses,
  initialSectionProgress,
}: Props) {
  const router = useRouter();
  const [responses, setResponses] = useState<Record<string, unknown>>(initialResponses);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, startSubmit] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [emtStepDone, setEmtStepDone] = useState(
    !emtCodeRequired || emtAlreadyValidated
  );

  const steps = useMemo(() => buildSteps(questions), [questions]);
  const lastSavePayload = useRef<string>("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize step from saved sectionProgress on first render only
  const [initializedFromProgress, setInitializedFromProgress] = useState(false);
  if (!initializedFromProgress && initialSectionProgress) {
    const idx = steps.findIndex((s) => s.sectionKey === initialSectionProgress);
    if (idx >= 0 && idx !== stepIndex) setStepIndex(idx);
    setInitializedFromProgress(true);
  }

  async function save(payload: Record<string, unknown>, sectionKey: string | null) {
    const key = JSON.stringify({ payload, sectionKey });
    if (key === lastSavePayload.current) return;
    lastSavePayload.current = key;
    try {
      await fetch(`/api/survey/session/${sessionId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseItems: payload, sectionProgress: sectionKey }),
      });
    } catch {
      // ignore — next attempt will retry
    }
  }

  // Debounced save on every change
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      save(responses, steps[stepIndex]?.sectionKey ?? null);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responses, stepIndex]);

  // Periodic save on inactivity
  useEffect(() => {
    const t = setInterval(() => {
      save(responses, steps[stepIndex]?.sectionKey ?? null);
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responses, stepIndex]);

  function update(qid: string, value: unknown) {
    setResponses((r) => {
      const next = { ...r, [qid]: value };
      // Clear orphaned follow-up answers when parent changes
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

  const currentStep = steps[stepIndex];
  const totalSteps = steps.length;

  function canAdvance(): boolean {
    if (!currentStep) return true;
    for (const q of currentStep.questions) {
      if (!q.required) continue;
      if (!isAnswered(q, responses[q.id])) return false;
      // Required follow-ups
      const fus = findFollowUps(q, questions, responses[q.id]);
      for (const fu of fus) {
        if (fu.required && !isAnswered(fu, responses[fu.id])) return false;
      }
    }
    return true;
  }

  async function next() {
    await save(responses, currentStep?.sectionKey ?? null);
    if (stepIndex + 1 < totalSteps) {
      setStepIndex(stepIndex + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setReviewing(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function back() {
    if (reviewing) {
      setReviewing(false);
      return;
    }
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }

  async function submit() {
    setSubmitError(null);
    startSubmit(async () => {
      const res = await fetch(`/api/survey/session/${sessionId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseItems: responses }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(body.error ?? "Could not submit. Try again.");
        return;
      }
      router.push(`/survey/session/${sessionId}/complete`);
    });
  }

  const progress = reviewing
    ? 1
    : totalSteps === 0
    ? 0
    : (stepIndex + 1) / (totalSteps + 1);

  const chromeTheme = campaign.theme ?? null;
  const chromeLogoUrl = campaign.logoUrl ?? null;
  const chromeLogoAlt = campaign.logoAlt ?? null;

  if (reviewing) {
    return (
      <SurveyChrome
        progressFraction={progress}
        stepLabel="Review"
        theme={chromeTheme}
        logoUrl={chromeLogoUrl}
        logoAlt={chromeLogoAlt}
      >
        <ReviewPanel
          questions={questions}
          responses={responses}
          steps={steps}
          onEditStep={(idx) => {
            setReviewing(false);
            setStepIndex(idx);
          }}
        />
        {submitError && (
          <div className="mt-4 rounded-xl bg-[#FEE2E2] p-3 text-sm text-[#991B1B]">
            {submitError}
          </div>
        )}
        <StickyNav
          onBack={back}
          onNext={submit}
          nextLabel={submitting ? "Submitting..." : "Submit responses"}
          nextDisabled={submitting}
          stepText="Review · ready to submit"
        />
      </SurveyChrome>
    );
  }

  if (!emtStepDone) {
    return (
      <SurveyChrome
        stepLabel="Before you begin"
        theme={chromeTheme}
        logoUrl={chromeLogoUrl}
        logoAlt={chromeLogoAlt}
      >
        <EmtCodeStep
          sessionId={sessionId}
          required={emtCodeRequired}
          onContinue={() => setEmtStepDone(true)}
        />
      </SurveyChrome>
    );
  }

  if (!currentStep) {
    return (
      <SurveyChrome theme={chromeTheme} logoUrl={chromeLogoUrl} logoAlt={chromeLogoAlt}>
        <p className="text-sm text-[#6B7280]">
          This campaign has no questions yet. Please contact your administrator.
        </p>
      </SurveyChrome>
    );
  }

  return (
    <SurveyChrome
      progressFraction={progress}
      stepLabel={`${currentStep.sectionKey} · Step ${stepIndex + 1} of ${totalSteps}`}
      theme={chromeTheme}
      logoUrl={chromeLogoUrl}
      logoAlt={chromeLogoAlt}
    >
      <div className="space-y-8">
        {currentStep.questions.map((q) => {
          const v = responses[q.id];
          const followUps = findFollowUps(q, questions, v);
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
                  className="ml-3 border-l-2 border-[#2F5D54] pl-4"
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

      <StickyNav
        onBack={back}
        onNext={next}
        backDisabled={stepIndex === 0}
        nextLabel={stepIndex + 1 === totalSteps ? "Review" : "Continue"}
        nextDisabled={!canAdvance()}
        stepText={`${campaign.name} · Step ${stepIndex + 1} of ${totalSteps}`}
      />
    </SurveyChrome>
  );
}

function StickyNav({
  onBack,
  onNext,
  backDisabled,
  nextLabel,
  nextDisabled,
  stepText,
}: {
  onBack: () => void;
  onNext: () => void;
  backDisabled?: boolean;
  nextLabel: string;
  nextDisabled?: boolean;
  stepText: string;
}) {
  return (
    <div className="sticky bottom-0 mt-8 -mx-6 border-t border-[#D9DFDA] bg-white/90 px-6 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
        <button
          type="button"
          disabled={backDisabled}
          onClick={onBack}
          className="inline-flex h-11 items-center gap-1 rounded-full px-4 text-sm font-medium text-[#374151] hover:bg-[#F7F9F7] hover:text-[#1C1C1C] disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5D54] focus-visible:ring-offset-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <span className="text-xs font-medium text-[#374151] sm:text-sm">{stepText}</span>
        <button
          type="button"
          disabled={nextDisabled}
          onClick={onNext}
          className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[#1C1C1C] px-5 text-sm font-medium text-white hover:bg-[#1D3931] disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5D54] focus-visible:ring-offset-2"
        >
          {nextLabel}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function formatAnswer(q: Question, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (q.responseType === "open_text") return String(v);
  if (q.responseType === "single_select") return String(v);
  if (q.responseType === "multi_select") {
    const obj = v as { selected?: string[]; other_text?: string };
    const sel = obj.selected ?? [];
    if (obj.other_text) return [...sel.filter((s) => s !== "Other"), `Other: ${obj.other_text}`].join(", ");
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
  return JSON.stringify(v);
}

function ReviewPanel({
  questions,
  responses,
  steps,
  onEditStep,
}: {
  questions: Question[];
  responses: Record<string, unknown>;
  steps: Step[];
  onEditStep: (idx: number) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="t-page-title">Review your responses</h1>
        <p className="mt-2 text-sm text-[#374151]">
          Take a moment to review. Your individual answers will be combined with
          everyone else&rsquo;s &mdash; they aren&rsquo;t linked to your name or email.
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
              className="text-sm font-medium text-[#244943] underline underline-offset-4 decoration-[#2F5D54] hover:text-[#1D3931]"
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
                    <div key={fu.id} className="ml-3 mt-2 border-l-2 border-[#2F5D54] pl-3">
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

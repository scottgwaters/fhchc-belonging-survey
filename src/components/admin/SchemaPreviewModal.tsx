"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ArrowRight, Lock, X } from "lucide-react";
import { QuestionRenderer, type Question } from "@/components/survey/QuestionRenderer";
import type { EditableQuestion } from "./QuestionEditor";

interface Props {
  questions: EditableQuestion[];
  onClose: () => void;
}

interface Step {
  sectionKey: string;
  questions: Question[];
}

function toRendererQuestion(q: EditableQuestion): Question {
  return {
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
  };
}

function buildSteps(questions: EditableQuestion[]): Step[] {
  const grouped = new Map<string, EditableQuestion[]>();
  for (const q of questions) {
    if (q.parentQuestionId) continue;
    if (q.activeStatus !== "active") continue;
    const list = grouped.get(q.sectionKey) ?? [];
    list.push(q);
    grouped.set(q.sectionKey, list);
  }
  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sectionKey, qs]) => ({
      sectionKey,
      questions: qs
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(toRendererQuestion),
    }));
}

export function SchemaPreviewModal({ questions, onClose }: Props) {
  const allRendererQuestions = useMemo(
    () => questions.filter((q) => q.activeStatus === "active").map(toRendererQuestion),
    [questions]
  );
  const steps = useMemo(() => buildSteps(questions), [questions]);
  const [stepIndex, setStepIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, unknown>>({});

  const currentStep = steps[stepIndex];
  const progress = steps.length === 0 ? 0 : (stepIndex + 1) / (steps.length + 1);
  const pct = Math.round(progress * 100);

  function update(qid: string, value: unknown) {
    setResponses((r) => ({ ...r, [qid]: value }));
  }

  function findFollowUps(parentId: string, parentValue: unknown): Question[] {
    return allRendererQuestions.filter(
      (q) =>
        q.parentQuestionId === parentId &&
        (parentValue ?? "") === (q.showIfParentValue ?? "")
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch overflow-y-auto bg-black/40 p-0 sm:p-6">
      <div className="m-auto w-full max-w-3xl overflow-hidden rounded-none border-0 bg-[#F7F9F7] shadow-2xl sm:rounded-3xl sm:border sm:border-[#E8ECE8]">
        {/* Modal toolbar (admin chrome) */}
        <div className="flex items-center justify-between border-b border-[#D9DFDA] bg-white px-5 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#244943]">
            Survey preview
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#6B7280] hover:bg-[#F7F9F7]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Survey chrome */}
        <div className="border-b border-[#D9DFDA] bg-white">
          <div className="flex h-12 items-center justify-between px-6">
            <div className="flex items-center gap-2 text-sm font-medium text-[#1C1C1C]">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#2F5D54] text-xs text-white">
                B
              </span>
              <span>Belonging Index</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#244943]">
              <Lock className="h-3.5 w-3.5" />
              Confidential
            </div>
          </div>
          <div className="h-0.5 w-full bg-[#EFF3EF]">
            <div
              className="h-full bg-[#2F5D54] transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-8">
          {!currentStep ? (
            <p className="text-sm text-[#6B7280]">
              No active questions to preview. Add some, then click Preview again.
            </p>
          ) : (
            <>
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#6B7280]">
                {currentStep.sectionKey} · Step {stepIndex + 1} of {steps.length}
              </p>
              <div className="space-y-6">
                {currentStep.questions.map((q) => {
                  const v = responses[q.id];
                  const followUps = findFollowUps(q.id, v);
                  return (
                    <div key={q.id} className="space-y-3">
                      <div>
                        <h2 className="text-lg font-medium text-[#1C1C1C]">
                          {q.prompt}
                        </h2>
                        {q.helpText && (
                          <p className="mt-1 text-sm text-[#6B7280]">{q.helpText}</p>
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
                          className="ml-3 border-l-2 border-[#C5D6CF] pl-4"
                        >
                          <p className="mb-2 text-sm font-medium text-[#1C1C1C]">
                            {fu.prompt}
                          </p>
                          {fu.helpText && (
                            <p className="mb-2 text-xs text-[#9CA3AF]">{fu.helpText}</p>
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
            </>
          )}
        </div>

        {/* Footer nav */}
        {currentStep && (
          <div className="flex items-center justify-between border-t border-[#D9DFDA] bg-white/85 px-6 py-3 backdrop-blur">
            <button
              type="button"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              className="inline-flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#1C1C1C] disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <span className="hidden text-xs text-[#9CA3AF] sm:inline">
              Preview only · responses are not saved
            </span>
            {stepIndex + 1 < steps.length ? (
              <button
                type="button"
                onClick={() => setStepIndex((i) => i + 1)}
                className="inline-flex items-center gap-1 rounded-full bg-[#1C1C1C] px-5 py-2 text-sm font-medium text-white hover:bg-[#1D3931]"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1 rounded-full bg-[#1C1C1C] px-5 py-2 text-sm font-medium text-white hover:bg-[#1D3931]"
              >
                Close preview
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

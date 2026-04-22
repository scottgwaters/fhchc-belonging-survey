"use client";

import { useState } from "react";
import { Plus, Pencil, Eye } from "lucide-react";
import { QuestionEditor, type EditableQuestion } from "./QuestionEditor";
import { SchemaPreviewModal } from "./SchemaPreviewModal";
import { Badge, Button } from "@/components/ui/primitives";

interface Props {
  campaignId: string;
  schemaId: string;
  questions: EditableQuestion[];
  candidateParents: { id: string; prompt: string }[];
  canEdit: boolean;
}

export function SchemaList({
  campaignId,
  schemaId,
  questions,
  candidateParents,
  canEdit,
}: Props) {
  const [editing, setEditing] = useState<EditableQuestion | null>(null);
  const [creating, setCreating] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const sections = Array.from(new Set(questions.map((q) => q.sectionKey)));
  const sortedSections = sections.sort();
  const activeCount = questions.filter((q) => q.activeStatus === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setPreviewing(true)}
          disabled={activeCount === 0}
          leftIcon={<Eye className="h-3.5 w-3.5" />}
          title={activeCount === 0 ? "Add an active question first" : "Preview as a respondent"}
        >
          Preview
        </Button>
        {canEdit && (
          <Button
            type="button"
            variant="primary"
            onClick={() => setCreating(true)}
            leftIcon={<Plus className="h-3.5 w-3.5" />}
          >
            New question
          </Button>
        )}
      </div>

      {sortedSections.map((sectionKey) => {
        const items = questions
          .filter((q) => q.sectionKey === sectionKey)
          .sort((a, b) => a.displayOrder - b.displayOrder);
        return (
          <div
            key={sectionKey}
            className="rounded-2xl border border-[#D9DFDA] bg-white overflow-hidden"
          >
            <div className="flex items-baseline gap-2 border-b border-[#E8ECE8] bg-[#F7F9F7] px-6 py-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#1C1C1C]">
                {sectionKey}
              </span>
              <span className="text-xs text-[#6B7280]">
                · {items.length} question{items.length === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="divide-y divide-[#E8ECE8]">
              {items.map((q) => {
                const isFollowUp = q.parentQuestionId !== null;
                const inactive = q.activeStatus !== "active";
                return (
                  <li
                    key={q.id}
                    className={`px-6 py-4 ${inactive ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-[#F7F9F7] px-1.5 py-0.5 text-xs font-mono text-[#374151]">
                            #{q.displayOrder}
                          </span>
                          <Badge tone="sage">{q.responseType}</Badge>
                          {q.required && (
                            <span className="text-xs text-[#374151]">required</span>
                          )}
                          {q.reverseScore && <Badge tone="amber">reverse</Badge>}
                          {isFollowUp && <Badge tone="blue">follow-up</Badge>}
                          {inactive && <Badge tone="gray">{q.activeStatus}</Badge>}
                        </div>
                        <p className="mt-2 text-sm font-medium text-[#1C1C1C]">
                          {q.prompt}
                        </p>
                        {q.metricCode && (
                          <p className="mt-1 text-xs text-[#6B7280]">
                            metric_code:{" "}
                            <code className="rounded bg-[#F7F9F7] px-1 py-0.5 text-[11px] text-[#374151]">
                              {q.metricCode}
                            </code>
                          </p>
                        )}
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => setEditing(q)}
                          aria-label={`Edit question: ${q.prompt.slice(0, 40)}`}
                          className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D9DFDA] bg-white text-[#374151] hover:bg-[#F7F9F7] hover:text-[#1C1C1C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5D54] focus-visible:ring-offset-2"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {questions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#C7D0CA] bg-white p-10 text-center">
          <p className="text-sm font-medium text-[#1C1C1C]">No questions yet.</p>
          <p className="mt-1 t-helper">
            Click <strong>New question</strong> to start building the schema.
          </p>
        </div>
      )}

      {(editing || creating) && (
        <QuestionEditor
          campaignId={campaignId}
          schemaId={schemaId}
          question={editing}
          candidateParents={candidateParents}
          knownSections={sortedSections}
          allQuestions={questions}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}

      {previewing && (
        <SchemaPreviewModal
          questions={questions}
          onClose={() => setPreviewing(false)}
        />
      )}
    </div>
  );
}

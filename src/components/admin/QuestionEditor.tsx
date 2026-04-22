"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Trash2,
  Save,
  X,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Info,
  Link2,
} from "lucide-react";
import {
  RESPONSE_TYPES,
  RESPONSE_TYPE_LABELS,
  ACTIVE_STATUSES,
  type ResponseType,
  type ActiveStatus,
} from "@/lib/validation/question";
import { QUESTION_PRESETS, findPreset } from "@/lib/question-presets";
import {
  Button,
  Dropdown,
  Helper,
  Input,
  Label,
  SectionHeader,
  Tabs,
  Textarea,
} from "@/components/ui/primitives";
import type { DropdownOption } from "@/components/ui/primitives";
import { OptionsEditor } from "./OptionsEditor";

export interface EditableQuestion {
  id: string;
  schemaId: string;
  metricCode: string | null;
  sectionKey: string;
  displayOrder: number;
  prompt: string;
  helpText: string | null;
  responseType: string;
  required: boolean;
  optionsJson: unknown;
  parentQuestionId: string | null;
  showIfParentValue: string | null;
  reverseScore: boolean;
  reportingConfigJson: unknown;
  activeStatus: string;
  comparableToPrior: boolean;
}

interface Props {
  campaignId: string;
  schemaId: string;
  question: EditableQuestion | null;
  candidateParents: { id: string; prompt: string }[];
  knownSections: string[];
  allQuestions?: EditableQuestion[];
  onClose: () => void;
}

type TabKey = "content" | "logic" | "publishing";

function stringifyOptions(json: unknown): string {
  if (!json) return "";
  return JSON.stringify(json, null, 2);
}

function parseKeyLabelLines(text: string): { key: string; label: string }[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf("|");
      if (idx === -1) {
        const key = line
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 40) || `row_${Math.random().toString(36).slice(2, 6)}`;
        return { key, label: line };
      }
      return { key: line.slice(0, idx).trim(), label: line.slice(idx + 1).trim() };
    });
}

function keyLabelToText(items: { key: string; label: string }[] | undefined): string {
  if (!items) return "";
  return items.map((i) => `${i.key}|${i.label}`).join("\n");
}

function initialOptionsList(q: EditableQuestion | null): string[] {
  if (!q) return [""];
  const opts = (q.optionsJson ?? {}) as { options?: string[] };
  if (Array.isArray(opts.options) && opts.options.length > 0) return opts.options;
  return [""];
}

function initialSliderText(q: EditableQuestion | null): string {
  if (!q || q.responseType !== "slider") return "";
  const opts = (q.optionsJson ?? {}) as { items?: unknown[] };
  if (opts.items) return stringifyOptions(q.optionsJson);
  return "";
}

function initialStatementsText(q: EditableQuestion | null): string {
  if (!q || q.responseType !== "likert_grid") return "";
  const opts = (q.optionsJson ?? {}) as { statements?: { key: string; label: string }[] };
  return keyLabelToText(opts.statements);
}

function initialScaleText(q: EditableQuestion | null): string {
  if (!q || q.responseType !== "likert_grid") return "";
  const opts = (q.optionsJson ?? {}) as { scale?: string[] };
  return Array.isArray(opts.scale) ? opts.scale.join("\n") : "";
}

/**
 * Did this preset still match the current form state?
 * Used to show "in sync" / "out of sync" indicator between preset and response type.
 */
function presetMatches(
  presetId: string,
  responseType: ResponseType,
  optionsList: string[],
  allowOther: boolean
): boolean {
  const p = findPreset(presetId);
  if (!p) return false;
  if (p.responseType !== responseType) return false;
  const pOpts = (p.optionsJson ?? {}) as { options?: string[]; allowOther?: boolean };
  if (Array.isArray(pOpts.options)) {
    if (pOpts.options.length !== optionsList.length) return false;
    for (let i = 0; i < pOpts.options.length; i++) {
      if (pOpts.options[i] !== optionsList[i]) return false;
    }
  }
  if (Boolean(pOpts.allowOther) !== allowOther) return false;
  return true;
}

export function QuestionEditor({
  campaignId,
  schemaId,
  question,
  candidateParents,
  knownSections,
  allQuestions = [],
  onClose,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("content");
  const [developerOpen, setDeveloperOpen] = useState(false);

  const [form, setForm] = useState({
    metricCode: question?.metricCode ?? "",
    sectionKey: question?.sectionKey ?? knownSections[0] ?? "wellbeing",
    displayOrder: question?.displayOrder ?? 1,
    prompt: question?.prompt ?? "",
    helpText: question?.helpText ?? "",
    responseType: (question?.responseType as ResponseType) ?? "single_select",
    required: question?.required ?? true,
    parentQuestionId: question?.parentQuestionId ?? "",
    showIfParentValue: question?.showIfParentValue ?? "",
    reverseScore: question?.reverseScore ?? false,
    activeStatus: (question?.activeStatus as ActiveStatus) ?? "active",
    comparableToPrior: question?.comparableToPrior ?? true,
    optionsList: initialOptionsList(question),
    sliderText: initialSliderText(question),
    statementsText: initialStatementsText(question),
    scaleText: initialScaleText(question),
    allowOther: Boolean((question?.optionsJson as { allowOther?: boolean })?.allowOther),
    sensitive: Boolean((question?.optionsJson as { sensitive?: boolean })?.sensitive),
    favorableThreshold:
      (question?.reportingConfigJson as { favorableThreshold?: number })?.favorableThreshold ?? 60,
    numericMin: (question?.optionsJson as { min?: number })?.min?.toString() ?? "",
    numericMax: (question?.optionsJson as { max?: number })?.max?.toString() ?? "",
    numericStep: (question?.optionsJson as { step?: number })?.step?.toString() ?? "",
    rankingTopN: (question?.optionsJson as { topN?: number })?.topN?.toString() ?? "",
    presetId: "",
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function applyPreset(presetId: string) {
    if (!presetId) {
      setForm((f) => ({ ...f, presetId: "" }));
      return;
    }
    const preset = findPreset(presetId);
    if (!preset) return;
    const opts = preset.optionsJson as {
      options?: string[];
      items?: { key: string; label: string }[];
      statements?: { key: string; label: string }[];
      scale?: string[];
      min?: number;
      max?: number;
      step?: number;
      topN?: number;
      allowOther?: boolean;
    };
    setForm((f) => ({
      ...f,
      presetId,
      responseType: preset.responseType,
      optionsList:
        preset.responseType === "single_select" ||
        preset.responseType === "multi_select" ||
        preset.responseType === "ranking"
          ? (opts.options ?? []).length > 0
            ? [...(opts.options as string[])]
            : [""]
          : f.optionsList,
      sliderText:
        preset.responseType === "slider" && opts.items
          ? JSON.stringify(preset.optionsJson, null, 2)
          : preset.responseType === "slider"
          ? ""
          : f.sliderText,
      statementsText: keyLabelToText(opts.statements),
      scaleText: Array.isArray(opts.scale) ? opts.scale.join("\n") : "",
      allowOther: Boolean(opts.allowOther),
      favorableThreshold:
        (preset.reportingConfigJson as { favorableThreshold?: number })?.favorableThreshold ??
        f.favorableThreshold,
      numericMin: opts.min?.toString() ?? "",
      numericMax: opts.max?.toString() ?? "",
      numericStep: opts.step?.toString() ?? "",
      rankingTopN: opts.topN?.toString() ?? "",
    }));
  }

  const presetInSync = useMemo(
    () =>
      form.presetId
        ? presetMatches(form.presetId, form.responseType, form.optionsList, form.allowOther)
        : null,
    [form.presetId, form.responseType, form.optionsList, form.allowOther]
  );

  function buildOptionsJson(): unknown {
    if (form.responseType === "slider") {
      if (form.sliderText.trim().startsWith("{")) {
        try {
          return JSON.parse(form.sliderText);
        } catch {
          throw new Error("Slider options must be valid JSON");
        }
      }
      return { min: 0, max: 100 };
    }
    if (form.responseType === "open_text") return null;
    if (form.responseType === "date") return null;
    if (form.responseType === "numeric") {
      const o: Record<string, number> = {};
      if (form.numericMin !== "") o.min = Number(form.numericMin);
      if (form.numericMax !== "") o.max = Number(form.numericMax);
      if (form.numericStep !== "") o.step = Number(form.numericStep);
      return Object.keys(o).length ? o : null;
    }
    if (form.responseType === "likert_grid") {
      const statements = parseKeyLabelLines(form.statementsText);
      const scale = form.scaleText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (statements.length === 0) throw new Error("At least one statement is required");
      if (scale.length === 0) throw new Error("At least one scale option is required");
      return { statements, scale };
    }
    if (form.responseType === "ranking") {
      const options = form.optionsList.map((o) => o.trim()).filter(Boolean);
      if (options.length === 0) throw new Error("At least one option is required");
      const out: { options: string[]; topN?: number } = { options };
      if (form.rankingTopN !== "") out.topN = Number(form.rankingTopN);
      return out;
    }
    // single_select / multi_select
    const options = form.optionsList.map((o) => o.trim()).filter(Boolean);
    if (options.length === 0) throw new Error("At least one option is required");
    const dup = options.find(
      (o, i) => options.findIndex((x) => x.toLowerCase() === o.toLowerCase()) !== i
    );
    if (dup) throw new Error(`Duplicate option: "${dup}"`);
    return {
      options,
      ...(form.allowOther && { allowOther: true }),
      ...(form.sensitive && { sensitive: true }),
    };
  }

  function buildReportingConfig(): unknown {
    if (form.responseType === "slider") {
      return { favorableThreshold: Number(form.favorableThreshold) };
    }
    return null;
  }

  function submit() {
    setError(null);
    let optionsJson: unknown;
    let reportingConfigJson: unknown;
    try {
      optionsJson = buildOptionsJson();
      reportingConfigJson = buildReportingConfig();
    } catch (e) {
      setError((e as Error).message);
      // Jump user to the section where the problem probably is
      setTab("content");
      return;
    }

    const payload = {
      metricCode: form.metricCode || null,
      sectionKey: form.sectionKey,
      displayOrder: Number(form.displayOrder),
      prompt: form.prompt,
      helpText: form.helpText || null,
      responseType: form.responseType,
      required: form.required,
      optionsJson,
      parentQuestionId: form.parentQuestionId || null,
      showIfParentValue: form.showIfParentValue || null,
      reverseScore: form.reverseScore,
      reportingConfigJson,
      activeStatus: form.activeStatus,
      comparableToPrior: form.comparableToPrior,
    };

    startTransition(async () => {
      const url = question
        ? `/api/admin/campaigns/${campaignId}/schema/questions/${question.id}`
        : `/api/admin/campaigns/${campaignId}/schema/questions`;
      const method = question ? "PATCH" : "POST";
      const body = question
        ? JSON.stringify(payload)
        : JSON.stringify({ ...payload, schemaId });

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(
          b.error
            ? `${b.error}${b.issues ? ": " + b.issues.map((i: { message: string }) => i.message).join("; ") : ""}`
            : `Failed (${res.status})`
        );
        return;
      }
      router.refresh();
      onClose();
    });
  }

  function deleteQuestion() {
    if (!question) return;
    if (!confirm("Delete this question?")) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/admin/campaigns/${campaignId}/schema/questions/${question.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? `Delete failed (${res.status})`);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  const optionsLikeType =
    form.responseType === "single_select" || form.responseType === "multi_select";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 flex w-full max-w-3xl flex-col rounded-3xl border border-[#D9DFDA] bg-white shadow-xl">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 border-b border-[#E8ECE8] px-6 py-5">
          <div>
            <h2 className="t-section">
              {question ? "Edit question" : "New question"}
            </h2>
            <Helper className="mt-0.5">
              {question
                ? "Edits apply to the latest schema version."
                : "Pick a type below to pre-fill options."}
            </Helper>
          </div>
          <div className="flex items-center gap-1">
            {question && (
              <button
                type="button"
                onClick={deleteQuestion}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#991B1B] hover:bg-[#FEE2E2] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B85C5C]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F7F9F7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5D54]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Tabs */}
        <Tabs<TabKey>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "content", label: "Content" },
            { value: "logic", label: "Logic" },
            { value: "publishing", label: "Publishing" },
          ]}
        />

        {/* Scrollable body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
          {error && (
            <div className="mb-4 rounded-xl bg-[#FEE2E2] px-3 py-2.5 text-sm text-[#991B1B]">
              {error}
            </div>
          )}

          {tab === "content" && (
            <ContentTab
              form={form}
              update={update}
              applyPreset={applyPreset}
              presetInSync={presetInSync}
              optionsLikeType={optionsLikeType}
              developerOpen={developerOpen}
              setDeveloperOpen={setDeveloperOpen}
              knownSections={knownSections}
              allQuestions={allQuestions}
              currentId={question?.id ?? null}
            />
          )}

          {tab === "logic" && (
            <LogicTab form={form} update={update} candidateParents={candidateParents} />
          )}

          {tab === "publishing" && <PublishingTab form={form} update={update} />}
        </div>

        {/* Footer — Cancel + Save only */}
        <footer className="flex items-center justify-end gap-2 border-t border-[#E8ECE8] bg-white px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={submit}
            disabled={isPending}
            leftIcon={<Save className="h-3.5 w-3.5" />}
          >
            {isPending ? "Saving…" : "Save question"}
          </Button>
        </footer>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tab: Content (Basics + Response, merged — the common path)                */
/* -------------------------------------------------------------------------- */

function ContentTab({
  form,
  update,
  applyPreset,
  presetInSync,
  optionsLikeType,
  developerOpen,
  setDeveloperOpen,
  knownSections,
  allQuestions,
  currentId,
}: {
  form: ReturnType<typeof useFormShape>;
  update: <K extends keyof ReturnType<typeof useFormShape>>(
    k: K,
    v: ReturnType<typeof useFormShape>[K]
  ) => void;
  applyPreset: (id: string) => void;
  presetInSync: boolean | null;
  optionsLikeType: boolean;
  developerOpen: boolean;
  setDeveloperOpen: (b: boolean) => void;
  knownSections: string[];
  allQuestions: EditableQuestion[];
  currentId: string | null;
}) {
  return (
    <div className="space-y-6">
      {/* Content (question the respondent sees) */}
      <section className="space-y-4">
        <Label label="Prompt" required>
          <Textarea
            value={form.prompt}
            onChange={(e) => update("prompt", e.target.value)}
            rows={2}
            placeholder="How do you feel about your work right now?"
          />
        </Label>

        <Label label="Help text (optional)">
          <Textarea
            value={form.helpText}
            onChange={(e) => update("helpText", e.target.value)}
            rows={2}
            placeholder="One-line clarification that sits under the prompt."
          />
        </Label>

        {/* Smart type selector */}
        <SmartTypePicker
          presetId={form.presetId}
          responseType={form.responseType}
          onPreset={applyPreset}
          onResponseType={(t) => update("responseType", t)}
          inSync={presetInSync}
        />

        {/* Per-type editor(s) */}
        {optionsLikeType && (
          <>
            <SectionHeader title="Options" />
            <OptionsEditor
              value={form.optionsList}
              onChange={(next) => update("optionsList", next)}
              kind={form.responseType === "multi_select" ? "checkbox" : "radio"}
            />
            {form.responseType === "multi_select" && (
              <Check
                label="Allow Other write-in"
                checked={form.allowOther}
                onChange={(v) => update("allowOther", v)}
              />
            )}
          </>
        )}

        {form.responseType === "slider" && (
          <>
            <Label
              label="Slider config JSON (optional)"
              helper="Leave blank for a single 0–100 slider. Provide items[] for a stacked slider."
            >
              <Textarea
                value={form.sliderText}
                onChange={(e) => update("sliderText", e.target.value)}
                rows={6}
                className="font-mono text-[13px]"
                placeholder={`{\n  "items": [\n    {"key":"energized","label":"Energized"}\n  ],\n  "min": 0,\n  "max": 100,\n  "minLabel": "Not at all",\n  "maxLabel": "Very strongly"\n}`}
              />
            </Label>
            <Label label="Favorable threshold (0–100)">
              <Input
                type="number"
                min={0}
                max={100}
                value={form.favorableThreshold}
                onChange={(e) => update("favorableThreshold", Number(e.target.value))}
              />
            </Label>
          </>
        )}

        {form.responseType === "likert_grid" && (
          <>
            <Label
              label="Statements"
              helper="One per line. Use key|Label to set a stable key, or just Label to auto-generate."
            >
              <Textarea
                value={form.statementsText}
                onChange={(e) => update("statementsText", e.target.value)}
                rows={6}
                className="font-mono text-[13px]"
                placeholder={"fair_pay|My pay is fair for the work I do.\nrecognized|I feel recognized for my contributions."}
              />
            </Label>
            <Label label="Scale options (shared across all statements)">
              <Textarea
                value={form.scaleText}
                onChange={(e) => update("scaleText", e.target.value)}
                rows={5}
                className="font-mono text-[13px]"
                placeholder={"Strongly Disagree\nDisagree\nAgree\nStrongly Agree\nDon't Know"}
              />
            </Label>
          </>
        )}

        {form.responseType === "numeric" && (
          <div className="grid grid-cols-3 gap-3">
            <Label label="Min (optional)">
              <Input
                type="number"
                value={form.numericMin}
                onChange={(e) => update("numericMin", e.target.value)}
              />
            </Label>
            <Label label="Max (optional)">
              <Input
                type="number"
                value={form.numericMax}
                onChange={(e) => update("numericMax", e.target.value)}
              />
            </Label>
            <Label label="Step (optional)">
              <Input
                type="number"
                value={form.numericStep}
                onChange={(e) => update("numericStep", e.target.value)}
              />
            </Label>
          </div>
        )}

        {form.responseType === "ranking" && (
          <>
            <SectionHeader title="Items to rank" />
            <OptionsEditor
              value={form.optionsList}
              onChange={(next) => update("optionsList", next)}
              kind="checkbox"
              showPreview={false}
            />
            <Label
              label="Top-N (optional)"
              helper="Limit ranking to the respondent's top N items."
            >
              <Input
                type="number"
                value={form.rankingTopN}
                onChange={(e) => update("rankingTopN", e.target.value)}
              />
            </Label>
          </>
        )}
      </section>

      {/* Developer panel */}
      <DeveloperPanel
        open={developerOpen}
        onToggle={() => setDeveloperOpen(!developerOpen)}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <SectionKeyPicker
              value={form.sectionKey}
              onChange={(v) => update("sectionKey", v)}
              knownSections={knownSections}
            />
            <DisplayOrderPicker
              sectionKey={form.sectionKey}
              currentQuestionId={currentId}
              value={form.displayOrder}
              onChange={(v) => update("displayOrder", v)}
              allQuestions={allQuestions}
            />
          </div>
          <Label
            label="Metric code"
            helper="A stable dot-notation identifier used for year-over-year comparisons. Once set, avoid changing it."
          >
            <Input
              value={form.metricCode}
              onChange={(e) => update("metricCode", e.target.value)}
              placeholder="wellbeing.energized"
            />
          </Label>
        </div>
      </DeveloperPanel>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tab: Logic                                                                */
/* -------------------------------------------------------------------------- */

function LogicTab({
  form,
  update,
  candidateParents,
}: {
  form: ReturnType<typeof useFormShape>;
  update: <K extends keyof ReturnType<typeof useFormShape>>(
    k: K,
    v: ReturnType<typeof useFormShape>[K]
  ) => void;
  candidateParents: { id: string; prompt: string }[];
}) {
  const hasParent = Boolean(form.parentQuestionId);
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Show this question only when…"
        description="Conditionally reveal this question based on the answer to another one. Leave empty to always show."
      />
      <div className="grid grid-cols-2 gap-3">
        <Label label="Parent question">
          <Dropdown
            value={form.parentQuestionId}
            onChange={(v) => update("parentQuestionId", v)}
            placeholder="— none —"
            options={[
              { value: "", label: "— none —" },
              ...candidateParents.map((p) => ({
                value: p.id,
                label:
                  p.prompt.length > 60 ? p.prompt.slice(0, 60) + "…" : p.prompt,
              })),
            ]}
          />
        </Label>
        <Label
          label="Show if parent value ="
          helper={hasParent ? undefined : "Pick a parent question first."}
        >
          <Input
            value={form.showIfParentValue}
            onChange={(e) => update("showIfParentValue", e.target.value)}
            placeholder="Yes"
            disabled={!hasParent}
          />
        </Label>
      </div>
      {hasParent && (
        <p className="flex items-start gap-2 rounded-xl bg-[#DCE8E4] px-3 py-2 text-sm text-[#1D3931]">
          <Link2 className="mt-0.5 h-4 w-4 shrink-0" />
          This question renders inline under its parent when the answer matches.
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tab: Publishing                                                           */
/* -------------------------------------------------------------------------- */

function PublishingTab({
  form,
  update,
}: {
  form: ReturnType<typeof useFormShape>;
  update: <K extends keyof ReturnType<typeof useFormShape>>(
    k: K,
    v: ReturnType<typeof useFormShape>[K]
  ) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <Label label="Active status">
          <Dropdown
            value={form.activeStatus}
            onChange={(v) => update("activeStatus", v as ActiveStatus)}
            options={ACTIVE_STATUSES.map((s) => ({
              value: s,
              label: s.charAt(0).toUpperCase() + s.slice(1),
            }))}
          />
        </Label>
      </div>

      <SectionHeader title="Flags" />
      <div className="space-y-2.5">
        <Check
          label="Required"
          checked={form.required}
          onChange={(v) => update("required", v)}
          tooltip="Respondents can't advance without answering this question."
        />
        <Check
          label="Reverse-scored"
          checked={form.reverseScore}
          onChange={(v) => update("reverseScore", v)}
          tooltip="Inverts scoring at report time — use for negatively-worded items in a favorable scale."
        />
        <Check
          label="Comparable to prior year"
          checked={form.comparableToPrior}
          onChange={(v) => update("comparableToPrior", v)}
          tooltip="Include this question in year-over-year trend charts. Uncheck when prompt wording has changed."
        />
        <Check
          label="Mark as sensitive"
          checked={form.sensitive}
          onChange={(v) => update("sensitive", v)}
          tooltip="Sensitive responses are excluded from detailed breakdowns to protect respondent privacy."
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Developer panel                                                           */
/* -------------------------------------------------------------------------- */

function DeveloperPanel({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#E8ECE8] bg-[#F7F9F7]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5D54] focus-visible:ring-offset-2"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 text-[#6B7280]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[#6B7280]" />
          )}
          <span className="text-sm font-medium text-[#1C1C1C]">
            Advanced / developer settings
          </span>
        </span>
        <span className="text-xs text-[#6B7280]">Section · order · metric code</span>
      </button>
      {open && <div className="border-t border-[#E8ECE8] px-4 py-4">{children}</div>}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Smart type picker (preset + response type, with sync indicator)           */
/* -------------------------------------------------------------------------- */

function SmartTypePicker({
  presetId,
  responseType,
  onPreset,
  onResponseType,
  inSync,
}: {
  presetId: string;
  responseType: ResponseType;
  onPreset: (id: string) => void;
  onResponseType: (t: ResponseType) => void;
  inSync: boolean | null;
}) {
  const currentPreset = findPreset(presetId);
  const presetsForType = QUESTION_PRESETS.filter((p) => p.responseType === responseType);
  const typeLabel = RESPONSE_TYPE_LABELS[responseType];

  return (
    <div className="rounded-2xl border border-[#D9DFDA] bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="t-label">Question type</p>
          <p className="mt-0.5 text-xs text-[#6B7280]">
            Pick a preset to pre-fill options; the data shape below is what gets saved.
          </p>
        </div>
        {presetId && (
          <span
            className={[
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
              inSync
                ? "border-[#BFD0C8] bg-[#DCE8E4] text-[#1D3931]"
                : "border-[#FDE68A] bg-[#FEF3C7] text-[#92400E]",
            ].join(" ")}
          >
            {inSync ? "In sync" : "Customized"}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Helper className="mb-1">Preset (optional shortcut)</Helper>
          <Dropdown
            value={presetId}
            onChange={(v) => onPreset(v)}
            placeholder="— choose a preset —"
            options={[
              { value: "", label: "— none —" },
              ...QUESTION_PRESETS.map((p) => ({
                value: p.id,
                label: p.label,
                hint: p.description,
              })),
            ]}
          />
        </div>
        <div>
          <Helper className="mb-1">Response type (saved value)</Helper>
          <Dropdown
            value={responseType}
            onChange={(v) => onResponseType(v as ResponseType)}
            options={RESPONSE_TYPES.map((t) => ({
              value: t,
              label: RESPONSE_TYPE_LABELS[t],
            }))}
          />
        </div>
      </div>

      {currentPreset && !inSync && (
        <p className="flex items-start gap-2 text-xs text-[#92400E]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Options have been edited after applying the <strong>{currentPreset.label}</strong> preset.
          {presetsForType.length > 0 && ` Still saved as: ${typeLabel}.`}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section key picker                                                        */
/* -------------------------------------------------------------------------- */

const NEW_SECTION_SENTINEL = "__new__";

function slugifySection(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function SectionKeyPicker({
  value,
  onChange,
  knownSections,
}: {
  value: string;
  onChange: (v: string) => void;
  knownSections: string[];
}) {
  const valueInList = knownSections.includes(value);
  const [creating, setCreating] = useState(!valueInList && value !== "");
  const [draft, setDraft] = useState(valueInList ? "" : value);

  function commitDraft() {
    const slug = slugifySection(draft);
    if (slug) onChange(slug);
  }

  if (creating) {
    return (
      <Label
        label="Section key"
        helper="Lowercase letters, numbers, and underscores."
      >
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            placeholder="e.g. about_you"
            autoFocus
          />
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setDraft("");
              if (knownSections[0]) onChange(knownSections[0]);
            }}
            title="Pick from existing"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-[#D9DFDA] bg-white px-3 text-[#374151] hover:bg-[#F7F9F7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5D54] focus-visible:ring-offset-2"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </Label>
    );
  }

  const options: DropdownOption[] =
    knownSections.length === 0
      ? [{ value: NEW_SECTION_SENTINEL, label: "＋ New section…" }]
      : [
          ...knownSections.map((s) => ({ value: s, label: s })),
          { value: NEW_SECTION_SENTINEL, label: "＋ New section…" },
        ];

  return (
    <Label
      label="Section key"
      helper="Groups this question with others in the same section."
    >
      <Dropdown
        value={value}
        placeholder="— no sections yet —"
        options={options}
        onChange={(v) => {
          if (v === NEW_SECTION_SENTINEL) {
            setCreating(true);
            setDraft("");
            return;
          }
          onChange(v);
        }}
      />
    </Label>
  );
}

function DisplayOrderPicker({
  sectionKey,
  currentQuestionId,
  value,
  onChange,
  allQuestions,
}: {
  sectionKey: string;
  currentQuestionId: string | null;
  value: number;
  onChange: (n: number) => void;
  allQuestions: EditableQuestion[];
}) {
  const siblings = allQuestions
    .filter((q) => q.sectionKey === sectionKey && q.id !== currentQuestionId)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const slots = Math.max(siblings.length + 1, 1);
  const options: DropdownOption[] = Array.from({ length: slots }, (_, i) => {
    const pos = i + 1;
    const before = siblings[i - 1];
    const after = siblings[i];
    let hint: string;
    if (siblings.length === 0) {
      hint = "First question in this section";
    } else if (i === 0) {
      hint = after ? `Before: ${truncate(after.prompt, 50)}` : "First";
    } else if (i === siblings.length) {
      hint = before ? `After: ${truncate(before.prompt, 50)}` : "Last";
    } else {
      hint = `Between #${before?.displayOrder ?? i} and #${after?.displayOrder ?? i + 1}`;
    }
    return { value: String(pos), label: `#${pos}`, hint };
  });

  return (
    <Label label="Display order" helper="Position within this section.">
      <Dropdown
        value={String(value)}
        onChange={(v) => onChange(Number(v))}
        options={options}
      />
    </Label>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/* -------------------------------------------------------------------------- */
/*  Check (with optional tooltip)                                             */
/* -------------------------------------------------------------------------- */

function Check({
  label,
  checked,
  onChange,
  tooltip,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  tooltip?: string;
}) {
  return (
    <label className="flex items-start gap-2.5 text-sm text-[#1C1C1C]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-[#C7D0CA] text-[#244943] focus:ring-[#2F5D54]"
      />
      <span className="min-w-0 flex-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="font-medium">{label}</span>
          {tooltip && (
            <span
              className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full text-[#9CA3AF]"
              title={tooltip}
            >
              <Info className="h-3.5 w-3.5" />
            </span>
          )}
        </span>
        {tooltip && (
          <span className="mt-0.5 block text-xs text-[#6B7280]">{tooltip}</span>
        )}
      </span>
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/*  Type helper — keep inner components type-safe with the form state shape   */
/* -------------------------------------------------------------------------- */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function useFormShape(q: EditableQuestion | null, knownSections: string[]) {
  return {
    metricCode: "",
    sectionKey: "",
    displayOrder: 1,
    prompt: "",
    helpText: "",
    responseType: "single_select" as ResponseType,
    required: true,
    parentQuestionId: "",
    showIfParentValue: "",
    reverseScore: false,
    activeStatus: "active" as ActiveStatus,
    comparableToPrior: true,
    optionsList: [""],
    sliderText: "",
    statementsText: "",
    scaleText: "",
    allowOther: false,
    sensitive: false,
    favorableThreshold: 60,
    numericMin: "",
    numericMax: "",
    numericStep: "",
    rankingTopN: "",
    presetId: "",
  };
}

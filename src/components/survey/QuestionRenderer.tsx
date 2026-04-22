"use client";

import { useMemo, useState } from "react";
import { Info, Search, Check, ArrowUp, ArrowDown, X } from "lucide-react";

export interface Question {
  id: string;
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
}

interface RendererProps {
  question: Question;
  value: unknown;
  onChange: (v: unknown) => void;
}

type OptionInput = string | { label: string; hint?: string };
interface OptionGroup {
  label: string;
  options: OptionInput[];
}
interface OptionsObject {
  options?: OptionInput[];
  groups?: OptionGroup[];
  allowOther?: boolean;
  searchable?: boolean; // explicit override; auto-on at >= 7 options
  sensitive?: boolean;
  reassurance?: string;
  items?: { key: string; label: string; info?: string }[];
  min?: number;
  max?: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
  // likert_grid
  statements?: { key: string; label: string }[];
  scale?: string[];
  // ranking
  topN?: number;
  // open_text
  rows?: number;
}

interface NormalizedOption {
  label: string;
  hint?: string;
  group?: string;
}

// Auto-enable search when a question has this many or more options
const SEARCH_THRESHOLD = 7;

function normalizeOptions(opts: OptionsObject): NormalizedOption[] {
  const out: NormalizedOption[] = [];
  if (opts.groups && opts.groups.length > 0) {
    for (const g of opts.groups) {
      for (const o of g.options) {
        out.push({
          group: g.label,
          ...(typeof o === "string" ? { label: o } : { label: o.label, hint: o.hint }),
        });
      }
    }
    return out;
  }
  for (const o of opts.options ?? []) {
    out.push(typeof o === "string" ? { label: o } : { label: o.label, hint: o.hint });
  }
  return out;
}

function hasGroups(opts: OptionsObject): boolean {
  return Boolean(opts.groups && opts.groups.length > 0);
}

function shouldEnableSearch(opts: OptionsObject, total: number): boolean {
  if (typeof opts.searchable === "boolean") return opts.searchable;
  return total >= SEARCH_THRESHOLD;
}

export function QuestionRenderer({ question, value, onChange }: RendererProps) {
  const opts = (question.optionsJson ?? {}) as OptionsObject;

  return (
    <div className="space-y-3">
      {(opts.sensitive || opts.reassurance) && (
        <div className="rounded-xl bg-[#DCE8E4] px-4 py-2 text-xs text-[#1D3931]">
          {opts.reassurance ??
            "This is a sensitive question. Skip it if you'd rather — your survey still submits."}
        </div>
      )}

      {question.responseType === "slider" && (
        <SliderQuestion question={question} value={value} onChange={onChange} opts={opts} />
      )}
      {question.responseType === "single_select" && (
        <RadioGroup question={question} value={value as string} onChange={onChange} opts={opts} />
      )}
      {question.responseType === "multi_select" && (
        <CheckboxGroup question={question} value={value} onChange={onChange} opts={opts} />
      )}
      {question.responseType === "open_text" && (
        <Textarea value={(value as string) ?? ""} onChange={onChange} rows={opts.rows ?? 6} />
      )}
      {question.responseType === "likert_grid" && (
        <LikertGrid question={question} value={value} onChange={onChange} opts={opts} />
      )}
      {question.responseType === "numeric" && (
        <NumericInput value={value} onChange={onChange} opts={opts} />
      )}
      {question.responseType === "date" && (
        <DateInput value={(value as string) ?? ""} onChange={onChange} />
      )}
      {question.responseType === "ranking" && (
        <RankingList value={value} onChange={onChange} opts={opts} />
      )}
    </div>
  );
}

/* --------------------------------- SLIDER --------------------------------- */

function SliderQuestion({
  question,
  value,
  onChange,
  opts,
}: RendererProps & { opts: OptionsObject }) {
  const items = opts.items ?? [{ key: question.id, label: question.prompt }];
  const min = opts.min ?? 0;
  const max = opts.max ?? 100;
  const minLabel = opts.minLabel ?? `${min}`;
  const maxLabel = opts.maxLabel ?? `${max}`;

  // Multi-item slider stack: value is { [itemKey]: number }
  const isMulti = items.length > 1 || opts.items;
  const multiValue = (isMulti ? (value as Record<string, number>) ?? {} : null);
  const singleValue = (!isMulti
    ? typeof value === "number"
      ? value
      : 50
    : 0) as number;

  function update(itemKey: string, n: number) {
    if (isMulti) {
      onChange({ ...(multiValue ?? {}), [itemKey]: n });
    } else {
      onChange(n);
    }
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const v = isMulti
          ? multiValue?.[item.key] ?? Math.round((min + max) / 2)
          : singleValue;
        return (
          <SliderCard
            key={item.key}
            label={isMulti ? item.label : question.prompt}
            helper={isMulti ? item.info : question.helpText ?? undefined}
            value={v}
            min={min}
            max={max}
            minLabel={minLabel}
            maxLabel={maxLabel}
            onChange={(n) => update(item.key, n)}
          />
        );
      })}
    </div>
  );
}

function SliderCard({
  label,
  helper,
  value,
  min,
  max,
  minLabel,
  maxLabel,
  onChange,
}: {
  label: string;
  helper?: string;
  value: number;
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="rounded-3xl border border-[#D9DFDA] bg-white p-6">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-[#1C1C1C] leading-snug">{label}</p>
          {helper && <p className="mt-1 text-sm text-[#374151]">{helper}</p>}
        </div>
        <div className="rounded-full bg-[#DCE8E4] px-3.5 py-1 text-base font-semibold text-[#244943]">
          {value}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="h-2.5 w-full cursor-pointer appearance-none rounded-full bg-[#C5D6CF] accent-[#2F5D54]"
        aria-label={label}
      />
      <div className="mt-2 flex items-center justify-between text-xs text-[#374151]">
        <span>
          {min} · {minLabel}
        </span>
        <span>
          {max} · {maxLabel}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------- RADIO GROUP ------------------------------ */

function RadioGroup({
  question,
  value,
  onChange,
  opts,
}: {
  question: Question;
  value: string | undefined;
  onChange: (v: string) => void;
  opts: OptionsObject;
}) {
  const normalized = useMemo(() => normalizeOptions(opts), [opts]);
  const grouped = hasGroups(opts);
  const searchable = shouldEnableSearch(opts, normalized.length);

  return (
    <ScannableList
      ariaLabel={question.prompt}
      role="radiogroup"
      options={normalized}
      grouped={grouped}
      searchable={searchable}
      isSelected={(o) => value === o.label}
      onActivate={(o) => onChange(o.label)}
      kind="radio"
    />
  );
}

/* ----------------------------- CHECKBOX GROUP ----------------------------- */

function CheckboxGroup({
  question,
  value,
  onChange,
  opts,
}: {
  question: Question;
  value: unknown;
  onChange: (v: unknown) => void;
  opts: OptionsObject;
}) {
  const v = (value as { selected?: string[]; other_text?: string }) ?? {
    selected: [],
    other_text: "",
  };
  const selected = v.selected ?? [];

  // Add "Other" as a synthetic option so it participates in zebra/group/search
  const baseNormalized = useMemo(() => normalizeOptions(opts), [opts]);
  const normalized = useMemo<NormalizedOption[]>(() => {
    if (!opts.allowOther) return baseNormalized;
    const otherGroup = hasGroups(opts) ? "Other" : undefined;
    return [...baseNormalized, { label: "Other", group: otherGroup }];
  }, [baseNormalized, opts]);
  const grouped = hasGroups(opts);
  const searchable = shouldEnableSearch(opts, normalized.length);

  function toggle(label: string) {
    const next = selected.includes(label)
      ? selected.filter((o) => o !== label)
      : [...selected, label];
    onChange({ selected: next, other_text: v.other_text ?? "" });
  }

  const otherSelected = selected.includes("Other");

  return (
    <div className="space-y-2" aria-label={question.prompt}>
      <ScannableList
        ariaLabel={question.prompt}
        role="group"
        options={normalized}
        grouped={grouped}
        searchable={searchable}
        isSelected={(o) => selected.includes(o.label)}
        onActivate={(o) => toggle(o.label)}
        kind="checkbox"
      />
      {opts.allowOther && otherSelected && (
        <div className="ml-3 border-l-2 border-[#C5D6CF] pl-4">
          <textarea
            value={v.other_text ?? ""}
            onChange={(e) => onChange({ selected, other_text: e.target.value })}
            rows={2}
            className="w-full rounded-2xl border border-[#E8ECE8] bg-white px-3 py-2 text-sm"
            placeholder="Tell us more..."
          />
        </div>
      )}
      {void Info}
    </div>
  );
}

/* ----------------------- SHARED: SCANNABLE OPTION LIST -------------------- */

interface ScannableListProps {
  ariaLabel: string;
  role: "radiogroup" | "group";
  options: NormalizedOption[];
  grouped: boolean;
  searchable: boolean;
  isSelected: (o: NormalizedOption) => boolean;
  onActivate: (o: NormalizedOption) => void;
  kind: "radio" | "checkbox";
}

function ScannableList({
  ariaLabel,
  role,
  options,
  grouped,
  searchable,
  isSelected,
  onActivate,
  kind,
}: ScannableListProps) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return options;
    return options.filter((o) =>
      `${o.label} ${o.hint ?? ""} ${o.group ?? ""}`.toLowerCase().includes(q)
    );
  }, [q, options]);

  const renderRows = (rows: NormalizedOption[], baseIndex: number) =>
    rows.map((o, i) => {
      const selected = isSelected(o);
      const zebra = (baseIndex + i) % 2 === 1;
      return (
        <button
          key={`${o.group ?? ""}::${o.label}`}
          type="button"
          role={kind}
          aria-checked={selected}
          onClick={() => onActivate(o)}
          className={[
            "group flex w-full items-start gap-3 border px-4 py-3 text-left text-sm transition",
            "first:rounded-t-2xl last:rounded-b-2xl",
            selected
              ? "border-[#2F5D54] bg-[#DCE8E4] z-10 ring-1 ring-[#2F5D54]/40"
              : zebra
              ? "border-[#E8ECE8] bg-[#F7F9F8] hover:bg-[#DCE8E4]/60"
              : "border-[#D9DFDA] bg-white hover:bg-[#DCE8E4]/60",
            // Collapse double borders between adjacent rows
            "[&:not(:first-child)]:-mt-px",
          ].join(" ")}
        >
          {/* Indicator (left) */}
          <span
            className={[
              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center transition",
              kind === "radio" ? "rounded-full" : "rounded-md",
              selected
                ? kind === "radio"
                  ? "border-2 border-[#244943]"
                  : "border-[#244943] bg-[#244943]"
                : "border border-[#C7D0CA] bg-white",
            ].join(" ")}
          >
            {selected && kind === "radio" && (
              <span className="h-2.5 w-2.5 rounded-full bg-[#244943]" />
            )}
            {selected && kind === "checkbox" && (
              <Check className="h-3.5 w-3.5 text-white" />
            )}
          </span>

          {/* Label + hint */}
          <span className="flex-1">
            <span
              className={[
                "block leading-snug",
                selected ? "font-medium text-[#1C1C1C]" : "text-[#1C1C1C]",
              ].join(" ")}
            >
              {o.label}
            </span>
            {o.hint && (
              <span className="mt-0.5 block text-xs text-[#6B7280]">{o.hint}</span>
            )}
          </span>
        </button>
      );
    });

  // Group rendering: section headers + zebra restarts per section
  let sectionedContent: React.ReactNode;
  if (grouped) {
    const bySection = new Map<string, NormalizedOption[]>();
    for (const o of filtered) {
      const key = o.group ?? "";
      const list = bySection.get(key) ?? [];
      list.push(o);
      bySection.set(key, list);
    }
    sectionedContent = (
      <div className="space-y-5">
        {Array.from(bySection.entries()).map(([groupName, rows]) =>
          rows.length === 0 ? null : (
            <div key={groupName}>
              {groupName && (
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6B7280]">
                  {groupName}
                </p>
              )}
              <div role={role} aria-label={ariaLabel} className="overflow-hidden rounded-2xl">
                {renderRows(rows, 0)}
              </div>
            </div>
          )
        )}
        {filtered.length === 0 && <NoMatches />}
      </div>
    );
  } else {
    sectionedContent =
      filtered.length === 0 ? (
        <NoMatches />
      ) : (
        <div role={role} aria-label={ariaLabel} className="overflow-hidden rounded-2xl">
          {renderRows(filtered, 0)}
        </div>
      );
  }

  return (
    <div className="space-y-3">
      {searchable && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${options.length} options…`}
            aria-label="Search options"
            className="h-11 w-full rounded-full border border-[#D9DFDA] bg-white pl-10 pr-4 text-sm text-[#1C1C1C] placeholder:text-[#6B7280] focus:border-[#2F5D54] focus:outline-none focus:ring-2 focus:ring-[#2F5D54]/30"
          />
        </div>
      )}
      {sectionedContent}
    </div>
  );
}

function NoMatches() {
  return (
    <div className="rounded-2xl border border-dashed border-[#E8ECE8] bg-white px-4 py-6 text-center text-sm text-[#9CA3AF]">
      No matches. Try a different search.
    </div>
  );
}

/* --------------------------------- TEXTAREA -------------------------------- */

function Textarea({
  value,
  onChange,
  rows = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full min-h-[120px] rounded-2xl border border-[#D9DFDA] bg-white px-4 py-3 text-base text-[#1C1C1C] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#2F5D54] focus:ring-2 focus:ring-[#2F5D54]/30"
      placeholder="Optional. Please don't include names."
    />
  );
}

/* --------------------------------- LIKERT GRID --------------------------------- */

function LikertGrid({
  question,
  value,
  onChange,
  opts,
}: RendererProps & { opts: OptionsObject }) {
  const statements = opts.statements ?? [];
  const scale = opts.scale ?? [];
  const v = (value as Record<string, string>) ?? {};

  function set(key: string, choice: string) {
    onChange({ ...v, [key]: choice });
  }

  if (statements.length === 0 || scale.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E8ECE8] bg-white px-4 py-6 text-center text-sm text-[#9CA3AF]">
        Grid has no statements or scale configured.
      </div>
    );
  }

  return (
    <div>
      {/* Desktop: table layout */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-[#E8ECE8]">
        <table className="w-full border-collapse text-sm" aria-label={question.prompt}>
          <thead className="bg-[#F7F9F8]">
            <tr>
              <th className="border-b border-[#E8ECE8] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[#6B7280]" />
              {scale.map((opt) => (
                <th
                  key={opt}
                  className="border-b border-[#E8ECE8] px-2 py-3 text-center text-xs font-medium text-[#6B7280]"
                >
                  {opt}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {statements.map((s, i) => (
              <tr key={s.key} className={i % 2 === 0 ? "bg-white" : "bg-[#F7F9F8]/50"}>
                <td className="border-t border-[#E8ECE8] px-4 py-3 text-[#1C1C1C]">
                  {s.label}
                </td>
                {scale.map((opt) => {
                  const selected = v[s.key] === opt;
                  return (
                    <td
                      key={opt}
                      className="border-t border-[#E8ECE8] px-2 py-3 text-center"
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={`${s.label} — ${opt}`}
                        onClick={() => set(s.key, opt)}
                        className={[
                          "mx-auto flex h-6 w-6 items-center justify-center rounded-full border transition",
                          selected
                            ? "border-[#244943] ring-2 ring-[#2F5D54]/40"
                            : "border-[#C9D2CB] hover:border-[#2F5D54]",
                        ].join(" ")}
                      >
                        {selected && <span className="h-2.5 w-2.5 rounded-full bg-[#244943]" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="space-y-3 md:hidden">
        {statements.map((s) => (
          <div
            key={s.key}
            className="rounded-2xl border border-[#D9DFDA] bg-white p-4"
          >
            <p className="mb-3 text-sm font-medium text-[#1C1C1C]">{s.label}</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={s.label}>
              {scale.map((opt) => {
                const selected = v[s.key] === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => set(s.key, opt)}
                    className={[
                      "rounded-full border px-3 py-1.5 text-xs transition",
                      selected
                        ? "border-[#244943] bg-[#DCE8E4] text-[#1C1C1C]"
                        : "border-[#E8ECE8] bg-white text-[#1C1C1C] hover:bg-[#DCE8E4]/60",
                    ].join(" ")}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- NUMERIC --------------------------------- */

function NumericInput({
  value,
  onChange,
  opts,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  opts: OptionsObject;
}) {
  const current = typeof value === "number" ? value : value === "" || value == null ? "" : Number(value);
  return (
    <input
      type="number"
      value={current as number | ""}
      min={opts.min}
      max={opts.max}
      step={opts.step}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") onChange(null);
        else onChange(Number(raw));
      }}
      className="h-12 w-full rounded-2xl border border-[#D9DFDA] bg-white px-4 text-base text-[#1C1C1C] focus:outline-none focus:border-[#2F5D54] focus:ring-2 focus:ring-[#2F5D54]/30"
    />
  );
}

/* --------------------------------- DATE --------------------------------- */

function DateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-12 w-full rounded-2xl border border-[#D9DFDA] bg-white px-4 text-base text-[#1C1C1C] focus:outline-none focus:border-[#2F5D54] focus:ring-2 focus:ring-[#2F5D54]/30"
    />
  );
}

/* --------------------------------- RANKING --------------------------------- */

function RankingList({
  value,
  onChange,
  opts,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  opts: OptionsObject;
}) {
  const available = (opts.options as string[] | undefined) ?? [];
  const topN = opts.topN ?? available.length;
  const stored = (value as { order?: string[] } | null) ?? null;
  const order: string[] =
    stored && Array.isArray(stored.order)
      ? stored.order.filter((o): o is string => available.includes(o))
      : [];

  function move(i: number, dir: -1 | 1) {
    const next = [...order];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  }

  function add(opt: string) {
    if (order.includes(opt)) return;
    if (order.length >= topN) return;
    commit([...order, opt]);
  }

  function remove(opt: string) {
    commit(order.filter((o) => o !== opt));
  }

  function commit(next: string[]) {
    onChange({ order: next });
  }

  const unranked = available.filter((o) => !order.includes(o));

  return (
    <div className="space-y-3">
      {order.length > 0 && (
        <ol className="space-y-2" aria-label="Ranked items">
          {order.map((o, i) => (
            <li
              key={o}
              className="flex items-center gap-3 rounded-2xl border border-[#D9DFDA] bg-white px-4 py-3 text-sm"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#DCE8E4] text-xs font-semibold text-[#244943]">
                {i + 1}
              </span>
              <span className="flex-1 text-[#1C1C1C]">{o}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="Move up"
                  className="rounded-lg p-1 text-[#6B7280] hover:bg-[#F7F9F7] disabled:opacity-30"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  aria-label="Move down"
                  className="rounded-lg p-1 text-[#6B7280] hover:bg-[#F7F9F7] disabled:opacity-30"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(o)}
                  aria-label="Remove"
                  className="rounded-lg p-1 text-[#6B7280] hover:bg-[#F7F9F7]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {unranked.length > 0 && order.length < topN && (
        <div>
          <p className="mb-2 text-xs text-[#6B7280]">
            {order.length === 0
              ? `Pick and rank ${topN === available.length ? "all" : `your top ${topN}`}:`
              : order.length < topN
              ? `Add ${topN - order.length} more…`
              : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {unranked.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => add(o)}
                className="rounded-full border border-[#E8ECE8] bg-white px-3 py-1.5 text-xs text-[#1C1C1C] hover:bg-[#DCE8E4]/60"
              >
                + {o}
              </button>
            ))}
          </div>
        </div>
      )}
      {void Info}
    </div>
  );
}

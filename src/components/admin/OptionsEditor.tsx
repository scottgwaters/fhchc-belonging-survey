"use client";

import { useRef, useState } from "react";
import { GripVertical, X, Plus, Check } from "lucide-react";
import { Helper } from "@/components/ui/primitives";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  /** Affects only preview rendering (radio vs checkbox). */
  kind: "radio" | "checkbox";
  /** Preview heading ("Respondent preview") — set false when embedded where header is separate. */
  showPreview?: boolean;
}

export function OptionsEditor({ value, onChange, kind, showPreview = true }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const rowsRef = useRef<Array<HTMLInputElement | null>>([]);

  const counts: Record<string, number> = {};
  for (const v of value) {
    const k = v.trim().toLowerCase();
    if (!k) continue;
    counts[k] = (counts[k] ?? 0) + 1;
  }

  function setAt(i: number, next: string) {
    const out = value.slice();
    out[i] = next;
    onChange(out);
  }

  function insertAt(i: number, text = "") {
    const out = value.slice();
    out.splice(i, 0, text);
    onChange(out);
    // Focus the new input on next tick
    requestAnimationFrame(() => rowsRef.current[i]?.focus());
  }

  function removeAt(i: number) {
    const out = value.slice();
    out.splice(i, 1);
    onChange(out.length ? out : [""]);
    requestAnimationFrame(() =>
      rowsRef.current[Math.max(0, i - 1)]?.focus()
    );
  }

  function move(from: number, to: number) {
    if (from === to) return;
    const out = value.slice();
    const [moved] = out.splice(from, 1);
    out.splice(to, 0, moved);
    onChange(out);
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      insertAt(i + 1, "");
    } else if (
      e.key === "Backspace" &&
      value[i] === "" &&
      value.length > 1
    ) {
      e.preventDefault();
      removeAt(i);
    } else if (e.key === "ArrowDown" && e.altKey) {
      e.preventDefault();
      if (i < value.length - 1) move(i, i + 1);
    } else if (e.key === "ArrowUp" && e.altKey) {
      e.preventDefault();
      if (i > 0) move(i, i - 1);
    }
  }

  const nonEmpty = value.filter((v) => v.trim()).length;

  return (
    <div className="space-y-3">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(240px,280px)]">
        {/* List */}
        <div className="space-y-2">
          {value.map((option, i) => {
            const trimmed = option.trim();
            const isEmpty = option.length > 0 && trimmed.length === 0;
            const isDuplicate =
              trimmed.length > 0 && (counts[trimmed.toLowerCase()] ?? 0) > 1;
            const showError = isEmpty || isDuplicate;
            const isDragging = dragIndex === i;
            const isDropTarget = dropIndex === i && dragIndex !== null && dragIndex !== i;

            return (
              <div
                key={i}
                draggable
                onDragStart={(e) => {
                  setDragIndex(i);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropIndex(i);
                }}
                onDragEnd={() => {
                  if (dragIndex !== null && dropIndex !== null) move(dragIndex, dropIndex);
                  setDragIndex(null);
                  setDropIndex(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null) move(dragIndex, i);
                  setDragIndex(null);
                  setDropIndex(null);
                }}
                className={[
                  "group flex items-center gap-2 rounded-xl border bg-white px-2 py-1.5 transition",
                  isDragging ? "opacity-40" : "",
                  isDropTarget ? "border-[#2F5D54] ring-2 ring-[#2F5D54]/30" : "border-[#D9DFDA]",
                  showError ? "border-[#F4C6C6]" : "",
                ].join(" ")}
              >
                <span
                  className="flex h-8 w-6 cursor-grab items-center justify-center text-[#9CA3AF] hover:text-[#374151] active:cursor-grabbing"
                  aria-label="Drag to reorder"
                  title="Drag to reorder (or Alt+↑/↓)"
                >
                  <GripVertical className="h-4 w-4" />
                </span>
                <input
                  ref={(el) => {
                    rowsRef.current[i] = el;
                  }}
                  type="text"
                  value={option}
                  onChange={(e) => setAt(i, e.target.value)}
                  onKeyDown={(e) => onKeyDown(i, e)}
                  placeholder={`Option ${i + 1}`}
                  className="min-w-0 flex-1 bg-transparent py-2 text-sm text-[#1C1C1C] placeholder:text-[#9CA3AF] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  aria-label={`Remove option ${i + 1}`}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#9CA3AF] opacity-0 transition hover:bg-[#F7F9F7] hover:text-[#991B1B] focus:opacity-100 group-hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5D54]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => insertAt(value.length, "")}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#C7D0CA] px-3 py-1.5 text-sm font-medium text-[#244943] hover:border-[#2F5D54] hover:bg-[#DCE8E4]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5D54] focus-visible:ring-offset-2"
          >
            <Plus className="h-3.5 w-3.5" />
            Add option
          </button>

          <ValidationRow value={value} />
          <Helper>
            {nonEmpty} option{nonEmpty === 1 ? "" : "s"} · press Enter to add,
            Backspace on an empty row to remove, Alt+↑/↓ to reorder
          </Helper>
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="rounded-2xl border border-[#D9DFDA] bg-[#F7F9F7] p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              Respondent preview
            </p>
            <OptionPreview value={value} kind={kind} />
          </div>
        )}
      </div>
    </div>
  );
}

function ValidationRow({ value }: { value: string[] }) {
  const seen = new Map<string, number>();
  const dupes = new Set<string>();
  let emptyCount = 0;
  for (const v of value) {
    const t = v.trim();
    if (!t) {
      if (v.length > 0) emptyCount++;
      continue;
    }
    const k = t.toLowerCase();
    seen.set(k, (seen.get(k) ?? 0) + 1);
    if ((seen.get(k) ?? 0) > 1) dupes.add(t);
  }
  const messages: string[] = [];
  if (emptyCount > 0) messages.push(`${emptyCount} empty row${emptyCount === 1 ? "" : "s"}`);
  if (dupes.size > 0) messages.push(`Duplicate: ${Array.from(dupes).slice(0, 3).join(", ")}`);
  if (messages.length === 0) return null;
  return (
    <p className="text-xs font-medium text-[#991B1B]">{messages.join(" · ")}</p>
  );
}

function OptionPreview({ value, kind }: { value: string[]; kind: "radio" | "checkbox" }) {
  const visible = value.filter((v) => v.trim().length > 0);
  if (visible.length === 0) {
    return (
      <p className="text-sm text-[#9CA3AF]">
        Add an option to see the preview.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5" aria-hidden>
      {visible.map((o, i) => (
        <li
          key={i}
          className="flex items-center gap-2.5 rounded-lg border border-[#E8ECE8] bg-white px-3 py-2 text-sm text-[#1C1C1C]"
        >
          <span
            className={[
              "flex h-5 w-5 shrink-0 items-center justify-center border border-[#C7D0CA] bg-white",
              kind === "radio" ? "rounded-full" : "rounded-md",
            ].join(" ")}
          >
            {i === 0 && kind === "checkbox" && (
              <Check className="h-3 w-3 text-[#C7D0CA]" />
            )}
            {i === 0 && kind === "radio" && (
              <span className="h-2 w-2 rounded-full bg-[#C7D0CA]" />
            )}
          </span>
          <span className="truncate">{o}</span>
        </li>
      ))}
    </ul>
  );
}

"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Link as LinkIcon,
  Eye,
  Type,
} from "lucide-react";
import {
  renderMarkdownToHtml,
  substituteVariables,
  VARIABLE_DEFINITIONS,
  type VariableToken,
} from "@/lib/render-markdown";

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Variables that can be inserted as chips. Empty = no variable toolbar. */
  variables?: readonly VariableToken[];
  rows?: number;
  helpText?: string;
}

const SAMPLE_VARS = Object.fromEntries(
  VARIABLE_DEFINITIONS.map((v) => [v.token, v.sample])
) as Record<string, string>;

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  variables,
  rows = 8,
  helpText,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  const previewHtml = useMemo(() => {
    const substituted = substituteVariables(value, {
      firstName: SAMPLE_VARS.firstName,
      surveyLink: SAMPLE_VARS.surveyLink,
      closeDate: SAMPLE_VARS.closeDate,
      campaignName: SAMPLE_VARS.campaignName,
    });
    return renderMarkdownToHtml(substituted);
  }, [value]);

  // Wrap the current selection (or insertion point) with a markdown delimiter.
  function wrap(prefix: string, suffix: string = prefix, placeholderText = "text") {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const inner = selected || placeholderText;
    const next =
      value.slice(0, start) + prefix + inner + suffix + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursorStart = start + prefix.length;
      el.setSelectionRange(cursorStart, cursorStart + inner.length);
    });
  }

  // Ensure each line in the selection has the given line prefix (`- `, `1. `, etc.).
  function applyLinePrefix(lineFn: (i: number) => string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = value.slice(0, start);
    const sel = value.slice(start, end) || "item";
    const after = value.slice(end);
    const lines = sel.split("\n");
    const transformed = lines.map((l, i) => `${lineFn(i)}${l}`).join("\n");
    const next = before + transformed + after;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, start + transformed.length);
    });
  }

  function insertLink() {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || "link text";
    const url = window.prompt("Link URL:", "https://");
    if (!url) return;
    const next =
      value.slice(0, start) + `[${selected}](${url})` + value.slice(end);
    onChange(next);
  }

  function insertVariable(token: string) {
    const el = ref.current;
    if (!el) {
      onChange(value + ` {{${token}}}`);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const insert = `{{${token}}}`;
    const next = value.slice(0, start) + insert + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + insert.length, start + insert.length);
    });
  }

  // Keyboard shortcuts (Cmd/Ctrl+B, Cmd/Ctrl+I)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "b") {
        e.preventDefault();
        wrap("**");
      } else if (e.key === "i") {
        e.preventDefault();
        wrap("*");
      }
    }
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const variableDefs = useMemo(
    () =>
      (variables ?? []).map(
        (t) => VARIABLE_DEFINITIONS.find((v) => v.token === t)!
      ),
    [variables]
  );

  return (
    <div className="rounded-2xl border border-[#D9DFDA] bg-white">
      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-[#E8ECE8] bg-[#F7F9F7] px-2 py-1.5">
        <div className="flex items-center gap-0.5">
          <TabButton active={tab === "edit"} onClick={() => setTab("edit")}>
            <Type className="h-3.5 w-3.5" />
            Write
          </TabButton>
          <TabButton active={tab === "preview"} onClick={() => setTab("preview")}>
            <Eye className="h-3.5 w-3.5" />
            Preview
          </TabButton>
        </div>
        {tab === "edit" && (
          <div className="flex items-center gap-0.5">
            <ToolButton title="Bold (⌘B)" onClick={() => wrap("**")}>
              <Bold className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton title="Italic (⌘I)" onClick={() => wrap("*")}>
              <Italic className="h-3.5 w-3.5" />
            </ToolButton>
            <Divider />
            <ToolButton title="Heading" onClick={() => applyLinePrefix(() => "## ")}>
              <Heading2 className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton
              title="Bullet list"
              onClick={() => applyLinePrefix(() => "- ")}
            >
              <List className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton
              title="Numbered list"
              onClick={() => applyLinePrefix((i) => `${i + 1}. `)}
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton title="Insert link" onClick={insertLink}>
              <LinkIcon className="h-3.5 w-3.5" />
            </ToolButton>
          </div>
        )}
      </div>

      {/* Variable chips (edit mode + has variables) */}
      {tab === "edit" && variableDefs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[#D9DFDA] bg-white px-3 py-2">
          <span className="text-xs text-[#6B7280]">Insert:</span>
          {variableDefs.map((v) => (
            <button
              key={v.token}
              type="button"
              onClick={() => insertVariable(v.token)}
              title={v.description}
              className="inline-flex items-center gap-1 rounded-full border border-[#C5D6CF] bg-[#DCE8E4] px-2 py-0.5 text-xs font-medium text-[#1D3931] hover:bg-[#C5D6CF]"
            >
              <span className="rounded bg-white/70 px-1 font-mono text-[10px] text-[#244943]">
                +
              </span>
              {v.label}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      {tab === "edit" ? (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="block w-full resize-y rounded-b-2xl bg-white px-4 py-3 font-mono text-sm leading-6 outline-none focus:ring-2 focus:ring-inset focus:ring-[#C5D6CF]"
        />
      ) : (
        <div
          className="prose-survey min-h-[160px] rounded-b-2xl bg-white px-4 py-3 text-sm"
          dangerouslySetInnerHTML={{
            __html:
              previewHtml ||
              `<p class="text-[#9CA3AF]">Nothing to preview yet.</p>`,
          }}
        />
      )}

      {helpText && (
        <p className="border-t border-[#E8ECE8] px-3 py-2 text-xs text-[#9CA3AF]">
          {helpText}
        </p>
      )}

      {/* prose-survey styles live in src/app/globals.css so they apply both here
          and on the respondent-facing welcome screen. */}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
        active
          ? "bg-white text-[#1C1C1C] shadow-sm"
          : "text-[#6B7280] hover:text-[#1C1C1C]"
      }`}
    >
      {children}
    </button>
  );
}

function ToolButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#6B7280] hover:bg-white hover:text-[#1C1C1C]"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px bg-[#E8ECE8]" />;
}

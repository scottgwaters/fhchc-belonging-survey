import { Lock } from "lucide-react";
import type { QuestionReport } from "@/lib/reporting";

interface Props {
  totals: { invited: number; completed: number; emt: number; nonEmt: number };
  questions: QuestionReport[];
}

function pct(num: number, denom: number): string {
  if (denom === 0) return "—";
  return `${Math.round((num / denom) * 100)}%`;
}

export function ReportView({ totals, questions }: Props) {
  // Group by section by inferring from prompt? We don't have section here,
  // so render flat — section info would require extending the API payload.
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Tile label="Invited" value={totals.invited} />
        <Tile
          label="Completed"
          value={totals.completed}
          sub={pct(totals.completed, totals.invited)}
        />
        <Tile label="EMT responses" value={totals.emt} />
        <Tile label="Non-EMT" value={totals.nonEmt} />
      </div>

      <div className="space-y-3">
        {questions.length === 0 && (
          <div className="rounded-2xl border border-[#D9DFDA] bg-white p-6 text-sm text-[#6B7280]">
            No questions configured.
          </div>
        )}
        {questions.map((q) => (
          <QuestionCard key={q.questionId} q={q} />
        ))}
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#D9DFDA] bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-[#6B7280]">{label}</p>
      <p className="mt-2 text-2xl font-medium text-[#1C1C1C]">
        {value}
        {sub && <span className="ml-2 text-sm text-[#6B7280]">{sub}</span>}
      </p>
    </div>
  );
}

function QuestionCard({ q }: { q: QuestionReport }) {
  if (q.type === "suppressed") {
    return (
      <div className="rounded-2xl border border-[#D9DFDA] bg-white p-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm text-[#1C1C1C]">{q.prompt}</p>
          {q.metricCode && (
            <code className="text-xs text-[#9CA3AF]">{q.metricCode}</code>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
          <Lock className="h-3.5 w-3.5" />
          {q.reason}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#D9DFDA] bg-white p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-sm text-[#1C1C1C]">{q.prompt}</p>
        {q.metricCode && (
          <code className="shrink-0 text-xs text-[#9CA3AF]">{q.metricCode}</code>
        )}
      </div>

      {q.type === "slider" && <SliderResultCard r={q} />}
      {q.type === "single_select" && <SelectResultCard r={q} />}
      {q.type === "multi_select" && <MultiSelectResultCard r={q} />}
      {q.type === "likert_grid" && <LikertGridResultCard r={q} />}
      {q.type === "numeric" && <NumericResultCard r={q} />}
      {q.type === "open_text" && (
        <p className="text-xs text-[#6B7280]">
          {q.n} open-text response{q.n === 1 ? "" : "s"} (download via Exports)
        </p>
      )}
      {(q.type === "date" || q.type === "ranking") && (
        <p className="text-xs text-[#6B7280]">
          {q.n} {q.type} response{q.n === 1 ? "" : "s"} (download via Exports)
        </p>
      )}
    </div>
  );
}

function LikertGridResultCard({
  r,
}: {
  r: Extract<QuestionReport, { type: "likert_grid" }>;
}) {
  const entries = Object.entries(r.perStatement);
  if (entries.length === 0) {
    return <p className="text-xs text-[#6B7280]">No statements configured.</p>;
  }
  return (
    <div className="space-y-1">
      <p className="text-sm text-[#374151]">n = {r.n}</p>
      <div className="rounded-xl border border-[#E8ECE8] bg-white">
        <table className="w-full text-xs">
          <thead className="bg-[#F7F9F7] text-[#6B7280]">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium">Statement</th>
              <th className="px-3 py-1.5 text-right font-medium">n</th>
              <th className="px-3 py-1.5 text-right font-medium">Favorable %</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([key, s]) => (
              <tr key={key} className="border-t border-[#E8ECE8]">
                <td className="px-3 py-1.5">{s.label}</td>
                {"suppressed" in s.result ? (
                  <td colSpan={2} className="px-3 py-1.5 text-right text-[#9CA3AF]">
                    suppressed
                  </td>
                ) : (
                  <>
                    <td className="px-3 py-1.5 text-right">{s.result.nAnswered}</td>
                    <td className="px-3 py-1.5 text-right">
                      {s.result.favorablePct !== null ? `${s.result.favorablePct}%` : "—"}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NumericResultCard({
  r,
}: {
  r: Extract<QuestionReport, { type: "numeric" }>;
}) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#374151]">
      <span>n = {r.n}</span>
      {r.mean !== null && <span>mean {r.mean}</span>}
      {r.median !== null && <span>median {r.median}</span>}
      {r.min !== null && r.max !== null && (
        <span>
          range [{r.min}, {r.max}]
        </span>
      )}
    </div>
  );
}

function SliderResultCard({
  r,
}: {
  r: Extract<QuestionReport, { type: "slider" }>;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#374151]">
        <span>n = {r.n}</span>
        {r.mean !== null && <span>mean {r.mean}</span>}
        {r.median !== null && <span>median {r.median}</span>}
        {r.favorablePct !== null && (
          <span>
            favorable (≥{r.favorableThreshold}): <strong>{r.favorablePct}%</strong>
          </span>
        )}
        {r.reverseScored && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
            reverse-scored
          </span>
        )}
      </div>
      {r.perItem && (
        <div className="rounded-xl border border-[#E8ECE8] bg-white">
          <table className="w-full text-xs">
            <thead className="bg-[#F7F9F7] text-[#6B7280]">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Item</th>
                <th className="px-3 py-1.5 text-right font-medium">n</th>
                <th className="px-3 py-1.5 text-right font-medium">Mean</th>
                <th className="px-3 py-1.5 text-right font-medium">Favorable %</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(r.perItem).map(([k, v]) => (
                <tr key={k} className="border-t border-[#E8ECE8]">
                  <td className="px-3 py-1.5">
                    {k}
                    {v.reverseScored && (
                      <span className="ml-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700">
                        rev
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right">{v.n}</td>
                  <td className="px-3 py-1.5 text-right">{v.mean ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right">
                    {v.favorablePct !== null ? `${v.favorablePct}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SelectResultCard({
  r,
}: {
  r: Extract<QuestionReport, { type: "single_select" }>;
}) {
  const total = r.nAnswered;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#374151]">
        <span>
          n = {r.n}{" "}
          {r.nDontKnow > 0 && (
            <span className="text-xs text-[#6B7280]">
              ({r.nDontKnow} Don&rsquo;t Know — excluded)
            </span>
          )}
        </span>
        {r.favorablePct !== null && (
          <span>
            favorable: <strong>{r.favorablePct}%</strong>
          </span>
        )}
        {r.reverseScored && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
            reverse-scored
          </span>
        )}
      </div>
      <div className="space-y-1">
        {Object.entries(r.countsByOption).map(([opt, count]) => {
          const isFav = r.favorableOptions.includes(opt);
          const p = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={opt} className="flex items-center gap-3 text-xs">
              <span className="w-48 shrink-0 truncate text-[#374151]">
                {opt}
                {isFav && (
                  <span className="ml-1 text-[#244943]">●</span>
                )}
              </span>
              <div className="relative h-2 flex-1 rounded-full bg-[#EFF3EF]">
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-[#2F5D54]"
                  style={{ width: `${p}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-[#6B7280]">
                {count} ({total > 0 ? Math.round(p) : 0}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MultiSelectResultCard({
  r,
}: {
  r: Extract<QuestionReport, { type: "multi_select" }>;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-[#374151]">
        n = {r.n} respondents
        {r.otherCount > 0 && (
          <span className="ml-2 text-xs text-[#6B7280]">
            · {r.otherCount} provided custom &ldquo;Other&rdquo; text
          </span>
        )}
      </p>
      <div className="space-y-1">
        {Object.entries(r.countsByOption)
          .sort(([, a], [, b]) => b - a)
          .map(([opt, count]) => {
            const p = r.n > 0 ? (count / r.n) * 100 : 0;
            return (
              <div key={opt} className="flex items-center gap-3 text-xs">
                <span className="w-48 shrink-0 truncate text-[#374151]">{opt}</span>
                <div className="relative h-2 flex-1 rounded-full bg-[#EFF3EF]">
                  <div
                    className="absolute left-0 top-0 h-full rounded-full bg-[#2F5D54]"
                    style={{ width: `${p}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-[#6B7280]">
                  {count} ({r.n > 0 ? Math.round(p) : 0}%)
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

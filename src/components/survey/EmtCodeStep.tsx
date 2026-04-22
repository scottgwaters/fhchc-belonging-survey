"use client";

import { useState, useTransition } from "react";
import { Key } from "lucide-react";

interface Props {
  sessionId: string;
  required: boolean;
  onContinue: () => void;
}

/**
 * PRD §12.3 - EMT code entry step.
 */
export function EmtCodeStep({ sessionId, required, onContinue }: Props) {
  const [isPending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  if (!required) {
    onContinue();
    return null;
  }

  function submit() {
    setError(null);
    if (!code.trim()) {
      onContinue();
      return;
    }
    startTransition(async () => {
      const res = await fetch(
        `/api/survey/session/${sessionId}/validate-emt`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        onContinue();
        return;
      }
      if (body.locked) setLocked(true);
      if (typeof body.attemptsRemaining === "number") {
        setAttemptsRemaining(body.attemptsRemaining);
      }
      setError(body.error ?? "That code wasn't recognized.");
    });
  }

  return (
    <div className="rounded-3xl border border-[#D9DFDA] bg-white p-8 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-[#244943]">
        <Key className="h-4 w-4" />
        <p className="text-xs font-semibold uppercase tracking-wide">
          EMT verification
        </p>
      </div>
      <h1 className="t-page-title">EMT code (optional)</h1>
      <p className="mt-3 text-base text-[#374151]">
        If you received a private EMT code, enter it now so your responses are
        recorded as part of the EMT segment. Otherwise, leave this blank and
        continue — your survey is not affected.
      </p>

      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        autoComplete="off"
        autoCapitalize="characters"
        placeholder="Enter code"
        disabled={locked}
        aria-label="EMT code"
        className="mt-6 h-12 w-full rounded-xl border border-[#D9DFDA] bg-white px-4 text-base font-mono text-[#1C1C1C] focus:outline-none focus:border-[#2F5D54] focus:ring-2 focus:ring-[#2F5D54]/30 disabled:bg-[#F7F9F7]"
      />

      {error && (
        <p className="mt-3 rounded-xl bg-[#FEE2E2] p-3 text-sm text-[#991B1B]">
          {error}
          {attemptsRemaining !== null && !locked && (
            <span className="ml-1 text-xs">
              ({attemptsRemaining} attempt{attemptsRemaining === 1 ? "" : "s"} remaining)
            </span>
          )}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        {!locked ? (
          <button
            type="button"
            onClick={() => onContinue()}
            className="text-sm font-medium text-[#374151] hover:text-[#1C1C1C] underline underline-offset-4 decoration-[#C7D0CA] hover:decoration-[#2F5D54]"
          >
            Skip — I don&rsquo;t have a code
          </button>
        ) : (
          <span className="text-sm font-medium text-[#991B1B]">
            This session is locked. Restart from your invitation link.
          </span>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={isPending || locked}
          className="inline-flex h-12 items-center justify-center rounded-full bg-[#1C1C1C] px-6 text-base font-medium text-white hover:bg-[#1D3931] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5D54] focus-visible:ring-offset-2"
        >
          {isPending ? "Verifying…" : "Continue"}
        </button>
      </div>
    </div>
  );
}

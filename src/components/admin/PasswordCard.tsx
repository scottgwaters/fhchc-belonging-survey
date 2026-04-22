"use client";

import { useState, useTransition } from "react";

interface Props {
  hasPassword: boolean;
}

export function PasswordCard({ hasPassword }: Props) {
  const [isPending, startTransition] = useTransition();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit() {
    setError(null);
    setDone(false);
    if (next !== confirm) {
      setError("New password and confirmation don't match");
      return;
    }
    if (next.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/admin/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: hasPassword ? current : undefined,
          newPassword: next,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    });
  }

  return (
    <div className="space-y-3">
      {!hasPassword && (
        <p className="rounded-xl bg-[#DCE8E4] px-3 py-2 text-xs text-[#1D3931]">
          You signed in with Google. Set a password here to also enable
          email/password login.
        </p>
      )}
      {hasPassword && (
        <Field label="Current password">
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            className="input"
          />
        </Field>
      )}
      <Field label="New password (8+ characters)">
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          className="input"
        />
      </Field>
      <Field label="Confirm new password">
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          className="input"
        />
      </Field>
      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>
      )}
      {done && (
        <p className="rounded-xl bg-[#DCE8E4] p-3 text-xs text-[#1D3931]">
          Password updated.
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={isPending || !next || !confirm || (hasPassword && !current)}
        className="rounded-full bg-[#1C1C1C] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D3931] disabled:opacity-50"
      >
        {isPending ? "Saving..." : hasPassword ? "Change password" : "Set password"}
      </button>
      <style jsx>{`
        .input {
          width: 100%;
          border: 1px solid #e8ece8;
          border-radius: 12px;
          padding: 8px 12px;
          background: white;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[#6B7280]">{label}</span>
      {children}
    </label>
  );
}

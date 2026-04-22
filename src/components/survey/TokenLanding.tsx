"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SurveyChrome } from "./SurveyChrome";
import { SurveyWelcome } from "./SurveyWelcome";
import { renderMarkdownToHtml } from "@/lib/render-markdown";
import type { TokenState } from "@/lib/survey";

interface Props {
  state: TokenState;
  token: string;
}

function formatDate(d: Date | string | null): string | undefined {
  if (!d) return undefined;
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function TokenLanding({ state, token }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const introCopy =
    state.kind === "welcome" || state.kind === "resume"
      ? state.campaign.introCopy
      : null;
  const introHtml = useMemo(
    () => (introCopy ? renderMarkdownToHtml(introCopy) : ""),
    [introCopy]
  );

  const theme =
    state.kind === "welcome" || state.kind === "resume"
      ? state.campaign.theme
      : null;
  const logoUrl =
    state.kind === "welcome" || state.kind === "resume"
      ? state.campaign.logoUrl
      : null;
  const logoAlt =
    state.kind === "welcome" || state.kind === "resume"
      ? state.campaign.logoAlt
      : null;

  function begin() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/survey/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Could not start the survey. Try again.");
        return;
      }
      router.push(`/survey/session/${body.sessionId}`);
    });
  }

  if (state.kind === "invalid" || state.kind === "expired") {
    return (
      <SurveyChrome>
        <Card>
          <h1 className="t-page-title">This link isn&rsquo;t valid</h1>
          <p className="mt-3 text-base text-[#374151]">
            If you received an invitation, please use the original email link or
            contact your administrator.
          </p>
        </Card>
      </SurveyChrome>
    );
  }

  if (state.kind === "already_submitted") {
    return (
      <SurveyChrome theme={theme} logoUrl={logoUrl} logoAlt={logoAlt}>
        <Card>
          <h1 className="t-page-title">Thank you</h1>
          <p className="mt-3 text-base text-[#374151]">
            Your survey has been received. Each invitation can only be used
            once.
          </p>
        </Card>
      </SurveyChrome>
    );
  }

  const isResume = state.kind === "resume";
  const welcomeCopy =
    state.kind === "welcome" || state.kind === "resume"
      ? (state.campaign.welcomeCopyJson as
          | import("@/lib/welcome-copy").WelcomeCopy
          | null)
      : null;
  return (
    <SurveyChrome theme={theme} logoUrl={logoUrl} logoAlt={logoAlt}>
      <SurveyWelcome
        campaignName={state.campaign.name}
        introHtml={introHtml || undefined}
        visibleCloseDateLabel={formatDate(state.campaign.visibleCloseAt)}
        pendingLabel={
          isPending ? "Starting…" : isResume ? "Continue" : "Begin survey"
        }
        isResume={isResume}
        isPending={isPending}
        errorMessage={error}
        onBegin={begin}
        copy={welcomeCopy}
      />
    </SurveyChrome>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-[#D9DFDA] bg-white p-8 shadow-sm">
      {children}
    </div>
  );
}

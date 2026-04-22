"use client";

import { useRef } from "react";
import {
  Lock,
  Clock,
  Users,
  Sprout,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import {
  DEFAULT_WELCOME_COPY,
  resolveWelcomeCopy,
  type WelcomeCopy,
} from "@/lib/welcome-copy";

interface Props {
  campaignName: string;
  introHtml?: string;
  visibleCloseDateLabel?: string;
  pendingLabel: string;
  isResume?: boolean;
  isPending?: boolean;
  errorMessage?: string | null;
  onBegin: () => void;
  /** Optional override. Any missing fields fall back to the defaults. */
  copy?: Partial<WelcomeCopy> | WelcomeCopy | null;
}

/**
 * Respondent-facing hero welcome screen, styled after the marketing-grade
 * mockup: big italic headline, trust cards, principles, ready banner.
 * Accent color is driven by CSS vars (see SurveyChrome + themes.ts) so every
 * campaign theme flows through automatically.
 */
export function SurveyWelcome({
  campaignName,
  introHtml,
  visibleCloseDateLabel,
  pendingLabel,
  isResume,
  isPending,
  errorMessage,
  onBegin,
  copy,
}: Props) {
  const principlesRef = useRef<HTMLDivElement>(null);
  const scrollToPrinciples = () =>
    principlesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const c = copy ? resolveWelcomeCopy(copy) : DEFAULT_WELCOME_COPY;
  const thirdBody = visibleCloseDateLabel
    ? `${c.trustCards[2].body} Closes ${visibleCloseDateLabel}.`
    : c.trustCards[2].body;

  return (
    <div className="-mx-6 -my-8">
      {/* HERO */}
      <section className="mx-auto w-full max-w-5xl px-6 pt-16 pb-20 md:px-10 md:pt-24 md:pb-28">
        <div
          className="mb-7 text-[12px] font-medium uppercase"
          style={{ letterSpacing: "0.24em", color: "var(--accent-strong)" }}
        >
          {campaignName}
        </div>

        <h1
          className="font-medium text-[#1C1C1C]"
          style={{
            fontSize: "clamp(40px, 6.5vw, 84px)",
            lineHeight: 1.04,
            letterSpacing: "-0.03em",
            maxWidth: 920,
            marginBottom: 28,
          }}
        >
          {isResume ? (
            <>Welcome back.</>
          ) : (
            <>
              Your voice
              <br />
              shapes our{" "}
              <span
                style={{
                  color: "var(--accent-strong)",
                  fontStyle: "italic",
                  fontWeight: 400,
                }}
              >
                culture.
              </span>
            </>
          )}
        </h1>

        {introHtml ? (
          <div
            className="prose-survey text-[#374151]"
            style={{ fontSize: 20, lineHeight: 1.5, maxWidth: 620, marginBottom: 44 }}
            dangerouslySetInnerHTML={{ __html: introHtml }}
          />
        ) : (
          <p
            className="text-[#374151]"
            style={{ fontSize: 20, lineHeight: 1.5, maxWidth: 620, marginBottom: 44 }}
          >
            {isResume
              ? "You have answers in progress. Continue where you left off, or start over."
              : "Help us build a workplace where every clinician, staff member, and leader feels they belong. Five steps, about four minutes, completely confidential."}
          </p>
        )}

        <div className="mb-20 flex flex-wrap items-center gap-5">
          <button
            type="button"
            onClick={onBegin}
            disabled={isPending}
            className="inline-flex h-12 items-center gap-2 rounded-full px-7 text-base font-medium text-white transition disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ background: "var(--accent-strong)" }}
          >
            {pendingLabel}
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </button>
          {!isResume && (
            <button
              type="button"
              onClick={scrollToPrinciples}
              className="text-base font-medium hover:underline underline-offset-4"
              style={{ color: "var(--accent-strong)" }}
            >
              How it works ↓
            </button>
          )}
        </div>

        {errorMessage && (
          <p className="mb-6 max-w-xl rounded-xl bg-[#FEE2E2] px-4 py-3 text-sm text-[#991B1B]">
            {errorMessage}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <TrustCard
            Icon={Lock}
            title={c.trustCards[0].title}
            body={c.trustCards[0].body}
          />
          <TrustCard
            Icon={Clock}
            title={c.trustCards[1].title}
            body={c.trustCards[1].body}
          />
          <TrustCard
            Icon={ShieldCheck}
            title={c.trustCards[2].title}
            body={thirdBody}
          />
        </div>
      </section>

      {/* PRINCIPLES */}
      <section
        ref={principlesRef}
        className="mx-auto w-full max-w-5xl px-6 pb-24 pt-10 md:px-10"
      >
        <div
          className="mb-5 text-[12px] font-medium uppercase"
          style={{ letterSpacing: "0.24em", color: "var(--accent-strong)" }}
        >
          {c.principlesEyebrow}
        </div>
        <h2
          className="font-medium text-[#1C1C1C]"
          style={{
            fontSize: "clamp(32px, 4.5vw, 52px)",
            lineHeight: 1.08,
            letterSpacing: "-0.025em",
            maxWidth: 720,
            marginBottom: 20,
          }}
        >
          {c.principlesTitle}
        </h2>
        <p
          className="text-[#374151]"
          style={{ fontSize: 18, lineHeight: 1.5, maxWidth: 620, marginBottom: 56 }}
        >
          {c.principlesIntro}
        </p>

        <div className="mb-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <PrincipleCard Icon={Lock} {...c.principles[0]} />
          <PrincipleCard Icon={Clock} {...c.principles[1]} />
          <PrincipleCard Icon={Users} {...c.principles[2]} />
          <PrincipleCard Icon={Sprout} {...c.principles[3]} />
        </div>

        <ReadyBanner
          onBegin={onBegin}
          pendingLabel={pendingLabel}
          isPending={isPending}
          title={c.readyTitle}
          body={c.readyBody}
        />
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

type IconType = typeof Lock;

function TrustCard({
  Icon,
  title,
  body,
}: {
  Icon: IconType;
  title: string;
  body: string;
}) {
  return (
    <div
      className="rounded-3xl border border-[#E8ECE8] bg-white"
      style={{ padding: "24px 24px 28px" }}
    >
      <div
        className="mb-4 flex h-9 w-9 items-center justify-center rounded-[10px]"
        style={{ background: "var(--accent-soft)" }}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} style={{ color: "var(--accent-strong)" }} />
      </div>
      <div className="text-base font-medium text-[#1C1C1C]">{title}</div>
      <p className="mt-1.5 text-sm leading-relaxed text-[#6B7280]">{body}</p>
    </div>
  );
}

function PrincipleCard({
  Icon,
  eyebrow,
  title,
  body,
}: {
  Icon: IconType;
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div
      className="rounded-3xl border border-[#E8ECE8] bg-white"
      style={{ padding: "32px 28px 36px" }}
    >
      <div
        className="mb-5 flex h-10 w-10 items-center justify-center rounded-[11px]"
        style={{ background: "var(--accent-soft)" }}
      >
        <Icon className="h-4.5 w-4.5" strokeWidth={1.75} style={{ color: "var(--accent-strong)" }} />
      </div>
      <div
        className="mb-3 text-[11px] font-medium uppercase"
        style={{ letterSpacing: "0.22em", color: "var(--accent-strong)" }}
      >
        {eyebrow}
      </div>
      <div
        className="mb-2 text-[20px] font-medium leading-tight text-[#1C1C1C]"
        style={{ letterSpacing: "-0.01em" }}
      >
        {title}
      </div>
      <p className="text-sm leading-relaxed text-[#6B7280]">{body}</p>
    </div>
  );
}

function ReadyBanner({
  onBegin,
  pendingLabel,
  isPending,
  title,
  body,
}: {
  onBegin: () => void;
  pendingLabel: string;
  isPending?: boolean;
  title: string;
  body: string;
}) {
  return (
    <div
      className="flex flex-col gap-4 rounded-3xl md:flex-row md:items-center md:justify-between"
      style={{
        padding: "32px 36px",
        background: "var(--accent-soft)",
        border: "1px solid var(--accent-soft)",
      }}
    >
      <div>
        <div
          className="mb-1 text-[22px] font-medium text-[#1C1C1C]"
          style={{ letterSpacing: "-0.015em" }}
        >
          {title}
        </div>
        <div className="text-[15px] text-[#6B7280]">{body}</div>
      </div>
      <button
        type="button"
        onClick={onBegin}
        disabled={isPending}
        className="inline-flex h-12 items-center gap-2 rounded-full px-6 text-base font-medium text-white transition disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{ background: "var(--accent-strong)" }}
      >
        {pendingLabel}
        <ArrowRight className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}

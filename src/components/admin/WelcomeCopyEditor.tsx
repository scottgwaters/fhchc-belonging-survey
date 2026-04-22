"use client";

import { RotateCcw } from "lucide-react";
import { Button, Input, Label, Textarea } from "@/components/ui/primitives";
import {
  DEFAULT_WELCOME_COPY,
  resolveWelcomeCopy,
  type PrincipleCopy,
  type TrustCardCopy,
  type WelcomeCopy,
} from "@/lib/welcome-copy";

interface Props {
  value: WelcomeCopy | null | undefined;
  onChange: (next: WelcomeCopy) => void;
  onReset: () => void;
}

export function WelcomeCopyEditor({ value, onChange, onReset }: Props) {
  const copy = resolveWelcomeCopy(value ?? null);

  function updateTrust(i: 0 | 1 | 2, patch: Partial<TrustCardCopy>) {
    const next: WelcomeCopy = {
      ...copy,
      trustCards: copy.trustCards.map((c, idx) =>
        idx === i ? { ...c, ...patch } : c
      ) as WelcomeCopy["trustCards"],
    };
    onChange(next);
  }

  function updatePrinciple(i: 0 | 1 | 2 | 3, patch: Partial<PrincipleCopy>) {
    const next: WelcomeCopy = {
      ...copy,
      principles: copy.principles.map((p, idx) =>
        idx === i ? { ...p, ...patch } : p
      ) as WelcomeCopy["principles"],
    };
    onChange(next);
  }

  function updateField<K extends keyof WelcomeCopy>(key: K, v: WelcomeCopy[K]) {
    onChange({ ...copy, [key]: v });
  }

  return (
    <div className="space-y-8">
      {/* Trust cards */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="t-label">Trust cards (shown above the fold)</p>
            <p className="t-helper">
              Three short value props with icons (Privacy, Time, Aggregation).
              The third card auto-appends &ldquo;Closes&nbsp;&lt;date&gt;&rdquo; when a visible close date is set.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
          >
            Reset to defaults
          </Button>
        </div>
        {copy.trustCards.map((card, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[#D9DFDA] bg-white p-4 space-y-3"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <Label label={`Card ${i + 1} title`}>
                <Input
                  value={card.title}
                  onChange={(e) => updateTrust(i as 0 | 1 | 2, { title: e.target.value })}
                  placeholder={DEFAULT_WELCOME_COPY.trustCards[i].title}
                />
              </Label>
              <Label label="Body">
                <Textarea
                  value={card.body}
                  onChange={(e) => updateTrust(i as 0 | 1 | 2, { body: e.target.value })}
                  rows={2}
                  placeholder={DEFAULT_WELCOME_COPY.trustCards[i].body}
                />
              </Label>
            </div>
          </div>
        ))}
      </section>

      {/* Principles section intro */}
      <section className="space-y-3">
        <div>
          <p className="t-label">&ldquo;How it works&rdquo; section</p>
          <p className="t-helper">
            Marketing-style section below the fold explaining the survey
            principles.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Label label="Eyebrow">
            <Input
              value={copy.principlesEyebrow}
              onChange={(e) => updateField("principlesEyebrow", e.target.value)}
              placeholder={DEFAULT_WELCOME_COPY.principlesEyebrow}
            />
          </Label>
          <Label label="Section title">
            <Input
              value={copy.principlesTitle}
              onChange={(e) => updateField("principlesTitle", e.target.value)}
              placeholder={DEFAULT_WELCOME_COPY.principlesTitle}
            />
          </Label>
        </div>
        <Label label="Section intro paragraph">
          <Textarea
            value={copy.principlesIntro}
            onChange={(e) => updateField("principlesIntro", e.target.value)}
            rows={2}
            placeholder={DEFAULT_WELCOME_COPY.principlesIntro}
          />
        </Label>
      </section>

      {/* Principle cards */}
      <section className="space-y-3">
        <p className="t-label">Four principle cards</p>
        {copy.principles.map((p, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[#D9DFDA] bg-white p-4 space-y-3"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <Label label={`Eyebrow ${i + 1}`}>
                <Input
                  value={p.eyebrow}
                  onChange={(e) =>
                    updatePrinciple(i as 0 | 1 | 2 | 3, { eyebrow: e.target.value })
                  }
                  placeholder={DEFAULT_WELCOME_COPY.principles[i].eyebrow}
                />
              </Label>
              <Label label="Title">
                <Input
                  value={p.title}
                  onChange={(e) =>
                    updatePrinciple(i as 0 | 1 | 2 | 3, { title: e.target.value })
                  }
                  placeholder={DEFAULT_WELCOME_COPY.principles[i].title}
                />
              </Label>
            </div>
            <Label label="Body">
              <Textarea
                value={p.body}
                onChange={(e) =>
                  updatePrinciple(i as 0 | 1 | 2 | 3, { body: e.target.value })
                }
                rows={2}
                placeholder={DEFAULT_WELCOME_COPY.principles[i].body}
              />
            </Label>
          </div>
        ))}
      </section>

      {/* Ready banner */}
      <section className="space-y-3">
        <p className="t-label">&ldquo;Ready when you are&rdquo; banner</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Label label="Title">
            <Input
              value={copy.readyTitle}
              onChange={(e) => updateField("readyTitle", e.target.value)}
              placeholder={DEFAULT_WELCOME_COPY.readyTitle}
            />
          </Label>
          <Label label="Body">
            <Input
              value={copy.readyBody}
              onChange={(e) => updateField("readyBody", e.target.value)}
              placeholder={DEFAULT_WELCOME_COPY.readyBody}
            />
          </Label>
        </div>
      </section>
    </div>
  );
}

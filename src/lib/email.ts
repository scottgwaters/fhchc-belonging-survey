// PRD §18.2 - SendGrid (locked).
// In dev / when no SENDGRID_API_KEY is configured, emails are logged to stdout
// instead of sent so the rest of the flow remains testable end-to-end.

import sgMail from "@sendgrid/mail";
import {
  markdownToPlainText,
  renderMarkdownToHtml,
  substituteVariables,
} from "./render-markdown";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const key = process.env.SENDGRID_API_KEY;
  if (key) {
    sgMail.setApiKey(key);
  }
  configured = true;
}

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SendResult {
  ok: boolean;
  delivered: boolean; // true if actually sent via SendGrid
  reason?: string;
}

const DEFAULT_FROM_EMAIL = "survey@example.com";
const DEFAULT_FROM_NAME = "FHCHC Survey";

export async function sendEmail(message: OutboundEmail): Promise<SendResult> {
  ensureConfigured();

  const from = {
    email: process.env.SENDGRID_FROM_EMAIL ?? DEFAULT_FROM_EMAIL,
    name: process.env.SENDGRID_FROM_NAME ?? DEFAULT_FROM_NAME,
  };

  if (!process.env.SENDGRID_API_KEY) {
    console.log(
      `[email:dev-fallback] To=${message.to} Subject=${message.subject}\n--- text ---\n${message.text}\n--- end ---`
    );
    return { ok: true, delivered: false, reason: "no_api_key_dev_fallback" };
  }

  try {
    await sgMail.send({
      to: message.to,
      from,
      subject: message.subject,
      text: message.text,
      html: message.html,
      // Per PRD §8.10 - open tracking disabled (anonymity)
      trackingSettings: {
        clickTracking: { enable: false, enableText: false },
        openTracking: { enable: false },
      },
    });
    return { ok: true, delivered: true };
  } catch (e) {
    const err = e as { message?: string };
    return { ok: false, delivered: false, reason: err.message ?? "send_failed" };
  }
}

interface InvitationContext {
  firstName: string | null;
  surveyUrl: string;
  closeDate: Date | null;
  campaignName: string;
  bodyTemplate: string | null;
}

function formatDate(d: Date | null): string {
  if (!d) return "the deadline";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

const FALLBACK_BODY = `Hi {{firstName}},

You're invited to take this year's survey. It takes about 4 minutes and is completely confidential.

{{surveyLink}}

Please complete it by {{closeDate}}.

Thank you.`;

export function renderInvitationBody(ctx: InvitationContext): string {
  const tmpl = ctx.bodyTemplate || FALLBACK_BODY;
  const substituted = substituteVariables(tmpl, {
    firstName: ctx.firstName,
    surveyLink: ctx.surveyUrl,
    closeDate: formatDate(ctx.closeDate),
    campaignName: ctx.campaignName,
  });
  // Plain-text body for SendGrid `text`. Strip markdown punctuation so the
  // fallback view stays readable in clients that don't render HTML.
  return markdownToPlainText(substituted);
}

export function renderInvitationHtml(ctx: InvitationContext): string {
  const tmpl = ctx.bodyTemplate || FALLBACK_BODY;
  const substituted = substituteVariables(tmpl, {
    firstName: ctx.firstName,
    surveyLink: ctx.surveyUrl,
    closeDate: formatDate(ctx.closeDate),
    campaignName: ctx.campaignName,
  });
  const inner = renderMarkdownToHtml(substituted);
  // Wrap in a minimal email-safe shell with inline-style fallbacks.
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1C1C1C;line-height:1.6;max-width:560px;margin:0 auto;padding:24px;background:#F7F9F7;"><div style="background:#FCFDFC;border:1px solid #E8ECE8;border-radius:16px;padding:24px;">${inner}</div></body></html>`;
}

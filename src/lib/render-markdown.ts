import { marked } from "marked";

// Configure once: strict, no raw HTML, no autolinks of bare URLs we didn't want.
marked.setOptions({
  gfm: true,
  breaks: true,
});

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "em",
  "u",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "a",
  "blockquote",
  "code",
  "pre",
  "hr",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
};

/**
 * Strip every tag not in the allowlist and every attribute not in the per-tag
 * allowlist. Force href on <a> through a basic protocol filter to block javascript:.
 *
 * Lightweight and dependency-free. Acceptable here because admin users are
 * trusted (super_admin / campaign_admin). This is defense-in-depth.
 */
function sanitizeHtml(html: string): string {
  return html.replace(/<\/?([a-z][a-z0-9]*)([^>]*)>/gi, (full, tagRaw, attrsRaw) => {
    const tag = tagRaw.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";

    if (full.startsWith("</")) return `</${tag}>`;

    const allowed = ALLOWED_ATTRS[tag] ?? new Set<string>();
    const attrs: string[] = [];
    const attrPattern = /([a-zA-Z-]+)=("([^"]*)"|'([^']*)')/g;
    let m: RegExpExecArray | null;
    while ((m = attrPattern.exec(attrsRaw ?? "")) !== null) {
      const name = m[1].toLowerCase();
      const value = m[3] ?? m[4] ?? "";
      if (!allowed.has(name)) continue;
      if (name === "href" && !/^(https?:|mailto:|#|\/)/i.test(value)) continue;
      attrs.push(`${name}="${value.replace(/"/g, "&quot;")}"`);
    }

    if (tag === "a" && attrs.length) {
      attrs.push('rel="noopener noreferrer"', 'target="_blank"');
    }

    return `<${tag}${attrs.length ? " " + attrs.join(" ") : ""}>`;
  });
}

export function renderMarkdownToHtml(input: string | null | undefined): string {
  if (!input) return "";
  const raw = marked.parse(input, { async: false }) as string;
  return sanitizeHtml(raw);
}

/**
 * Strip markdown formatting to a plain-text rendering suitable for email
 * `text` body (the HTML body is sent separately via renderMarkdownToHtml).
 */
export function markdownToPlainText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/^#+\s*/gm, "")
    .replace(/^>\s*/gm, "")
    .replace(/^[*-]\s+/gm, "• ")
    .replace(/^\d+\.\s+/gm, "");
}

// ----------------------------------------------------------------------------
// Variable substitution
// ----------------------------------------------------------------------------

export interface TemplateVars {
  firstName?: string | null;
  surveyLink?: string;
  closeDate?: string;
  campaignName?: string;
}

export const VARIABLE_DEFINITIONS = [
  {
    token: "firstName",
    label: "First name",
    description: "Recipient's first name (or 'there' if missing)",
    sample: "Alex",
  },
  {
    token: "surveyLink",
    label: "Survey link",
    description: "Personalized survey URL with the recipient's invite token",
    sample: "https://survey.example.com/survey/abc123",
  },
  {
    token: "closeDate",
    label: "Close date",
    description: "Visible close date (e.g., \"April 30, 2026\")",
    sample: "April 30, 2026",
  },
  {
    token: "campaignName",
    label: "Campaign name",
    description: "Campaign name (e.g., \"2026 Belonging Survey\")",
    sample: "2026 Belonging Survey",
  },
] as const;

export type VariableToken = (typeof VARIABLE_DEFINITIONS)[number]["token"];

export function substituteVariables(
  template: string,
  vars: TemplateVars
): string {
  return template
    .replaceAll("{{firstName}}", vars.firstName || "there")
    .replaceAll("{{surveyLink}}", vars.surveyLink ?? "")
    .replaceAll("{{closeDate}}", vars.closeDate ?? "")
    .replaceAll("{{campaignName}}", vars.campaignName ?? "");
}

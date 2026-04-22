import { createHmac, randomBytes } from "crypto";

// PRD §15.3 - Token Lifecycle
// 128-bit random value, base64url-encoded for the URL.
// Stored as HMAC-SHA256(token, INVITE_TOKEN_PEPPER) — never as plaintext.

function getPepper(): string {
  const pepper = process.env.INVITE_TOKEN_PEPPER;
  if (!pepper || pepper.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "INVITE_TOKEN_PEPPER must be set to a 32+ char secret in production"
      );
    }
    // Dev fallback so local boots don't fail. Tokens generated with this
    // fallback are not transferable to other environments.
    return "dev-only-pepper-do-not-use-in-prod-please";
  }
  return pepper;
}

export function generateInviteToken(): { raw: string; hash: string } {
  const bytes = randomBytes(16);
  const raw = bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return { raw, hash: hashInviteToken(raw) };
}

export function hashInviteToken(raw: string): string {
  return createHmac("sha256", getPepper()).update(raw).digest("hex");
}

export function buildSurveyUrl(baseUrl: string, token: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return `${trimmed}/survey/${token}`;
}

// PRD §15.3.1 — EMT code storage
function getEmtPepper(): string {
  const pepper = process.env.EMT_CODE_PEPPER;
  if (!pepper || pepper.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("EMT_CODE_PEPPER must be set in production");
    }
    return "dev-only-emt-pepper-do-not-use-in-prod";
  }
  return pepper;
}

export function normalizeEmtCode(code: string): string {
  return code.trim().toUpperCase();
}

export function hashEmtCode(code: string): string {
  return createHmac("sha256", getEmtPepper())
    .update(normalizeEmtCode(code))
    .digest("hex");
}

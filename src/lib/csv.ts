// Minimal CSV parser + recipient validator for PRD §8.17.2.
// We hand-roll the parser to avoid an extra dependency; covers quoted fields
// with embedded commas and quote-escapes ("" inside a quoted field).

export interface RecipientRow {
  email: string;
  employee_identifier: string;
  first_name?: string;
  location_code?: string;
  role_code?: string;
  expected_rollup_group?: string;
  is_emt_expected?: boolean;
}

export interface RowError {
  row: number; // 1-indexed, excluding header
  field?: string;
  message: string;
}

export interface ParseResult {
  headers: string[];
  rows: Record<string, string>[];
}

function parseCSV(text: string): ParseResult {
  const lines: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\r") {
        // ignore; \n will close the row
      } else if (ch === "\n") {
        row.push(field);
        lines.push(row);
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }
  if (field.length || row.length) {
    row.push(field);
    lines.push(row);
  }

  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < lines.length; r++) {
    const line = lines[r];
    if (line.length === 1 && line[0].trim() === "") continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = (line[c] ?? "").trim();
    }
    rows.push(obj);
  }
  return { headers, rows };
}

const REQUIRED_HEADERS = ["email", "employee_identifier"];
const KNOWN_HEADERS = [
  "email",
  "employee_identifier",
  "first_name",
  "location_code",
  "role_code",
  "expected_rollup_group",
  "is_emt_expected",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseBool(v: string): boolean | { error: string } {
  const x = v.toLowerCase();
  if (["", "false", "no", "0"].includes(x)) return false;
  if (["true", "yes", "1"].includes(x)) return true;
  return { error: `Invalid boolean "${v}"` };
}

export interface ValidatedRecipients {
  valid: RecipientRow[];
  errors: RowError[];
  unknownHeaders: string[];
}

export function parseAndValidateRecipientsCsv(
  text: string,
  knownLocationCodes?: Set<string>,
  knownRoleCodes?: Set<string>,
  knownRollupGroups?: Set<string>
): ValidatedRecipients {
  const { headers, rows } = parseCSV(text);
  const errors: RowError[] = [];

  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length) {
    errors.push({
      row: 0,
      message: `Missing required column(s): ${missing.join(", ")}`,
    });
    return { valid: [], errors, unknownHeaders: [] };
  }

  const unknownHeaders = headers.filter((h) => !KNOWN_HEADERS.includes(h));

  const seenEmails = new Set<string>();
  const seenIdentifiers = new Set<string>();
  const valid: RecipientRow[] = [];

  rows.forEach((raw, idx) => {
    const rowNum = idx + 1;
    const email = (raw.email || "").toLowerCase();
    const empId = raw.employee_identifier || "";

    if (!email) {
      errors.push({ row: rowNum, field: "email", message: "Email is required" });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      errors.push({ row: rowNum, field: "email", message: "Invalid email format" });
      return;
    }
    if (!empId) {
      errors.push({
        row: rowNum,
        field: "employee_identifier",
        message: "employee_identifier is required",
      });
      return;
    }
    if (seenEmails.has(email)) {
      errors.push({
        row: rowNum,
        field: "email",
        message: "Duplicate email within file",
      });
      return;
    }
    if (seenIdentifiers.has(empId)) {
      errors.push({
        row: rowNum,
        field: "employee_identifier",
        message: "Duplicate employee_identifier within file",
      });
      return;
    }

    if (
      raw.location_code &&
      knownLocationCodes &&
      knownLocationCodes.size > 0 &&
      !knownLocationCodes.has(raw.location_code)
    ) {
      errors.push({
        row: rowNum,
        field: "location_code",
        message: `Unknown location_code "${raw.location_code}"`,
      });
      return;
    }
    if (
      raw.role_code &&
      knownRoleCodes &&
      knownRoleCodes.size > 0 &&
      !knownRoleCodes.has(raw.role_code)
    ) {
      errors.push({
        row: rowNum,
        field: "role_code",
        message: `Unknown role_code "${raw.role_code}"`,
      });
      return;
    }
    if (
      raw.expected_rollup_group &&
      knownRollupGroups &&
      knownRollupGroups.size > 0 &&
      !knownRollupGroups.has(raw.expected_rollup_group)
    ) {
      errors.push({
        row: rowNum,
        field: "expected_rollup_group",
        message: `Unknown expected_rollup_group "${raw.expected_rollup_group}"`,
      });
      return;
    }

    let isEmtExpected: boolean | undefined;
    if (raw.is_emt_expected !== undefined && raw.is_emt_expected !== "") {
      const parsed = parseBool(raw.is_emt_expected);
      if (typeof parsed !== "boolean") {
        errors.push({
          row: rowNum,
          field: "is_emt_expected",
          message: parsed.error,
        });
        return;
      }
      isEmtExpected = parsed;
    }

    seenEmails.add(email);
    seenIdentifiers.add(empId);

    valid.push({
      email,
      employee_identifier: empId,
      first_name: raw.first_name || undefined,
      location_code: raw.location_code || undefined,
      role_code: raw.role_code || undefined,
      expected_rollup_group: raw.expected_rollup_group || undefined,
      is_emt_expected: isEmtExpected,
    });
  });

  return { valid, errors, unknownHeaders };
}

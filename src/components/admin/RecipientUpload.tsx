"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button, Card, Helper, SectionHeader } from "@/components/ui/primitives";

interface Props {
  campaignId: string;
}

interface RowError {
  row: number;
  field?: string;
  message: string;
}

interface UploadOk {
  created: number;
  updated: number;
  skipped: number;
  unknownHeaders: string[];
}

export function RecipientUpload({ campaignId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [onConflict, setOnConflict] = useState<"skip" | "merge">("merge");
  const [errors, setErrors] = useState<RowError[] | null>(null);
  const [unknownHeaders, setUnknownHeaders] = useState<string[]>([]);
  const [success, setSuccess] = useState<UploadOk | null>(null);

  function onFile(file: File) {
    setFileName(file.name);
    file.text().then((t) => setCsvText(t));
  }

  function submit() {
    setErrors(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/admin/campaigns/${campaignId}/distribution-upload`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csv: csvText, onConflict }),
        }
      );
      const body = await res.json();
      if (!res.ok) {
        setErrors(body.errors ?? [{ row: 0, message: body.error ?? "Upload failed" }]);
        setUnknownHeaders(body.unknownHeaders ?? []);
        return;
      }
      setSuccess(body);
      setCsvText("");
      setFileName(null);
      router.refresh();
    });
  }

  return (
    <Card className="space-y-4">
      <SectionHeader
        title="Upload recipients"
        description="CSV with columns email, employee_identifier, first_name, location_code, role_code, expected_rollup_group, is_emt_expected (PRD §8.17.2). Tokens are issued separately via Send invitations."
      />

      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#C7D0CA] bg-[#F7F9F7] px-4 py-6 text-sm text-[#374151] hover:bg-[#DCE8E4] focus-within:ring-2 focus-within:ring-[#2F5D54]">
        <Upload className="h-4 w-4" />
        <span className="font-medium">{fileName ?? "Choose CSV file…"}</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <span className="t-helper">On duplicate (by email or employee_identifier):</span>
        <label className="flex items-center gap-1.5 text-sm text-[#1C1C1C]">
          <input
            type="radio"
            checked={onConflict === "merge"}
            onChange={() => setOnConflict("merge")}
            className="h-4 w-4 text-[#244943] focus:ring-[#2F5D54]"
          />
          Merge / update
        </label>
        <label className="flex items-center gap-1.5 text-sm text-[#1C1C1C]">
          <input
            type="radio"
            checked={onConflict === "skip"}
            onChange={() => setOnConflict("skip")}
            className="h-4 w-4 text-[#244943] focus:ring-[#2F5D54]"
          />
          Skip
        </label>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="primary"
          disabled={!csvText || isPending}
          onClick={submit}
        >
          {isPending ? "Uploading…" : "Upload"}
        </Button>
      </div>

      {success && (
        <div className="flex items-start gap-2 rounded-xl bg-[#DCE8E4] p-3 text-sm text-[#1D3931]">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Upload complete</p>
            <Helper>
              {success.created} created, {success.updated} updated, {success.skipped} skipped.
            </Helper>
            {success.unknownHeaders.length > 0 && (
              <Helper>
                Unknown columns ignored: {success.unknownHeaders.join(", ")}
              </Helper>
            )}
          </div>
        </div>
      )}

      {errors && errors.length > 0 && (
        <div className="rounded-xl bg-[#FEE2E2] p-3 text-sm text-[#991B1B] space-y-1">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" />
            Validation failed — nothing was saved
          </div>
          {unknownHeaders.length > 0 && (
            <p className="text-xs">Unknown columns: {unknownHeaders.join(", ")}</p>
          )}
          <ul className="ml-4 list-disc text-xs space-y-0.5 max-h-48 overflow-y-auto">
            {errors.slice(0, 50).map((e, i) => (
              <li key={i}>
                Row {e.row}
                {e.field && ` (${e.field})`}: {e.message}
              </li>
            ))}
            {errors.length > 50 && <li>… and {errors.length - 50} more</li>}
          </ul>
        </div>
      )}
    </Card>
  );
}

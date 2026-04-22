"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { Button, Helper, SectionHeader } from "@/components/ui/primitives";

interface ImportResult {
  ok: boolean;
  created?: Record<string, number>;
  skipped?: Record<string, number>;
  warnings?: string[];
  error?: string;
}

export function PlatformTransferCard() {
  const router = useRouter();
  const [pendingExport, startExport] = useTransition();
  const [pendingImport, startImport] = useTransition();
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function downloadExport() {
    startExport(async () => {
      const res = await fetch("/api/admin/platform-export");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? `Export failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const cd = res.headers.get("Content-Disposition");
      const m = cd?.match(/filename="?([^";]+)"?/);
      a.href = url;
      a.download = m?.[1] ?? "belonging-index-export.json";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function onFileChosen(file: File) {
    setImportResult(null);
    startImport(async () => {
      const text = await file.text();
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        setImportResult({ ok: false, error: "The file is not valid JSON." });
        return;
      }
      const res = await fetch("/api/admin/platform-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as ImportResult;
      if (!res.ok) {
        setImportResult({
          ok: false,
          error: body.error ?? `Import failed (${res.status})`,
        });
        return;
      }
      setImportResult(body);
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-[#D9DFDA] bg-white p-6">
      <SectionHeader
        title="Data migration"
        description="Move every campaign, schema, recipient, and response between deployments as a single JSON file. Useful for seeding a new environment from your local dev DB."
      />

      <div className="space-y-5">
        {/* Export */}
        <div className="rounded-2xl border border-[#E8ECE8] p-4">
          <p className="t-label">Export all platform data</p>
          <Helper className="mt-0.5">
            Creates a JSON file containing every client, campaign, schema,
            question, recipient, response, and response item on this deployment.
            Admin users and audit logs are excluded. Run this on the source
            deployment first.
          </Helper>
          <div className="mt-3">
            <Button
              type="button"
              variant="primary"
              onClick={downloadExport}
              disabled={pendingExport}
              leftIcon={<Download className="h-3.5 w-3.5" />}
            >
              {pendingExport ? "Preparing…" : "Download export"}
            </Button>
          </div>
        </div>

        {/* Import */}
        <div className="rounded-2xl border border-[#E8ECE8] p-4">
          <p className="t-label">Import a previous export</p>
          <Helper className="mt-0.5">
            Upload a file created by the export button above. Rows whose IDs
            already exist on this deployment are skipped — re-importing is
            safe. To <em>overwrite</em> existing data, delete it first from
            this deployment, then import.
          </Helper>
          <div className="mt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFileChosen(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={pendingImport}
              leftIcon={<Upload className="h-3.5 w-3.5" />}
            >
              {pendingImport ? "Importing…" : "Choose JSON file…"}
            </Button>
          </div>

          {importResult && (
            <div
              className={[
                "mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm",
                importResult.ok
                  ? "bg-[#DCE8E4] text-[#1D3931]"
                  : "bg-[#FEE2E2] text-[#991B1B]",
              ].join(" ")}
            >
              {importResult.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div className="min-w-0">
                {importResult.ok ? (
                  <>
                    <p className="font-medium">Import complete</p>
                    {importResult.created && (
                      <p className="mt-0.5 text-xs">
                        Created:{" "}
                        {Object.entries(importResult.created)
                          .filter(([, n]) => n > 0)
                          .map(([k, n]) => `${n} ${k}`)
                          .join(", ") || "nothing new (all rows already existed)"}
                      </p>
                    )}
                    {importResult.skipped && (
                      <p className="mt-0.5 text-xs opacity-80">
                        Skipped duplicates:{" "}
                        {Object.entries(importResult.skipped)
                          .filter(([, n]) => n > 0)
                          .map(([k, n]) => `${n} ${k}`)
                          .join(", ") || "none"}
                      </p>
                    )}
                    {importResult.warnings && importResult.warnings.length > 0 && (
                      <ul className="mt-1.5 list-disc pl-4 text-xs">
                        {importResult.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <p className="font-medium">{importResult.error}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useRef, useState, type DragEvent } from "react";
import { FileSpreadsheet, Loader2, Upload, X } from "lucide-react";

import { Button, Card, CardContent, Select } from "@/components/ui";
import { DISPLAY_CURRENCIES } from "@/lib/currency";
import type { MigrationLimits } from "../types";

/**
 * Step 1 — choose files.
 *
 * The limits are stated up front rather than discovered on rejection, and the
 * drop area is a real labelled control so keyboard and screen-reader users get
 * the same affordance as a pointer.
 */
export default function UploadStep({
  limits,
  busy,
  onUpload,
}: {
  limits: MigrationLimits;
  busy: boolean;
  onUpload: (files: File[], defaultCurrency: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [defaultCurrency, setDefaultCurrency] = useState("");

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    setFiles((current) => {
      const merged = [...current];
      for (const file of Array.from(incoming)) {
        if (!merged.some((existing) => existing.name === file.name && existing.size === file.size)) {
          merged.push(file);
        }
      }
      return merged.slice(0, limits.maxFiles);
    });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  }

  return (
    <Card>
      <CardContent className="space-y-6">
        <div
          data-guide-target="migration-upload"
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={[
            "rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-border bg-muted/30",
          ].join(" ")}
        >
          <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm">
            <Upload className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="text-sm font-bold text-foreground">Upload the files you already use</h2>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            CSV or Excel exports of your clients, projects, invoices, and expenses. Add them in any order — Rive works out
            what each one is.
          </p>

          <input
            ref={inputRef}
            id="migration-files"
            type="file"
            multiple
            accept=".csv,.tsv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            Choose files
          </Button>

          <p className="mt-4 text-[0.7rem] leading-5 text-muted-foreground">
            Up to {limits.maxFiles} files, {limits.maxFileMb} MB each, {limits.maxRows.toLocaleString()} rows in total.
            Every sheet in a workbook is read. Rive never shortens a file — if it is too big you will be told.
          </p>
        </div>

        {files.length ? (
          <ul className="space-y-2" aria-label="Files to import">
            {files.map((file) => (
              <li
                key={`${file.name}-${file.size}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate text-sm font-medium text-foreground">{file.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${file.name}`}
                  disabled={busy}
                  onClick={() => setFiles((current) => current.filter((item) => item !== file))}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xs">
            <label htmlFor="migration-currency" className="text-xs font-semibold text-foreground">
              Currency for amounts that do not state one
            </label>
            <Select
              id="migration-currency"
              className="mt-1.5"
              value={defaultCurrency}
              onChange={(event) => setDefaultCurrency(event.target.value)}
              disabled={busy}
            >
              <option value="">Use my workspace currency</option>
              {DISPLAY_CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} — {currency.label}
                </option>
              ))}
            </Select>
            <p className="mt-1.5 text-[0.7rem] leading-4 text-muted-foreground">
              Rive never converts historical amounts. A row that states its own currency always keeps it.
            </p>
          </div>

          <Button
            type="button"
            disabled={!files.length || busy}
            onClick={() => onUpload(files, defaultCurrency)}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {busy ? "Reading files" : "Analyze files"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

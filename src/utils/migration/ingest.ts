import "server-only";

import { createHash } from "node:crypto";

import { MIGRATION_LIMITS } from "@/lib/migration/config";
import { parseCsvBytes } from "@/lib/migration/parse/csv";
import { parseWorkbook } from "@/lib/migration/parse/workbook";
import type { SourceTable } from "@/lib/migration/parse/table";
import { maxUploadBytes } from "@/utils/migration/config";

/**
 * Upload ingestion: bytes → tables, with provenance and hard limits.
 *
 * Everything here is a rejection boundary. Files are validated by extension,
 * declared type, and actual parse result; oversized migrations are refused with
 * an explicit message rather than truncated, because a silently shortened
 * import is the worst possible outcome for trust.
 */

const ALLOWED_EXTENSIONS = new Set(["csv", "tsv", "txt", "xlsx"]);

/**
 * MIME types browsers actually send for these files. The list is generous
 * because Windows reports XLSX inconsistently, but the extension check and the
 * parser are the real gates — a file that does not parse is rejected whatever
 * it claims to be.
 */
const ALLOWED_MIME_PREFIXES = [
  "text/csv",
  "text/plain",
  "text/tab-separated-values",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
  "",
];

export type IngestedSource = {
  /** `<checksum>:<sheet>` — stable across re-uploads of identical bytes. */
  sourceId: string;
  table: SourceTable;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
};

export type IngestResult =
  | { ok: true; sources: IngestedSource[]; warnings: string[] }
  | { ok: false; message: string };

function extensionOf(name: string): string {
  return name.toLowerCase().split(".").pop() || "";
}

/**
 * Guard against XLSX archive bombs.
 *
 * A workbook is a ZIP; a small file can expand enormously. The row and sheet
 * caps below bound the damage after parsing, and the byte cap bounds it before.
 */
function looksLikeWorkbook(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export async function ingestUploads(files: File[]): Promise<IngestResult> {
  if (!files.length) return { ok: false, message: "Choose at least one CSV or Excel file." };
  if (files.length > MIGRATION_LIMITS.maxFiles) {
    return { ok: false, message: `You can bring up to ${MIGRATION_LIMITS.maxFiles} files at a time.` };
  }

  const fileByteCap = Math.min(MIGRATION_LIMITS.maxFileBytes, maxUploadBytes());
  const sources: IngestedSource[] = [];
  const warnings: string[] = [];
  const seenSourceIds = new Set<string>();
  let totalBytes = 0;
  let totalRows = 0;

  for (const file of files) {
    const extension = extensionOf(file.name);
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return { ok: false, message: `${file.name} is not a CSV or Excel file.` };
    }
    const mimeType = file.type || "";
    if (!ALLOWED_MIME_PREFIXES.some((prefix) => mimeType === prefix || mimeType.startsWith(prefix))) {
      return { ok: false, message: `${file.name} is not a file type Rive can read.` };
    }
    if (file.size > fileByteCap) {
      return {
        ok: false,
        message: `${file.name} is larger than ${Math.round(fileByteCap / (1024 * 1024))} MB. Split it into smaller exports.`,
      };
    }

    totalBytes += file.size;
    if (totalBytes > MIGRATION_LIMITS.maxTotalBytes) {
      return {
        ok: false,
        message: `These files add up to more than ${Math.round(MIGRATION_LIMITS.maxTotalBytes / (1024 * 1024))} MB. Bring them across in two migrations.`,
      };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const isWorkbook = extension === "xlsx" || looksLikeWorkbook(bytes);

    let tables: SourceTable[] = [];
    if (isWorkbook) {
      try {
        const parsed = await parseWorkbook(bytes, file.name);
        tables = parsed.tables;
        for (const sheet of parsed.skippedSheets) {
          warnings.push(`Rive could not read the "${sheet}" sheet in ${file.name}, so it was left out.`);
        }
      } catch {
        return { ok: false, message: `${file.name} could not be opened as a spreadsheet.` };
      }
    } else {
      try {
        tables = [parseCsvBytes(bytes, { fileName: file.name })];
      } catch {
        return { ok: false, message: `${file.name} could not be read as a CSV file.` };
      }
    }

    for (const table of tables) {
      if (table.headers.length > MIGRATION_LIMITS.maxColumns) {
        return {
          ok: false,
          message: `${describeTable(table)} has more than ${MIGRATION_LIMITS.maxColumns} columns.`,
        };
      }
      if (table.rows.length > MIGRATION_LIMITS.maxRowsPerSource) {
        return {
          ok: false,
          message: `${describeTable(table)} has ${table.rows.length.toLocaleString()} rows. Rive imports up to ${MIGRATION_LIMITS.maxRowsPerSource.toLocaleString()} at a time — split it and run two migrations rather than losing rows.`,
        };
      }

      totalRows += table.rows.length;
      if (totalRows > MIGRATION_LIMITS.maxTotalRows) {
        return {
          ok: false,
          message: `These files hold more than ${MIGRATION_LIMITS.maxTotalRows.toLocaleString()} rows in total. Bring them across in two migrations so nothing is dropped.`,
        };
      }

      // Identical bytes plus identical sheet is the same source. This is what
      // makes uploading the same file twice harmless rather than duplicating.
      const sourceId = `${checksum.slice(0, 16)}:${table.sheetName || "-"}`;
      if (seenSourceIds.has(sourceId)) {
        warnings.push(`${describeTable(table)} was uploaded twice, so Rive is using it once.`);
        continue;
      }
      seenSourceIds.add(sourceId);

      sources.push({
        sourceId,
        table,
        fileName: file.name.slice(0, 180),
        mimeType: mimeType || (isWorkbook ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv"),
        sizeBytes: file.size,
        checksum,
      });
    }
  }

  if (!sources.length) {
    return { ok: false, message: "None of these files contained a readable table." };
  }
  return { ok: true, sources, warnings };
}

function describeTable(table: SourceTable): string {
  return table.sheetName ? `The "${table.sheetName}" sheet in ${table.fileName}` : table.fileName;
}

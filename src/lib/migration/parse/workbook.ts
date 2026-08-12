/**
 * Workbook (XLSX) ingestion.
 *
 * Every sheet becomes its own table, because a single workbook routinely holds
 * "Clients", "Projects" and "Invoices" side by side and the user should not
 * have to split it up by hand first.
 */

import {
  buildTable,
  type SourceTable,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./table.ts";
import {
  MIGRATION_LIMITS,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "../config.ts";

/**
 * Render a workbook cell as text without corrupting it.
 *
 * Dates are the dangerous case. The library hands back a `Date` built from the
 * sheet's serial number, which carries no timezone of its own. Formatting it
 * from UTC parts keeps "3 April 2026" as `2026-04-03`; using `toISOString()` in
 * a negative-offset environment, or `toLocaleDateString`, can shift it a day.
 */
export function cellToText(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) {
    const hasTime = cell.getUTCHours() || cell.getUTCMinutes() || cell.getUTCSeconds();
    const year = cell.getUTCFullYear();
    const month = String(cell.getUTCMonth() + 1).padStart(2, "0");
    const day = String(cell.getUTCDate()).padStart(2, "0");
    if (!hasTime) return `${year}-${month}-${day}`;
    const hours = String(cell.getUTCHours()).padStart(2, "0");
    const minutes = String(cell.getUTCMinutes()).padStart(2, "0");
    const seconds = String(cell.getUTCSeconds()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
  }
  if (typeof cell === "boolean") return cell ? "true" : "false";
  if (typeof cell === "number") {
    // Avoid exponential notation on large identifiers such as tax numbers.
    return Number.isInteger(cell) ? String(cell) : String(cell);
  }
  return String(cell);
}

export type WorkbookReader = {
  readSheetNames: (input: Buffer) => Promise<string[]>;
  readSheet: (input: Buffer, sheet: string) => Promise<unknown[][]>;
};

/**
 * Default reader backed by `read-excel-file`, which is already a dependency of
 * the existing importer. Injected rather than imported directly so the parsing
 * logic above stays unit-testable without a real workbook fixture.
 */
export const defaultWorkbookReader: WorkbookReader = {
  async readSheetNames(input) {
    const { readSheetNames } = await import("read-excel-file/node");
    return readSheetNames(input);
  },
  async readSheet(input, sheet) {
    const { default: readXlsxFile } = await import("read-excel-file/node");
    return (await readXlsxFile(input, { sheet })) as unknown[][];
  },
};

export type WorkbookParseResult = {
  tables: SourceTable[];
  skippedSheets: string[];
};

/**
 * Parse every sheet in a workbook into tables.
 *
 * A sheet that is empty or headers-only still produces a table: the pipeline
 * reports it as an empty source rather than pretending it was never uploaded.
 */
export async function parseWorkbook(
  bytes: Uint8Array,
  fileName: string,
  reader: WorkbookReader = defaultWorkbookReader,
): Promise<WorkbookParseResult> {
  const buffer = Buffer.from(bytes);
  const sheetNames = await reader.readSheetNames(buffer);
  const tables: SourceTable[] = [];
  const skippedSheets: string[] = [];

  for (const sheetName of sheetNames) {
    if (tables.length >= MIGRATION_LIMITS.maxSheetsPerWorkbook) {
      skippedSheets.push(sheetName);
      continue;
    }
    let grid: string[][] = [];
    try {
      const raw = await reader.readSheet(buffer, sheetName);
      grid = raw.map((row) => (Array.isArray(row) ? row.map(cellToText) : []));
    } catch {
      // A single unreadable sheet must not fail the whole migration; it is
      // reported to the user as a skipped source instead.
      skippedSheets.push(sheetName);
      continue;
    }
    tables.push(
      buildTable(grid, { fileName, sheetName, encoding: "xlsx", delimiter: null }),
    );
  }

  return { tables, skippedSheets };
}

/**
 * Shared shape for anything parsed out of an upload, whether it came from a
 * CSV file or one sheet of a workbook. Downstream stages never learn which.
 */

export type SourceTable = {
  fileName: string;
  /** Null for CSV; the sheet name for workbooks. */
  sheetName: string | null;
  /** Original header text, untrimmed of meaning. Used for display. */
  headers: string[];
  /** Data rows, aligned to `headers`. Short rows are padded with "". */
  rows: string[][];
  /** Zero-based index of the row the headers were taken from. */
  headerRowIndex: number;
  /** Rows that were entirely blank and skipped. Reported, never hidden. */
  blankRowCount: number;
  encoding: string;
  delimiter: string | null;
};

export type ParseWarning = { code: string; message: string };

export type ParseResult = {
  tables: SourceTable[];
  warnings: ParseWarning[];
};

/**
 * Normalize a header for matching. The original is always kept alongside so a
 * user still sees "Customer E-mail", not "customer_e_mail".
 */
export function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Give unnamed or duplicated columns stable, distinct identities. Real exports
 * routinely contain blank headers or two columns both called "Amount"; silently
 * collapsing them would drop data.
 */
export function dedupeHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((header, index) => {
    const base = header.trim() || `Column ${index + 1}`;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

/** True when every cell in the row is empty or whitespace. */
export function isBlankRow(row: readonly string[]): boolean {
  return row.every((cell) => !cell || !cell.trim());
}

/**
 * Choose the header row.
 *
 * Exports from accounting tools frequently open with a title line or a blank
 * spacer before the real header. We scan a small window for the first row that
 * looks like headers: mostly non-empty, mostly distinct, mostly non-numeric.
 */
export function detectHeaderRow(rows: string[][], scanLimit = 8): number {
  let best = -1;
  let bestScore = 0;
  const limit = Math.min(rows.length, scanLimit);
  for (let index = 0; index < limit; index += 1) {
    const row = rows[index];
    if (!row || isBlankRow(row)) continue;
    const cells = row.map((cell) => (cell || "").trim());
    const filled = cells.filter(Boolean);
    if (filled.length < 2) continue;
    const distinct = new Set(filled.map((cell) => cell.toLowerCase())).size;
    const numeric = filled.filter((cell) => /^-?[\d.,()$₹€£\s]+$/.test(cell)).length;
    const fillRatio = filled.length / cells.length;
    const distinctRatio = distinct / filled.length;
    const textRatio = 1 - numeric / filled.length;
    // A header row is dense, distinct, and made of words rather than figures.
    const score = fillRatio * 0.35 + distinctRatio * 0.35 + textRatio * 0.3;
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
    // A confident first hit wins; later rows are data until proven otherwise.
    if (index === 0 && score >= 0.85) return 0;
  }
  return best === -1 ? 0 : best;
}

/**
 * Turn a raw grid into a table: pick headers, pad ragged rows, drop blanks.
 * Never truncates — row limits are a caller policy, enforced with an error.
 */
export function buildTable(
  grid: string[][],
  meta: { fileName: string; sheetName: string | null; encoding: string; delimiter: string | null },
): SourceTable {
  if (!grid.length) {
    return { ...meta, headers: [], rows: [], headerRowIndex: 0, blankRowCount: 0 };
  }
  const headerRowIndex = detectHeaderRow(grid);
  const headers = dedupeHeaders(grid[headerRowIndex] || []);
  const width = headers.length;
  const rows: string[][] = [];
  let blankRowCount = 0;
  for (let index = headerRowIndex + 1; index < grid.length; index += 1) {
    const row = grid[index] || [];
    if (isBlankRow(row)) {
      blankRowCount += 1;
      continue;
    }
    const padded: string[] = new Array(width);
    for (let column = 0; column < width; column += 1) padded[column] = (row[column] ?? "").trim();
    rows.push(padded);
  }
  return { ...meta, headers, rows, headerRowIndex, blankRowCount };
}

/** Convert a positional row into a header-keyed record for the IR's `raw`. */
export function rowToRecord(headers: readonly string[], row: readonly string[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (let index = 0; index < headers.length; index += 1) record[headers[index]] = row[index] ?? "";
  return record;
}

/**
 * The source row number a human would see in Excel: 1-based, counting the
 * header. Error messages quote this, so it has to match the user's spreadsheet.
 */
export function displayRowNumber(table: SourceTable, rowIndex: number): number {
  return table.headerRowIndex + rowIndex + 2;
}

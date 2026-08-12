/**
 * RFC 4180-shaped delimited-text parser.
 *
 * Written by hand rather than pulled from a dependency because the engine needs
 * three things off-the-shelf parsers do not agree on: it must never truncate,
 * it must sniff the delimiter (European exports are semicolon-separated), and
 * it must keep a blank trailing field distinguishable from a missing one.
 */

import {
  buildTable,
  type SourceTable,
  // @ts-expect-error The standalone domain test runner needs the explicit TypeScript extension.
} from "./table.ts";

const CANDIDATE_DELIMITERS = [",", ";", "\t", "|"] as const;

export type CsvParseOptions = {
  fileName: string;
  delimiter?: string;
};

/**
 * Decode bytes, honouring a byte-order mark when present.
 *
 * Exports from Excel on Windows are frequently UTF-16LE with a BOM, which
 * decodes to mojibake if assumed to be UTF-8. We only trust an explicit BOM —
 * guessing an encoding from content would be worse than being wrong loudly.
 */
export function decodeText(bytes: Uint8Array): { text: string; encoding: string } {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder("utf-16le").decode(bytes.subarray(2)), encoding: "utf-16le" };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder("utf-16be").decode(bytes.subarray(2)), encoding: "utf-16be" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder("utf-8").decode(bytes.subarray(3)), encoding: "utf-8-bom" };
  }
  return { text: new TextDecoder("utf-8").decode(bytes), encoding: "utf-8" };
}

/**
 * Pick the delimiter that yields the most consistent column count across the
 * first few lines. Consistency beats raw frequency: prose containing commas
 * would otherwise beat the real separator.
 */
export function sniffDelimiter(text: string): string {
  const sample = text.slice(0, 64 * 1024);
  let best = ",";
  let bestScore = -1;
  for (const delimiter of CANDIDATE_DELIMITERS) {
    const grid = parseDelimited(sample, delimiter).slice(0, 20).filter((row) => row.length > 0);
    if (grid.length === 0) continue;
    const widths = grid.map((row) => row.length);
    const maxWidth = Math.max(...widths);
    if (maxWidth < 2) continue;
    const modal = widths.filter((width) => width === maxWidth).length / widths.length;
    // Favour many columns, but only when the row width actually holds steady.
    const score = modal * 2 + Math.min(maxWidth, 24) / 24;
    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }
  return best;
}

/**
 * Core scanner. Handles quoted fields, escaped quotes (`""`), embedded
 * newlines and delimiters, and CRLF/CR/LF line endings.
 */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const grid: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let sawContent = false;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    grid.push(row);
    row = [];
    sawContent = false;
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"' && field.length === 0) {
      quoted = true;
      sawContent = true;
      continue;
    }
    if (character === delimiter) {
      endField();
      sawContent = true;
      continue;
    }
    if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      // A blank line between records is skipped; a blank *field* is preserved.
      if (sawContent || field.length > 0 || row.length > 0) endRow();
      continue;
    }
    field += character;
    if (character.trim()) sawContent = true;
  }
  if (field.length > 0 || row.length > 0 || sawContent) endRow();
  return grid;
}

/** Parse decoded CSV text into a single table. */
export function parseCsvText(text: string, options: CsvParseOptions): SourceTable {
  const source = text.replace(/^﻿/, "");
  const delimiter = options.delimiter || sniffDelimiter(source);
  const grid = parseDelimited(source, delimiter);
  return buildTable(grid, {
    fileName: options.fileName,
    sheetName: null,
    encoding: "utf-8",
    delimiter,
  });
}

/** Parse raw CSV bytes, detecting encoding from the byte-order mark. */
export function parseCsvBytes(bytes: Uint8Array, options: CsvParseOptions): SourceTable {
  const { text, encoding } = decodeText(bytes);
  const table = parseCsvText(text, options);
  return { ...table, encoding };
}

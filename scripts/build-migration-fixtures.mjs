/**
 * Generate the XLSX fixtures used by the migration tests.
 *
 * A real workbook is written rather than a stub so the parser is exercised
 * against the same file format a user would upload, including multiple sheets
 * and native date cells. Everything produced here is synthetic — no fixture in
 * this repository contains real customer data.
 *
 * Run with: node scripts/build-migration-fixtures.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "tests", "fixtures", "migration");

// ---------------------------------------------------------------- zip writer

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Write a ZIP archive with stored (uncompressed) entries.
 *
 * XLSX readers accept stored entries, and avoiding compression keeps this
 * script dependency-free.
 */
function buildZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const { name, content } of entries) {
    const nameBytes = Buffer.from(name, "utf8");
    const data = Buffer.from(content, "utf8");
    const checksum = crc32(data);

    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(0, 10); // time
    local.writeUInt16LE(0x2821, 12); // date: 2020-01-01, fixed for reproducibility
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    nameBytes.copy(local, 30);
    locals.push(local, data);

    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x2821, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBytes.copy(central, 46);
    centrals.push(central);

    offset += local.length + data.length;
  }

  const centralBuffer = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralBuffer, end]);
}

// --------------------------------------------------------------- xlsx writer

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnName(index) {
  let name = "";
  let remaining = index;
  while (remaining >= 0) {
    name = String.fromCharCode(65 + (remaining % 26)) + name;
    remaining = Math.floor(remaining / 26) - 1;
  }
  return name;
}

/** Inline strings keep the writer simple and are valid OOXML. */
function sheetXml(rows) {
  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          if (value === null || value === undefined || value === "") return "";
          const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
          if (typeof value === "number") return `<c r="${reference}"><v>${value}</v></c>`;
          return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

function buildWorkbook(sheets) {
  const sheetEntries = sheets.map((sheet, index) => ({
    name: `xl/worksheets/sheet${index + 1}.xml`,
    content: sheetXml(sheet.rows),
  }));

  const workbookSheets = sheets
    .map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join("");

  const workbookRels = sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join("");

  const overrides = sheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("");

  return buildZip([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}</Relationships>`,
    },
    ...sheetEntries,
  ]);
}

// ------------------------------------------------------------------ fixtures

mkdirSync(OUTPUT_DIR, { recursive: true });

writeFileSync(
  join(OUTPUT_DIR, "multi-sheet.xlsx"),
  buildWorkbook([
    {
      name: "Clients",
      rows: [
        ["client_name", "email", "phone", "company"],
        ["Acme Technologies Pvt Ltd", "contact@acme.example", "+91 98765 43210", "Acme Technologies"],
        ["Globex Corporation", "hello@globex.example", "+91 91234 56780", "Globex"],
      ],
    },
    {
      name: "Projects",
      rows: [
        ["project_name", "client", "deadline", "budget", "currency", "status"],
        ["Website redesign", "Acme Technologies Pvt Ltd", "2026-06-01", 250000, "INR", "in progress"],
        ["Brand refresh", "Globex Corporation", "2026-07-15", 120000, "INR", "on hold"],
      ],
    },
    {
      name: "Invoices",
      rows: [
        ["invoice_no", "customer", "total", "currency", "issue_date", "due_date", "status"],
        ["INV-001", "Acme Technologies Pvt Ltd", 75000, "INR", "2026-04-03", "2026-05-03", "paid"],
        ["INV-002", "Globex Corporation", 42000, "INR", "2026-04-10", "2026-05-10", "settled"],
      ],
    },
    {
      name: "Expenses",
      rows: [
        ["merchant", "amount", "currency", "expense_date", "category"],
        ["Figma", 1500, "INR", "2026-04-02", "software"],
        ["Adobe", 4200, "INR", "2026-04-05", "software"],
      ],
    },
  ]),
);

writeFileSync(
  join(OUTPUT_DIR, "mixed-entities.xlsx"),
  buildWorkbook([
    {
      // A sheet whose columns argue for two different record types at once.
      name: "Ledger",
      rows: [
        ["name", "email", "amount", "date"],
        ["Acme Technologies Pvt Ltd", "contact@acme.example", 75000, "2026-04-03"],
        ["Globex Corporation", "hello@globex.example", 42000, "2026-04-10"],
      ],
    },
    {
      // A title row above the real header, as accounting exports produce.
      name: "Sheet2",
      rows: [
        ["Acme Books export — generated 2026-04-30"],
        [],
        ["invoice_no", "customer", "total", "currency", "issue_date"],
        ["INV-900", "Acme Technologies Pvt Ltd", 15000, "INR", "2026-04-20"],
      ],
    },
  ]),
);

console.log(`Wrote XLSX fixtures to ${OUTPUT_DIR}`);

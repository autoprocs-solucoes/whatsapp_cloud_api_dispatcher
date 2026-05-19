import "server-only";

import ExcelJS from "exceljs";
import Papa from "papaparse";

export type ParsedSpreadsheet = {
  headers: string[];
  rows: Record<string, string>[];
};

const MAX_ROWS = 50_000;

const XLSX_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
]);

const CSV_MIMES = new Set(["text/csv", "application/csv", "text/plain"]);

export class SpreadsheetParseError extends Error {}

function inferKind(filename: string, mime: string): "xlsx" | "csv" {
  if (filename.toLowerCase().endsWith(".xlsx")) return "xlsx";
  if (filename.toLowerCase().endsWith(".csv")) return "csv";
  if (XLSX_MIMES.has(mime)) return "xlsx";
  if (CSV_MIMES.has(mime)) return "csv";
  throw new SpreadsheetParseError(
    `Formato não suportado. Envie .xlsx ou .csv (recebido: ${mime || "desconhecido"}).`,
  );
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null) {
    const v = value as { text?: unknown; result?: unknown; richText?: Array<{ text: string }> };
    if (typeof v.text === "string") return v.text.trim();
    if (typeof v.result === "string" || typeof v.result === "number") return String(v.result);
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("").trim();
  }
  return String(value).trim();
}

async function parseXlsx(buffer: Buffer): Promise<ParsedSpreadsheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new SpreadsheetParseError("Planilha sem abas.");

  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    headers[col - 1] = cellToString(cell.value);
  });
  const finalHeaders = headers.map((h, i) => h || `Coluna ${i + 1}`);

  const rows: Record<string, string>[] = [];
  for (let r = 2; r <= ws.rowCount && rows.length < MAX_ROWS; r++) {
    const row = ws.getRow(r);
    const obj: Record<string, string> = {};
    let hasAny = false;
    finalHeaders.forEach((h, i) => {
      const v = cellToString(row.getCell(i + 1).value);
      obj[h] = v;
      if (v) hasAny = true;
    });
    if (hasAny) rows.push(obj);
  }

  return { headers: finalHeaders, rows };
}

function parseCsv(text: string): ParsedSpreadsheet {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
    transform: (v) => (typeof v === "string" ? v.trim() : v),
  });

  if (result.errors.length > 0 && result.data.length === 0) {
    const first = result.errors[0];
    throw new SpreadsheetParseError(`Erro lendo CSV: ${first?.message ?? "formato inválido"}`);
  }

  const headers = (result.meta.fields ?? []).map((h, i) => h || `Coluna ${i + 1}`);
  const rows = result.data.slice(0, MAX_ROWS);
  return { headers, rows };
}

export async function parseSpreadsheet(
  buffer: Buffer,
  filename: string,
  mime: string,
): Promise<ParsedSpreadsheet> {
  const kind = inferKind(filename, mime);
  if (kind === "xlsx") return parseXlsx(buffer);
  return parseCsv(buffer.toString("utf-8"));
}

// ----------------------------------------------------------------------------
// Auto-mapping: detecta colunas comuns PT-BR
// ----------------------------------------------------------------------------
const PHONE_HEADER_PATTERNS = [
  /^tel(efone)?$/i,
  /^celular$/i,
  /^whats?app$/i,
  /^fone$/i,
  /^numero$/i,
  /tel(efone)?\s*1?$/i,
  /^contato$/i,
];

const NAME_HEADER_PATTERNS = [/^nome$/i, /^name$/i, /^cliente$/i, /nome\s*completo/i];

const EMAIL_HEADER_PATTERNS = [/^e-?mail$/i];

export type AutoMapping = {
  phoneColumn: string | null;
  fullNameColumn: string | null;
  emailColumn: string | null;
};

export function detectAutoMapping(headers: string[]): AutoMapping {
  const find = (patterns: RegExp[]) =>
    headers.find((h) => patterns.some((p) => p.test(h.trim()))) ?? null;

  return {
    phoneColumn: find(PHONE_HEADER_PATTERNS),
    fullNameColumn: find(NAME_HEADER_PATTERNS),
    emailColumn: find(EMAIL_HEADER_PATTERNS),
  };
}

import "server-only";

import ExcelJS from "exceljs";
import JSZip from "jszip";
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

/**
 * Tira os filtros da planilha antes de ler.
 *
 * Planilha salva do Excel com filtro por cor (ou por ícone) carrega nós que o
 * leitor de xlsx não conhece e ele para com "Unexpected xml node". Filtro não
 * tem nada a ver com o valor das células, então a saída é apagar o bloco e ler
 * de novo — a planilha original não é tocada, só a cópia em memória.
 */
async function stripFilters(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);

  for (const name of Object.keys(zip.files)) {
    const isSheetOrTable = /^xl\/(tables\/|worksheets\/sheet)/.test(name) && name.endsWith(".xml");
    if (!isSheetOrTable) continue;

    const file = zip.file(name);
    if (!file) continue;

    const xml = await file.async("string");
    const cleaned = xml
      .replace(/<autoFilter[\s\S]*?<\/autoFilter>/g, "")
      .replace(/<autoFilter[^>]*\/>/g, "");
    if (cleaned !== xml) zip.file(name, cleaned);
  }

  return zip.generateAsync({ type: "nodebuffer" });
}

async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    return wb;
  } catch (e) {
    // Segunda tentativa sem os filtros. Se ainda falhar, aí é outra coisa.
    try {
      const clean = new ExcelJS.Workbook();
      await clean.xlsx.load((await stripFilters(buffer)) as unknown as ArrayBuffer);
      return clean;
    } catch {
      throw new SpreadsheetParseError(
        `Não consegui ler o arquivo .xlsx: ${(e as Error).message}. Salve como CSV e tente de novo.`,
      );
    }
  }
}

async function parseXlsx(buffer: Buffer): Promise<ParsedSpreadsheet> {
  const wb = await loadWorkbook(buffer);
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

const NAME_HEADER_PATTERNS = [
  /^nomes?$/i,
  /^names?$/i,
  /^clientes?$/i,
  /nome\s*completo/i,
  /^nome\s*do\s*(cliente|contato)$/i,
  /^raz(a|ã)o\s*social$/i,
  /^respons(a|á)vel$/i,
];

const EMAIL_HEADER_PATTERNS = [/^e-?mail$/i];

const TAG_HEADER_PATTERNS = [/^tags?$/i, /^etiquetas?$/i, /^categoria$/i, /^grupo$/i];

export type AutoMapping = {
  phoneColumn: string | null;
  fullNameColumn: string | null;
  emailColumn: string | null;
  tagsColumn: string | null;
};

export function detectAutoMapping(headers: string[]): AutoMapping {
  const find = (patterns: RegExp[]) =>
    headers.find((h) => patterns.some((p) => p.test(h.trim()))) ?? null;

  return {
    phoneColumn: find(PHONE_HEADER_PATTERNS),
    fullNameColumn: find(NAME_HEADER_PATTERNS),
    emailColumn: find(EMAIL_HEADER_PATTERNS),
    tagsColumn: find(TAG_HEADER_PATTERNS),
  };
}

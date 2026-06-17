import {
  DEFAULT_MAX_ROWS,
  HARD_MAX_ROWS,
  PTAX_BASE_URL,
  SGS_BASE_URL,
  SGS_MAX_LAST_VALUES,
} from "../config.js";
import type {
  DateParts,
  NormalizedPtaxQuote,
  NormalizedSgsObservation,
  PtaxBulletinFilter,
  PtaxCurrencyQuery,
  PtaxDollarQuery,
  SgsSeriesQuery,
} from "./types.js";

export function clampMaxRows(maxRows?: number): number {
  if (maxRows === undefined) {
    return DEFAULT_MAX_ROWS;
  }
  if (!Number.isInteger(maxRows) || maxRows < 1) {
    throw new Error("maxRows must be a positive integer.");
  }
  return Math.min(maxRows, HARD_MAX_ROWS);
}

export function normalizeNumericId(value: string | number, label: string): string {
  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${label} must be numeric.`);
  }
  return normalized;
}

export function normalizeCurrencyCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error("currency must be a 3-letter ISO code such as USD, EUR, or GBP.");
  }
  return normalized;
}

export function parseDateInput(value: string, label: string): DateParts {
  const trimmed = value.trim();
  let parts: DateParts | null = null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    parts = {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
    };
  }

  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!parts && brMatch) {
    parts = {
      year: Number(brMatch[3]),
      month: Number(brMatch[2]),
      day: Number(brMatch[1]),
    };
  }

  const ptaxMatch = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  if (!parts && ptaxMatch) {
    parts = {
      year: Number(ptaxMatch[3]),
      month: Number(ptaxMatch[1]),
      day: Number(ptaxMatch[2]),
    };
  }

  if (!parts || !isValidDate(parts)) {
    throw new Error(`${label} must be a valid date as YYYY-MM-DD, DD/MM/YYYY, or MM-DD-YYYY.`);
  }

  return parts;
}

export function formatIsoDate(parts: DateParts): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function formatSgsDate(parts: DateParts): string {
  return `${pad(parts.day)}/${pad(parts.month)}/${parts.year}`;
}

export function formatPtaxDate(parts: DateParts): string {
  return `${pad(parts.month)}-${pad(parts.day)}-${parts.year}`;
}

export function parseBacenNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : text;
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function buildSgsSeriesUrl(query: SgsSeriesQuery): string {
  const code = normalizeNumericId(query.code, "code");
  const baseUrl = `${SGS_BASE_URL}/bcdata.sgs.${code}/dados`;

  if (query.last !== undefined) {
    if (!Number.isInteger(query.last) || query.last < 1 || query.last > SGS_MAX_LAST_VALUES) {
      throw new Error(`last must be an integer between 1 and ${SGS_MAX_LAST_VALUES}.`);
    }
    return `${baseUrl}/ultimos/${query.last}?formato=json`;
  }

  const url = new URL(baseUrl);
  url.searchParams.set("formato", "json");

  if (query.startDate || query.endDate) {
    if (!query.startDate || !query.endDate) {
      throw new Error("startDate and endDate must be provided together for SGS range queries.");
    }

    const start = parseDateInput(query.startDate, "startDate");
    const end = parseDateInput(query.endDate, "endDate");
    if (compareDates(start, end) > 0) {
      throw new Error("startDate must be before or equal to endDate.");
    }
    if (!isSgsRangeWithinTenYears(start, end)) {
      throw new Error("SGS range queries cannot exceed 10 years. Split long histories into smaller windows.");
    }

    url.searchParams.set("dataInicial", formatSgsDate(start));
    url.searchParams.set("dataFinal", formatSgsDate(end));
  }

  return url.toString();
}

export function normalizeSgsObservation(row: Record<string, unknown>): NormalizedSgsObservation {
  const date = row.data === undefined || row.data === null ? "" : String(row.data);
  const value = row.valor === undefined || row.valor === null ? "" : String(row.valor);

  return {
    date,
    value,
    numericValue: parseBacenNumber(value),
  };
}

export function buildPtaxCurrenciesUrl(): string {
  return `${PTAX_BASE_URL}/Moedas?$format=json`;
}

export function buildPtaxDollarUrl(query: PtaxDollarQuery): string {
  const range = normalizePtaxRange(query);

  if (range.kind === "day") {
    return `${PTAX_BASE_URL}/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${range.date}'&$format=json`;
  }

  return `${PTAX_BASE_URL}/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@dataInicial='${range.startDate}'&@dataFinalCotacao='${range.endDate}'&$format=json`;
}

export function buildPtaxCurrencyUrl(query: PtaxCurrencyQuery): string {
  const currency = normalizeCurrencyCode(query.currency);
  const range = normalizePtaxRange(query);

  if (range.kind === "day") {
    return `${PTAX_BASE_URL}/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)?@moeda='${currency}'&@dataCotacao='${range.date}'&$format=json`;
  }

  return `${PTAX_BASE_URL}/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@moeda='${currency}'&@dataInicial='${range.startDate}'&@dataFinalCotacao='${range.endDate}'&$format=json`;
}

export function normalizePtaxQuote(row: Record<string, unknown>, currency: string | null): NormalizedPtaxQuote {
  return {
    currency,
    dateTime: stringOrEmpty(row.dataHoraCotacao),
    bulletin: stringOrDefault(row.tipoBoletim, "Fechamento"),
    parityBuy: parseBacenNumber(row.paridadeCompra),
    paritySell: parseBacenNumber(row.paridadeVenda),
    quoteBuy: parseBacenNumber(row.cotacaoCompra),
    quoteSell: parseBacenNumber(row.cotacaoVenda),
  };
}

export function filterPtaxQuotes<T extends { bulletin: string }>(
  rows: T[],
  filter: PtaxBulletinFilter = "all",
): T[] {
  if (filter === "all") {
    return rows;
  }

  return rows.filter((row) => {
    const bulletin = normalizeText(row.bulletin);
    switch (filter) {
      case "opening":
        return bulletin === "abertura";
      case "intermediate":
        return bulletin === "intermediario";
      case "closing":
        return bulletin === "fechamento";
      case "interbank_closing":
        return bulletin === "fechamento interbancario";
      default:
        return assertNever(filter);
    }
  });
}

function normalizePtaxRange(query: { date?: string; startDate?: string; endDate?: string }):
  | { kind: "day"; date: string }
  | { kind: "period"; startDate: string; endDate: string } {
  if (query.date) {
    if (query.startDate || query.endDate) {
      throw new Error("Use either date or startDate/endDate, not both.");
    }
    return { kind: "day", date: formatPtaxDate(parseDateInput(query.date, "date")) };
  }

  if (!query.startDate || !query.endDate) {
    throw new Error("Provide date for a single day, or startDate and endDate for a period.");
  }

  const start = parseDateInput(query.startDate, "startDate");
  const end = parseDateInput(query.endDate, "endDate");
  if (compareDates(start, end) > 0) {
    throw new Error("startDate must be before or equal to endDate.");
  }

  return {
    kind: "period",
    startDate: formatPtaxDate(start),
    endDate: formatPtaxDate(end),
  };
}

function isSgsRangeWithinTenYears(start: DateParts, end: DateParts): boolean {
  const latestAllowed = {
    year: start.year + 10,
    month: start.month,
    day: start.day,
  };
  return compareDates(end, latestAllowed) <= 0;
}

function compareDates(left: DateParts, right: DateParts): number {
  return (
    Date.UTC(left.year, left.month - 1, left.day) -
    Date.UTC(right.year, right.month - 1, right.day)
  );
}

function isValidDate(parts: DateParts): boolean {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return (
    date.getUTCFullYear() === parts.year &&
    date.getUTCMonth() === parts.month - 1 &&
    date.getUTCDate() === parts.day
  );
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function stringOrEmpty(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function stringOrDefault(value: unknown, fallback: string): string {
  const text = stringOrEmpty(value).trim();
  return text || fallback;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function assertNever(value: never): never {
  throw new Error(`Unexpected PTAX bulletin filter: ${String(value)}`);
}

import { DEFAULT_REQUEST_TIMEOUT_MS } from "../config.js";
import { findSgsSeries } from "./catalog.js";
import {
  buildPtaxCurrenciesUrl,
  buildPtaxCurrencyUrl,
  buildPtaxDollarUrl,
  buildSgsSeriesUrl,
  clampMaxRows,
  filterPtaxQuotes,
  normalizeCurrencyCode,
  normalizePtaxQuote,
  normalizeSgsObservation,
} from "./query.js";
import type {
  JsonObject,
  NormalizedPtaxCurrency,
  PtaxCurrencyQuery,
  PtaxDollarQuery,
  PtaxQuotesResult,
  SgsSeriesQuery,
  SgsSeriesResult,
} from "./types.js";

export class BacenApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly url?: string,
  ) {
    super(message);
    this.name = "BacenApiError";
  }
}

export class BacenClient {
  constructor(private readonly timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {}

  async getSgsSeries(query: SgsSeriesQuery): Promise<SgsSeriesResult> {
    const maxRows = clampMaxRows(query.maxRows);
    const requestUrl = buildSgsSeriesUrl(query);
    const rawRows = await this.getJson<Array<Record<string, unknown>>>(requestUrl);
    const rows = rawRows.slice(0, maxRows).map(normalizeSgsObservation);
    const seriesCode = String(query.code).trim();

    return {
      requestUrl,
      seriesCode,
      seriesName: findSgsSeries(seriesCode)?.name ?? null,
      rowCount: rawRows.length,
      returnedRows: rows.length,
      truncated: rawRows.length > rows.length,
      rows,
    };
  }

  async listPtaxCurrencies(): Promise<{
    requestUrl: string;
    itemCount: number;
    currencies: NormalizedPtaxCurrency[];
  }> {
    const requestUrl = buildPtaxCurrenciesUrl();
    const payload = await this.getODataValue(requestUrl);
    const currencies = payload.map((item) => ({
      symbol: stringValue(item.simbolo),
      name: stringValue(item.nomeFormatado),
      type: nullableStringValue(item.tipoMoeda),
    }));

    return {
      requestUrl,
      itemCount: currencies.length,
      currencies,
    };
  }

  async getPtaxDollar(query: PtaxDollarQuery): Promise<PtaxQuotesResult> {
    const requestUrl = buildPtaxDollarUrl(query);
    return this.getPtaxQuotes(requestUrl, "USD", query.bulletin, query.maxRows);
  }

  async getPtaxCurrency(query: PtaxCurrencyQuery): Promise<PtaxQuotesResult> {
    const currency = normalizeCurrencyCode(query.currency);
    const requestUrl = buildPtaxCurrencyUrl(query);
    return this.getPtaxQuotes(requestUrl, currency, query.bulletin, query.maxRows);
  }

  private async getPtaxQuotes(
    requestUrl: string,
    currency: string,
    bulletin: PtaxCurrencyQuery["bulletin"],
    maxRowsInput?: number,
  ): Promise<PtaxQuotesResult> {
    const maxRows = clampMaxRows(maxRowsInput);
    const payload = await this.getODataValue(requestUrl);
    const normalizedRows = payload.map((item) => normalizePtaxQuote(item, currency));
    const filteredRows = filterPtaxQuotes(normalizedRows, bulletin);
    const rows = filteredRows.slice(0, maxRows);

    return {
      requestUrl,
      currency,
      rowCount: filteredRows.length,
      returnedRows: rows.length,
      truncated: filteredRows.length > rows.length,
      rows,
    };
  }

  private async getODataValue(url: string): Promise<JsonObject[]> {
    const data = await this.getJson<JsonObject>(url);
    const value = data.value;
    if (!Array.isArray(value)) {
      throw new BacenApiError("BCB OData response did not contain a value array.", undefined, url);
    }
    return value.filter(isJsonObject);
  }

  private async getJson<T>(url: string): Promise<T> {
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
    let response: Response;

    try {
      response = await fetch(url, {
        headers: {
          accept: "application/json",
          "user-agent": "mcp-bacen/0.1.0",
        },
        signal: timeoutSignal,
      });
    } catch (error) {
      throw new BacenApiError(
        `Failed to request BCB API: ${String(error)}`,
        undefined,
        url,
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new BacenApiError(
        `BCB API returned ${response.status}: ${body.slice(0, 300)}`,
        response.status,
        url,
      );
    }

    return (await response.json()) as T;
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function nullableStringValue(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const text = String(value).trim();
  return text || null;
}

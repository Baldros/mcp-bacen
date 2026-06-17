export type JsonObject = Record<string, unknown>;

export type DateParts = {
  year: number;
  month: number;
  day: number;
};

export type SgsSeriesCatalogItem = {
  code: number;
  name: string;
  periodicity: string;
  category: string;
  sourceUrl: string;
  notes?: string;
};

export type SgsSeriesQuery = {
  code: string | number;
  startDate?: string;
  endDate?: string;
  last?: number;
  maxRows?: number;
};

export type NormalizedSgsObservation = {
  date: string;
  value: string;
  numericValue: number | null;
};

export type SgsSeriesResult = {
  requestUrl: string;
  seriesCode: string;
  seriesName: string | null;
  rowCount: number;
  returnedRows: number;
  truncated: boolean;
  rows: NormalizedSgsObservation[];
};

export type PtaxBulletinFilter =
  | "all"
  | "opening"
  | "intermediate"
  | "closing"
  | "interbank_closing";

export type PtaxCurrencyQuery = {
  currency: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  bulletin?: PtaxBulletinFilter;
  maxRows?: number;
};

export type PtaxDollarQuery = Omit<PtaxCurrencyQuery, "currency">;

export type NormalizedPtaxCurrency = {
  symbol: string;
  name: string;
  type: string | null;
};

export type NormalizedPtaxQuote = {
  currency: string | null;
  dateTime: string;
  bulletin: string;
  parityBuy: number | null;
  paritySell: number | null;
  quoteBuy: number | null;
  quoteSell: number | null;
};

export type PtaxQuotesResult = {
  requestUrl: string;
  currency: string;
  rowCount: number;
  returnedRows: number;
  truncated: boolean;
  rows: NormalizedPtaxQuote[];
};

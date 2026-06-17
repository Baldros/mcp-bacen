import { z } from "zod";

export const searchInputSchema = {
  query: z.string().min(1).describe("Search query in Portuguese or English."),
};

export const searchOutputSchema = {
  results: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      url: z.string().url(),
    }),
  ),
};

export const fetchInputSchema = {
  id: z.string().min(1).describe("Document or search result id returned by search."),
};

export const fetchOutputSchema = {
  id: z.string(),
  title: z.string(),
  text: z.string(),
  url: z.string().url(),
  metadata: z.record(z.string(), z.string()).optional(),
};

export const listSgsSeriesInputSchema = {
  query: z
    .string()
    .default("")
    .describe("Optional text or numeric-code search over the local SGS catalog."),
  maxResults: z.number().int().min(1).max(50).default(20),
};

export const listSgsSeriesOutputSchema = {
  itemCount: z.number(),
  series: z.array(
    z.object({
      code: z.number(),
      name: z.string(),
      periodicity: z.string(),
      category: z.string(),
      sourceUrl: z.string().url(),
      notes: z.string().optional(),
    }),
  ),
};

export const sgsSeriesInputSchema = {
  code: z.union([z.string(), z.number()]).describe("Numeric SGS series code, for example 11."),
  startDate: z
    .string()
    .optional()
    .describe("Optional range start date as YYYY-MM-DD, DD/MM/YYYY, or MM-DD-YYYY."),
  endDate: z
    .string()
    .optional()
    .describe("Optional range end date as YYYY-MM-DD, DD/MM/YYYY, or MM-DD-YYYY."),
  last: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe("If set, use the SGS /ultimos/{N} endpoint. The BCB limit is 20."),
  maxRows: z.number().int().min(1).max(5000).default(1000),
};

export const sgsSeriesOutputSchema = {
  requestUrl: z.string().url(),
  seriesCode: z.string(),
  seriesName: z.string().nullable(),
  rowCount: z.number(),
  returnedRows: z.number(),
  truncated: z.boolean(),
  rows: z.array(
    z.object({
      date: z.string(),
      value: z.string(),
      numericValue: z.number().nullable(),
    }),
  ),
};

export const ptaxCurrenciesInputSchema = {};

export const ptaxCurrenciesOutputSchema = {
  requestUrl: z.string().url(),
  itemCount: z.number(),
  currencies: z.array(
    z.object({
      symbol: z.string(),
      name: z.string(),
      type: z.string().nullable(),
    }),
  ),
};

const bulletinFilter = z
  .enum(["all", "opening", "intermediate", "closing", "interbank_closing"])
  .default("all");

const ptaxCommonFields = {
  date: z
    .string()
    .optional()
    .describe("Single quote date as YYYY-MM-DD, DD/MM/YYYY, or MM-DD-YYYY."),
  startDate: z
    .string()
    .optional()
    .describe("Period start date as YYYY-MM-DD, DD/MM/YYYY, or MM-DD-YYYY."),
  endDate: z
    .string()
    .optional()
    .describe("Period end date as YYYY-MM-DD, DD/MM/YYYY, or MM-DD-YYYY."),
  bulletin: bulletinFilter.describe(
    "Optional bulletin filter. closing is the official PTAX closing bulletin.",
  ),
  maxRows: z.number().int().min(1).max(5000).default(1000),
};

export const ptaxDollarInputSchema = {
  ...ptaxCommonFields,
};

export const ptaxCurrencyInputSchema = {
  currency: z.string().describe("Three-letter currency code such as EUR, GBP, or JPY."),
  ...ptaxCommonFields,
};

export const ptaxQuotesOutputSchema = {
  requestUrl: z.string().url(),
  currency: z.string(),
  rowCount: z.number(),
  returnedRows: z.number(),
  truncated: z.boolean(),
  rows: z.array(
    z.object({
      currency: z.string().nullable(),
      dateTime: z.string(),
      bulletin: z.string(),
      parityBuy: z.number().nullable(),
      paritySell: z.number().nullable(),
      quoteBuy: z.number().nullable(),
      quoteSell: z.number().nullable(),
    }),
  ),
};

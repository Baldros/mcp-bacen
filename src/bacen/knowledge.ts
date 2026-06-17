import {
  BCB_OPEN_DATA_BASE_URL,
  PTAX_BASE_URL,
  PTAX_SWAGGER_URL,
  SGS_BASE_URL,
} from "../config.js";
import { findSgsSeries, searchSgsCatalog, sgsApiUrl } from "./catalog.js";

export type KnowledgeSearchResult = {
  id: string;
  title: string;
  url: string;
};

export type KnowledgeDocument = KnowledgeSearchResult & {
  text: string;
  metadata?: Record<string, string>;
};

const STATIC_DOCUMENTS: KnowledgeDocument[] = [
  {
    id: "bacen-overview",
    title: "Banco Central do Brasil public APIs overview",
    url: BCB_OPEN_DATA_BASE_URL,
    text:
      "This MCP server exposes public BCB data from SGS and PTAX. SGS is used for time series identified by numeric codes, such as Selic, CDI, IPCA, and exchange-rate series. PTAX is used for official intraday exchange-rate bulletins through the Olinda OData gateway. These public endpoints do not require authentication.",
    metadata: { source: "Banco Central do Brasil" },
  },
  {
    id: "sgs-api",
    title: "SGS time series API",
    url: `${SGS_BASE_URL}/bcdata.sgs.{code}/dados?formato=json`,
    text:
      "SGS retrieves time series through /dados with formato=json and optional dataInicial/dataFinal parameters in DD/MM/YYYY format. The /dados/ultimos/{N} route returns the most recent values and N is limited to 20. Since March 26, 2025, a dated SGS request cannot exceed a 10-year interval, so long histories should be split into windows.",
    metadata: { source: "BCB SGS" },
  },
  {
    id: "sgs-common-series",
    title: "Common SGS series codes",
    url: BCB_OPEN_DATA_BASE_URL,
    text:
      "Common SGS codes included in this server catalog: 11 Selic effective daily rate, 432 Selic target, 12 CDI, 433 IPCA monthly variation, 188 INPC, 189 IGP-M, 1 USD sell exchange rate, and 10813 USD buy exchange rate. SGS itself does not provide a simple public text-search endpoint, so use list_sgs_series before get_sgs_series when the code is unclear.",
    metadata: { source: "BCB SGS" },
  },
  {
    id: "ptax-api",
    title: "PTAX OData API",
    url: PTAX_SWAGGER_URL,
    text:
      "PTAX is served through the BCB Olinda OData gateway. Useful resources include Moedas, CotacaoDolarDia, CotacaoDolarPeriodo, CotacaoMoedaDia, and CotacaoMoedaPeriodo. PTAX returns intraday bulletins such as Abertura, Intermediario, Fechamento Interbancario, and Fechamento.",
    metadata: { source: "BCB PTAX" },
  },
  {
    id: "ptax-currencies",
    title: "PTAX currencies resource",
    url: `${PTAX_BASE_URL}/Moedas?$format=json`,
    text:
      "The PTAX Moedas resource lists supported currency symbols, formatted names, and currency types. Use list_ptax_currencies to find valid currency codes before calling get_ptax_currency_quotes.",
    metadata: { source: "BCB PTAX" },
  },
];

export function searchKnowledge(query: string): KnowledgeSearchResult[] {
  const normalized = query.trim().toLowerCase();
  const results = new Map<string, KnowledgeSearchResult>();

  for (const code of extractSgsCodes(query)) {
    const series = findSgsSeries(code);
    results.set(`sgs-series-${code}`, {
      id: `sgs-series-${code}`,
      title: series ? `SGS ${code}: ${series.name}` : `SGS series ${code}`,
      url: series?.sourceUrl ?? sgsApiUrl(code),
    });
  }

  for (const series of searchSgsCatalog(query, 5)) {
    results.set(`sgs-series-${series.code}`, {
      id: `sgs-series-${series.code}`,
      title: `SGS ${series.code}: ${series.name}`,
      url: series.sourceUrl,
    });
  }

  for (const document of STATIC_DOCUMENTS) {
    const haystack = `${document.title}\n${document.text}`.toLowerCase();
    if (!normalized || normalized.split(/\s+/).some((term) => haystack.includes(term))) {
      results.set(document.id, {
        id: document.id,
        title: document.title,
        url: document.url,
      });
    }
  }

  return [...results.values()].slice(0, 10);
}

export async function fetchKnowledgeDocument(id: string): Promise<KnowledgeDocument> {
  const staticDocument = STATIC_DOCUMENTS.find((document) => document.id === id);
  if (staticDocument) {
    return staticDocument;
  }

  const seriesMatch = /^sgs-series-(\d+)$/.exec(id);
  if (seriesMatch) {
    const code = seriesMatch[1];
    const series = findSgsSeries(code);
    return {
      id,
      title: series ? `SGS ${code}: ${series.name}` : `SGS series ${code}`,
      url: series?.sourceUrl ?? sgsApiUrl(code),
      text: [
        `Series code: ${code}`,
        `Name: ${series?.name ?? "Unknown in local catalog"}`,
        `Periodicity: ${series?.periodicity ?? "Unknown"}`,
        `Category: ${series?.category ?? "Unknown"}`,
        `SGS API URL: ${sgsApiUrl(code)}`,
        "Use get_sgs_series with last for the latest values, or with startDate/endDate for a dated interval of up to 10 years.",
      ].join("\n"),
      metadata: {
        source: "BCB SGS",
        seriesCode: code,
      },
    };
  }

  throw new Error(`Knowledge document not found: ${id}`);
}

function extractSgsCodes(query: string): string[] {
  const ids = new Set<string>();
  for (const match of query.matchAll(/\b(?:sgs|serie|series|codigo|code)?\s*(\d{1,7})\b/gi)) {
    ids.add(match[1]);
  }
  return [...ids].slice(0, 5);
}

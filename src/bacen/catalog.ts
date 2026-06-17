import { BCB_OPEN_DATA_BASE_URL, SGS_BASE_URL } from "../config.js";
import type { SgsSeriesCatalogItem } from "./types.js";

export const SGS_SERIES_CATALOG: SgsSeriesCatalogItem[] = [
  {
    code: 1,
    name: "Dolar americano venda - taxa de cambio livre",
    periodicity: "daily",
    category: "exchange",
    sourceUrl: `${BCB_OPEN_DATA_BASE_URL}/dataset/1-taxa-de-cambio---livre---dolar-americano-venda`,
  },
  {
    code: 10813,
    name: "Dolar americano compra - taxa de cambio livre",
    periodicity: "daily",
    category: "exchange",
    sourceUrl: `${BCB_OPEN_DATA_BASE_URL}/dataset/10813-taxa-de-cambio---livre---dolar-americano-compra`,
  },
  {
    code: 11,
    name: "Taxa Selic efetiva",
    periodicity: "daily",
    category: "interest",
    sourceUrl: `${BCB_OPEN_DATA_BASE_URL}/dataset/11-taxa-de-juros---selic`,
  },
  {
    code: 432,
    name: "Meta Selic definida pelo Copom",
    periodicity: "daily",
    category: "interest",
    sourceUrl: `${BCB_OPEN_DATA_BASE_URL}/dataset/432-taxa-de-juros---meta-selic-definida-pelo-copom`,
  },
  {
    code: 12,
    name: "CDI",
    periodicity: "daily",
    category: "interest",
    sourceUrl: `${BCB_OPEN_DATA_BASE_URL}/dataset/12-taxa-de-juros---cdi`,
  },
  {
    code: 4390,
    name: "Selic acumulada no mes",
    periodicity: "monthly",
    category: "interest",
    sourceUrl: `${BCB_OPEN_DATA_BASE_URL}/dataset/4390-taxa-de-juros---selic-acumulada-no-mes-anualizada-base-252`,
  },
  {
    code: 1178,
    name: "Selic anualizada base 252",
    periodicity: "daily",
    category: "interest",
    sourceUrl: `${BCB_OPEN_DATA_BASE_URL}/dataset/1178-taxa-de-juros---selic-anualizada-base-252`,
  },
  {
    code: 433,
    name: "IPCA - variacao mensal",
    periodicity: "monthly",
    category: "inflation",
    sourceUrl: `${BCB_OPEN_DATA_BASE_URL}/dataset/433-indice-nacional-de-precos-ao-consumidor-amplo-ipca`,
  },
  {
    code: 188,
    name: "INPC - variacao mensal",
    periodicity: "monthly",
    category: "inflation",
    sourceUrl: `${BCB_OPEN_DATA_BASE_URL}/dataset/188-indice-nacional-de-precos-ao-consumidor-inpc`,
  },
  {
    code: 189,
    name: "IGP-M - variacao mensal",
    periodicity: "monthly",
    category: "inflation",
    sourceUrl: `${BCB_OPEN_DATA_BASE_URL}/dataset/189-indice-geral-de-precos-do-mercado-igp-m`,
  },
];

export function findSgsSeries(code: string | number): SgsSeriesCatalogItem | null {
  const normalized = String(code).trim();
  return SGS_SERIES_CATALOG.find((series) => String(series.code) === normalized) ?? null;
}

export function searchSgsCatalog(query: string, maxResults = 20): SgsSeriesCatalogItem[] {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (!terms.length) {
    return SGS_SERIES_CATALOG.slice(0, maxResults);
  }

  return SGS_SERIES_CATALOG.filter((series) => {
    const haystack = [
      series.code,
      series.name,
      series.periodicity,
      series.category,
      series.notes,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return terms.some((term) => haystack.includes(term));
  }).slice(0, maxResults);
}

export function sgsApiUrl(code: string | number): string {
  return `${SGS_BASE_URL}/bcdata.sgs.${String(code).trim()}/dados?formato=json`;
}

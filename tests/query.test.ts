import { describe, expect, it } from "vitest";
import {
  buildPtaxCurrencyUrl,
  buildPtaxDollarUrl,
  buildSgsSeriesUrl,
  filterPtaxQuotes,
  formatPtaxDate,
  formatSgsDate,
  normalizePtaxQuote,
  normalizeSgsObservation,
  parseBacenNumber,
  parseDateInput,
} from "../src/bacen/query.js";

describe("date helpers", () => {
  it("accepts ISO and formats for SGS and PTAX", () => {
    const date = parseDateInput("2026-06-16", "date");

    expect(formatSgsDate(date)).toBe("16/06/2026");
    expect(formatPtaxDate(date)).toBe("06-16-2026");
  });

  it("accepts Brazilian date strings", () => {
    const date = parseDateInput("31/12/2025", "date");

    expect(formatSgsDate(date)).toBe("31/12/2025");
    expect(formatPtaxDate(date)).toBe("12-31-2025");
  });
});

describe("buildSgsSeriesUrl", () => {
  it("builds a latest-values SGS URL", () => {
    expect(buildSgsSeriesUrl({ code: 11, last: 2 })).toBe(
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados/ultimos/2?formato=json",
    );
  });

  it("builds a dated SGS URL", () => {
    expect(
      buildSgsSeriesUrl({
        code: "433",
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      }),
    ).toBe(
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json&dataInicial=01%2F01%2F2024&dataFinal=31%2F12%2F2024",
    );
  });

  it("rejects SGS ranges longer than 10 years", () => {
    expect(() =>
      buildSgsSeriesUrl({
        code: 11,
        startDate: "2010-01-01",
        endDate: "2021-01-02",
      }),
    ).toThrow(/10 years/);
  });
});

describe("PTAX URL builders", () => {
  it("builds a dollar day URL", () => {
    expect(buildPtaxDollarUrl({ date: "2026-06-16" })).toBe(
      "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='06-16-2026'&$format=json",
    );
  });

  it("builds a currency period URL", () => {
    expect(
      buildPtaxCurrencyUrl({
        currency: "eur",
        startDate: "2026-06-01",
        endDate: "2026-06-16",
      }),
    ).toBe(
      "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@moeda='EUR'&@dataInicial='06-01-2026'&@dataFinalCotacao='06-16-2026'&$format=json",
    );
  });
});

describe("normalization", () => {
  it("parses Brazilian decimal values", () => {
    expect(parseBacenNumber("1.234,56")).toBe(1234.56);
    expect(parseBacenNumber("13.75")).toBe(13.75);
  });

  it("normalizes SGS observations", () => {
    expect(normalizeSgsObservation({ data: "16/06/2026", valor: "13,75" })).toEqual({
      date: "16/06/2026",
      value: "13,75",
      numericValue: 13.75,
    });
  });

  it("defaults daily dollar PTAX quotes to the closing bulletin", () => {
    expect(
      normalizePtaxQuote(
        {
          cotacaoCompra: 4.891,
          cotacaoVenda: 4.8916,
          dataHoraCotacao: "2024-01-02 13:05:50.319",
        },
        "USD",
      ),
    ).toEqual({
      currency: "USD",
      dateTime: "2024-01-02 13:05:50.319",
      bulletin: "Fechamento",
      parityBuy: null,
      paritySell: null,
      quoteBuy: 4.891,
      quoteSell: 4.8916,
    });
  });

  it("filters PTAX bulletins without depending on accents", () => {
    const rows = [
      { bulletin: "Abertura", value: 1 },
      { bulletin: "Intermediario", value: 2 },
      { bulletin: "Fechamento", value: 3 },
    ];

    expect(filterPtaxQuotes(rows, "closing")).toEqual([{ bulletin: "Fechamento", value: 3 }]);
  });
});

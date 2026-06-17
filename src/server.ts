import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import { BacenClient } from "./bacen/client.js";
import { searchSgsCatalog } from "./bacen/catalog.js";
import { fetchKnowledgeDocument, searchKnowledge } from "./bacen/knowledge.js";
import { DEFAULT_PORT, MCP_PATH } from "./config.js";
import {
  fetchInputSchema,
  fetchOutputSchema,
  listSgsSeriesInputSchema,
  listSgsSeriesOutputSchema,
  ptaxCurrenciesInputSchema,
  ptaxCurrenciesOutputSchema,
  ptaxCurrencyInputSchema,
  ptaxDollarInputSchema,
  ptaxQuotesOutputSchema,
  searchInputSchema,
  searchOutputSchema,
  sgsSeriesInputSchema,
  sgsSeriesOutputSchema,
} from "./mcp/schemas.js";

const widgetHtml = readFileSync(
  join(process.cwd(), "public", "bacen-widget.html"),
  "utf8",
);

const client = new BacenClient();
const WIDGET_URI = "ui://widget/bacen-results-v1.html";

function jsonContent(value: unknown) {
  return [{ type: "text" as const, text: JSON.stringify(value) }];
}

function createBacenServer() {
  const server = new McpServer(
    { name: "mcp-bacen", version: "0.1.0" },
    {
      instructions:
        "Use este servidor para consultar dados publicos do Banco Central do Brasil. Todas as ferramentas sao somente leitura. Para SGS, use list_sgs_series quando o codigo nao estiver claro; consultas por periodo devem ficar em janelas de ate 10 anos. Para cambio intradiario ou moedas diferentes de USD, prefira as ferramentas PTAX. Preserve URLs de fonte nas respostas.",
    },
  );

  registerAppResource(
    server,
    "bacen-results",
    WIDGET_URI,
    {},
    async () => ({
      contents: [
        {
          uri: WIDGET_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: widgetHtml,
          _meta: {
            ui: {
              prefersBorder: true,
              csp: {
                connectDomains: [],
                resourceDomains: [],
              },
              ...(process.env.APP_DOMAIN ? { domain: process.env.APP_DOMAIN } : {}),
            },
            "openai/widgetDescription":
              "Mostra resultados tabulares de consultas publicas ao Banco Central do Brasil.",
          },
        },
      ],
    }),
  );

  server.registerTool(
    "search",
    {
      title: "Search BCB knowledge",
      description:
        "Searches public Banco Central do Brasil SGS/PTAX API notes and common SGS series references. Use fetch to retrieve a selected result.",
      inputSchema: searchInputSchema,
      outputSchema: searchOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ query }) => {
      const structuredContent = { results: searchKnowledge(query) };
      return {
        structuredContent,
        content: jsonContent(structuredContent),
      };
    },
  );

  server.registerTool(
    "fetch",
    {
      title: "Fetch BCB knowledge item",
      description:
        "Fetches a public Banco Central do Brasil knowledge item returned by search, including canonical source URLs for citation.",
      inputSchema: fetchInputSchema,
      outputSchema: fetchOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const structuredContent = await fetchKnowledgeDocument(id);
      return {
        structuredContent,
        content: jsonContent(structuredContent),
      };
    },
  );

  registerAppTool(
    server,
    "list_sgs_series",
    {
      title: "List common SGS series",
      description:
        "Searches the local catalog of common public SGS series codes such as Selic, CDI, IPCA, INPC, IGP-M, and USD exchange-rate series.",
      inputSchema: listSgsSeriesInputSchema,
      outputSchema: listSgsSeriesOutputSchema,
      annotations: { readOnlyHint: true },
      _meta: {
        ui: { resourceUri: WIDGET_URI },
        "openai/toolInvocation/invoking": "Consultando catalogo SGS...",
        "openai/toolInvocation/invoked": "Catalogo SGS pronto.",
      },
    },
    async ({ query, maxResults }) => {
      const series = searchSgsCatalog(query, maxResults);
      const structuredContent = {
        itemCount: series.length,
        series,
      };
      return {
        structuredContent,
        content: [
          {
            type: "text",
            text: `Encontradas ${series.length} series SGS no catalogo local.`,
          },
        ],
      };
    },
  );

  registerAppTool(
    server,
    "get_sgs_series",
    {
      title: "Get SGS time series",
      description:
        "Retrieves public BCB SGS time-series observations by numeric series code. Use last for recent values or startDate/endDate for a range up to 10 years.",
      inputSchema: sgsSeriesInputSchema,
      outputSchema: sgsSeriesOutputSchema,
      annotations: { readOnlyHint: true },
      _meta: {
        ui: { resourceUri: WIDGET_URI },
        "openai/toolInvocation/invoking": "Buscando serie SGS...",
        "openai/toolInvocation/invoked": "Serie SGS pronta.",
      },
    },
    async (args) => {
      const structuredContent = await client.getSgsSeries(args);
      return {
        structuredContent,
        content: [
          {
            type: "text",
            text: `Recuperadas ${structuredContent.returnedRows} de ${structuredContent.rowCount} observacoes SGS. URL: ${structuredContent.requestUrl}`,
          },
        ],
      };
    },
  );

  registerAppTool(
    server,
    "list_ptax_currencies",
    {
      title: "List PTAX currencies",
      description:
        "Lists currencies available in the public BCB PTAX OData API, including symbols and formatted names.",
      inputSchema: ptaxCurrenciesInputSchema,
      outputSchema: ptaxCurrenciesOutputSchema,
      annotations: { readOnlyHint: true },
      _meta: {
        ui: { resourceUri: WIDGET_URI },
        "openai/toolInvocation/invoking": "Listando moedas PTAX...",
        "openai/toolInvocation/invoked": "Moedas PTAX prontas.",
      },
    },
    async () => {
      const structuredContent = await client.listPtaxCurrencies();
      return {
        structuredContent,
        content: [
          {
            type: "text",
            text: `Recuperadas ${structuredContent.itemCount} moedas PTAX. URL: ${structuredContent.requestUrl}`,
          },
        ],
      };
    },
  );

  registerAppTool(
    server,
    "get_ptax_dollar_quotes",
    {
      title: "Get PTAX dollar quotes",
      description:
        "Retrieves public PTAX dollar buy/sell quotes for one date or a period. Use bulletin=closing for the official daily PTAX closing rate.",
      inputSchema: ptaxDollarInputSchema,
      outputSchema: ptaxQuotesOutputSchema,
      annotations: { readOnlyHint: true },
      _meta: {
        ui: { resourceUri: WIDGET_URI },
        "openai/toolInvocation/invoking": "Buscando PTAX dolar...",
        "openai/toolInvocation/invoked": "PTAX dolar pronta.",
      },
    },
    async (args) => {
      const structuredContent = await client.getPtaxDollar(args);
      return {
        structuredContent,
        content: [
          {
            type: "text",
            text: `Recuperadas ${structuredContent.returnedRows} de ${structuredContent.rowCount} cotacoes PTAX USD. URL: ${structuredContent.requestUrl}`,
          },
        ],
      };
    },
  );

  registerAppTool(
    server,
    "get_ptax_currency_quotes",
    {
      title: "Get PTAX currency quotes",
      description:
        "Retrieves public PTAX quotes for a non-USD currency by symbol, for one date or a period. Use list_ptax_currencies first when the code is unclear.",
      inputSchema: ptaxCurrencyInputSchema,
      outputSchema: ptaxQuotesOutputSchema,
      annotations: { readOnlyHint: true },
      _meta: {
        ui: { resourceUri: WIDGET_URI },
        "openai/toolInvocation/invoking": "Buscando PTAX moeda...",
        "openai/toolInvocation/invoked": "PTAX moeda pronta.",
      },
    },
    async (args) => {
      const structuredContent = await client.getPtaxCurrency(args);
      return {
        structuredContent,
        content: [
          {
            type: "text",
            text: `Recuperadas ${structuredContent.returnedRows} de ${structuredContent.rowCount} cotacoes PTAX ${structuredContent.currency}. URL: ${structuredContent.requestUrl}`,
          },
        ],
      };
    },
  );

  return server;
}

const port = Number(process.env.PORT ?? DEFAULT_PORT);

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "content-type, mcp-session-id, mcp-protocol-version, authorization",
    "Access-Control-Expose-Headers": "Mcp-Session-Id, mcp-session-id",
  };

  if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    res
      .writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify({ name: "mcp-bacen", mcp: MCP_PATH }));
    return;
  }

  const mcpMethods = new Set(["POST", "GET", "DELETE"]);
  if (url.pathname === MCP_PATH && req.method && mcpMethods.has(req.method)) {
    for (const [header, value] of Object.entries(corsHeaders)) {
      res.setHeader(header, value);
    }

    const server = createBacenServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.writeHead(500).end("Internal server error");
      }
    }
    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, () => {
  console.log(`MCP BACEN listening on http://localhost:${port}${MCP_PATH}`);
});

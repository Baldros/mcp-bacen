# MCP BACEN

Servidor MCP remoto para dados publicos do Banco Central do Brasil, nos mesmos moldes do projeto `mcp-sidra`, preparado para virar um app do ChatGPT com Apps SDK.

## Stack

- Node.js + TypeScript + ESM
- `@modelcontextprotocol/sdk` com transporte Streamable HTTP em `/mcp`
- `@modelcontextprotocol/ext-apps` para recurso UI opcional do Apps SDK
- Zod para schemas de entrada e saida
- Vitest para testes dos builders de URL e normalizacao

## Ferramentas MCP

- `search` e `fetch`: compativeis com o padrao data-only/company knowledge do ChatGPT.
- `list_sgs_series`: busca no catalogo local de codigos SGS comuns.
- `get_sgs_series`: consulta series temporais do SGS por codigo, com `last` ou `startDate`/`endDate`.
- `list_ptax_currencies`: lista moedas disponiveis no endpoint PTAX `Moedas`.
- `get_ptax_dollar_quotes`: consulta cotacoes PTAX do dolar por dia ou periodo.
- `get_ptax_currency_quotes`: consulta cotacoes PTAX de outras moedas por dia ou periodo.

Todas as ferramentas sao read-only.

## Desenvolvimento

```bash
npm install
npm run dev
```

O MCP fica disponivel em:

```text
http://localhost:8787/mcp
```

Teste com o MCP Inspector:

```bash
npm run inspect
```

## Exemplos de prompts

```text
Liste as series SGS relacionadas a Selic.
```

```text
Busque os ultimos 5 valores da serie SGS 11.
```

```text
Qual foi a PTAX de fechamento do dolar em 2026-06-16?
```

```text
Liste as moedas disponiveis na PTAX e depois consulte EUR em junho de 2026.
```

## ChatGPT App

Para conectar no ChatGPT durante desenvolvimento:

1. Rode `npm run dev`.
2. Exponha a porta com um tunel HTTPS, por exemplo `ngrok http 8787`.
3. Em ChatGPT, ative developer mode e crie um app apontando para `https://<subdomain>.ngrok.app/mcp`.

Para submissao, defina `APP_DOMAIN` com o dominio HTTPS final do app. O widget e opcional, mas este projeto ja inclui um recurso Apps SDK simples para renderizar resultados tabulares.

## Fontes de dados

- SGS: `https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados?formato=json`
- PTAX: `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata`
- Dados abertos BCB: `https://dadosabertos.bcb.gov.br`

Observacoes:

- O endpoint SGS `ultimos/{N}` aceita no maximo 20 valores.
- Consultas SGS com `dataInicial` e `dataFinal` devem ser divididas em janelas de ate 10 anos.
- PTAX usa sintaxe OData, por exemplo `CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='06-16-2026'&$format=json`.

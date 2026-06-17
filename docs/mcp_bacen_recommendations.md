# Recomendacoes de melhoria para o MCP BACEN

Este documento consolida feedback pratico a partir do uso do MCP para uma analise historica do Brasil desde o Plano Real, combinando IPCA via SIDRA e dados de cambio/juros via BACEN. O foco aqui nao e listar o que ja esta bom, mas sim apontar melhorias que reduziriam scripts externos, evitariam friccao para usuarios e manteriam o MCP dentro de um escopo sustentavel.

## Principio de produto

O MCP deve ser uma camada confiavel de acesso, normalizacao, transformacao simples e exportacao de dados macroeconomicos brasileiros. Ele nao deve tentar virar um ambiente generico de econometria, BI ou ciencia de dados.

O equilibrio recomendado e:

- Fazer bem operacoes repetitivas, estaveis e de baixo julgamento analitico.
- Devolver dados e metadados suficientes para que outro agente, notebook, planilha ou usuario faca a interpretacao.
- Evitar ferramentas opinativas demais, como `analyze_brazil_economy`, que misturam coleta, metodologia e narrativa.

## Melhorias prioritarias

### 1. Consulta SGS com paginacao automatica

Problema observado: para series longas, como dolar desde 1994, foi necessario dividir manualmente a consulta em janelas de ate 10 anos.

Recomendacao: criar uma ferramenta ou modo novo:

```text
get_sgs_series_windowed
```

Entrada sugerida:

- `code`
- `startDate`
- `endDate`
- `maxRows`
- `windowYears`, default `10`

Saida sugerida:

- `seriesCode`
- `seriesName`
- `requestUrls`
- `rowCount`
- `returnedRows`
- `truncated`
- `rows`
- `warnings`

Essa deve ser a melhoria mais importante. Ela preserva a regra do BACEN, mas remove trabalho mecanico do consumidor.

### 2. Agregacao temporal para series diarias

Problema observado: para comparar dolar com IPCA mensal, foi necessario transformar a serie diaria do dolar em fechamento mensal.

Recomendacao: adicionar transformacao de frequencia:

```text
aggregate_time_series
```

Operacoes iniciais:

- `first`
- `last`
- `mean`
- `min`
- `max`

Frequencias iniciais:

- `monthly`
- `annual`

Casos de uso:

- Dolar SGS diario para fechamento mensal.
- Selic diaria para media mensal.
- PTAX intradiaria para fechamento diario.

Essa ferramenta deve aceitar dados ja retornados por outra ferramenta ou parametros de consulta. Se a API MCP/host dificultar passar datasets grandes entre chamadas, pode existir um helper especifico:

```text
get_sgs_series_aggregated
```

### 3. Estatisticas descritivas basicas

Problema observado: acumulados, maximos, minimos, primeiro/ultimo valor e taxas anualizadas exigiram script local.

Recomendacao: criar:

```text
summarize_time_series
```

Metricas recomendadas:

- primeiro valor e data
- ultimo valor e data
- minimo e data
- maximo e data
- media
- mediana
- desvio padrao
- variacao simples
- variacao anualizada, quando aplicavel
- quantidade de observacoes
- datas de cobertura

Importante: a ferramenta deve explicitar a metodologia. Exemplo: CAGR so faz sentido para nivel de indice, preco ou cambio; para taxa percentual mensal, o correto normalmente e compor os fatores.

### 4. Composicao de taxas percentuais

Problema observado: IPCA mensal e Selic acumulada no mes precisam de composicao, nao soma simples.

Recomendacao: criar:

```text
compound_rate_series
```

Entrada:

- serie de taxas em percentual
- frequencia da serie
- periodo
- opcionalmente subperiodos nomeados

Saida:

- acumulado composto
- media anual composta
- numero de periodos
- metodologia usada

Isso e muito util para IPCA, INPC, IGP-M, Selic mensal e CDI mensal.

### 5. Comparacao por periodos nomeados

Problema observado: a analise historica ficou muito mais clara quando dividida em fases economicas.

Recomendacao: criar:

```text
compare_series_periods
```

Entrada:

- uma ou mais series
- lista de periodos `{ name, startDate, endDate }`
- transformacoes por serie, por exemplo `compound`, `last_over_first`, `mean`

Saida:

- tabela estruturada por periodo
- metadados das fontes
- avisos de cobertura incompleta

Essa ferramenta nao deve escolher os periodos sozinha. O usuario ou modelo consumidor deve passar as fases. Assim o MCP continua metodologico, mas nao opinativo.

### 6. Presets macroeconomicos pequenos

Recomendacao: adicionar atalhos para series muito comuns, sem transformar isso em uma analise pronta.

Exemplos:

```text
get_macro_series_preset
```

Presets possiveis:

- `usd_brl_sgs_sell`
- `selic_effective_daily`
- `selic_monthly`
- `selic_target`
- `cdi_daily`
- `ipca_monthly_bcb`
- `inpc_monthly_bcb`
- `igpm_monthly_bcb`

Saida deve continuar transparente: codigo SGS, nome, fonte, periodicidade e observacoes.

## Exportacao de dados

Uma ferramenta de exportacao faz sentido. Ela resolveria dois problemas praticos:

- Permitir que usuarios levem dados para Excel, Google Sheets, Power BI, R, Python ou bancos locais.
- Evitar que respostas grandes fiquem presas apenas em `structuredContent`.

### Formatos recomendados

#### JSON

JSON deve ser o formato nativo e principal.

Vantagens:

- Mantem metadados ricos.
- Preserva tipos e estrutura.
- E ideal para outros agentes, APIs, notebooks e pipelines.

Uso recomendado:

- Dados brutos normalizados.
- Dados transformados.
- Estatisticas e metadados da consulta.

#### CSV

CSV deve ser suportado desde cedo.

Vantagens:

- Excel, LibreOffice, Google Sheets e Power BI abrem facilmente.
- Nao exige dependencia pesada.
- Funciona bem para tabelas simples.

Cuidados:

- Usar UTF-8 com BOM opcional para melhor compatibilidade com Excel no Windows.
- Permitir separador `,` ou `;`. No Brasil, `;` costuma ser mais seguro quando decimais usam virgula.
- Manter datas em ISO `YYYY-MM-DD` para evitar ambiguidade.
- Numeros devem sair com ponto decimal por padrao tecnico, mas pode haver modo `locale=pt-BR`.

#### XLSX

XLSX e viavel, mas deve ser a terceira etapa, nao a primeira.

Viabilidade tecnica:

- O pacote atual nao inclui biblioteca para gerar XLSX.
- Em Node.js, bibliotecas como `exceljs` ou `xlsx` conseguem gerar arquivos `.xlsx`.
- O protocolo MCP suporta recursos com conteudo binario via `BlobResourceContents` em base64 e `mimeType`.
- O SDK atual tambem suporta registro de resources, e o projeto ja usa resource para o widget.

Tradeoffs:

- Adiciona dependencia nova.
- Aumenta complexidade de teste.
- Arquivos binarios podem ficar grandes.
- A experiencia de download depende do cliente/host MCP. Nem todo cliente trata um blob resource como um download amigavel.

Recomendacao: implementar CSV antes de XLSX. Depois implementar XLSX apenas se houver necessidade real de multiplas abas, formatos, formulas, congelamento de cabecalho ou uma experiencia melhor para usuarios de Excel.

### Ferramenta sugerida

```text
export_dataset
```

Entrada sugerida:

```json
{
  "source": "sgs",
  "query": {
    "code": 1,
    "startDate": "1994-07-01",
    "endDate": "2026-06-16"
  },
  "transforms": [
    { "type": "windowed" },
    { "type": "aggregate", "frequency": "monthly", "method": "last" }
  ],
  "statistics": ["first", "last", "min", "max", "change"],
  "format": "csv"
}
```

Formatos:

- `json`
- `csv`
- `xlsx`, fase posterior

Saida recomendada para JSON inline:

```json
{
  "format": "json",
  "mimeType": "application/json",
  "fileName": "bacen_sgs_1_1994-07-01_2026-06-16.json",
  "data": {},
  "metadata": {}
}
```

Saida recomendada para arquivo/recurso:

```json
{
  "format": "csv",
  "mimeType": "text/csv",
  "fileName": "bacen_sgs_1_monthly_last.csv",
  "resourceUri": "export://bacen/...",
  "expiresAt": "2026-06-17T23:59:59Z",
  "metadata": {}
}
```

### Estrategia de implementacao para export

Fase 1:

- `format=json`
- retorno inline em `structuredContent`
- sem armazenamento de arquivo

Fase 2:

- `format=csv`
- retorno como texto quando pequeno
- opcionalmente `resource` para conteudo maior

Fase 3:

- `format=xlsx`
- adicionar biblioteca dedicada
- retornar como resource binario com `mimeType`:

```text
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

Fase 4:

- armazenamento temporario em memoria ou diretorio de cache
- TTL para exports
- resource templates para ler `export://...`

## Limites recomendados

Para manter o MCP previsivel:

- Manter `maxRows` padrao conservador.
- Permitir exportacoes maiores que respostas normais, mas com limite explicito.
- Incluir `truncated`, `warnings` e `requestUrls` em toda resposta agregada/exportada.
- Nao executar codigo arbitrario do usuario.
- Nao aceitar formulas livres ou expressoes dinamicas no servidor.
- Nao criar arquivos locais permanentes sem uma decisao explicita de produto.

## Melhorias em schemas e metadados

### Datas normalizadas

As respostas SGS hoje preservam `date` no formato original do BACEN, como `DD/MM/YYYY`. Recomendo adicionar tambem:

```json
{
  "date": "01/07/1994",
  "isoDate": "1994-07-01"
}
```

Isso reduz ambiguidade e facilita joins com SIDRA, planilhas e ferramentas externas.

### Unidades e tipo economico

Adicionar metadados como:

- `unit`
- `periodicity`
- `valueKind`: `level`, `rate_percent`, `index`, `currency`
- `recommendedAggregation`
- `recommendedCompounding`

Exemplo:

```json
{
  "seriesCode": "4390",
  "unit": "%",
  "valueKind": "rate_percent",
  "recommendedCompounding": "compound_monthly"
}
```

Isso ajuda o modelo consumidor a nao somar IPCA mensal ou Selic mensal indevidamente.

### Cobertura e completude

Toda resposta historica deveria informar:

- primeira data disponivel retornada
- ultima data disponivel retornada
- frequencia esperada
- observacoes faltantes, quando detectavel
- se a serie foi truncada por `maxRows`

## Melhorias de catalogo

O catalogo local e util, mas pode crescer com foco em series macro recorrentes.

Sugestoes:

- IPCA numero-indice, se houver codigo SGS adequado.
- Reservas internacionais.
- Resultado primario/nominal.
- Divida bruta do governo geral.
- Cambio nominal efetivo, se disponivel.
- PIB mensal/IBC-Br.
- Expectativas Focus, se o MCP futuramente incluir outra fonte BACEN.

Cada entrada deveria conter:

- codigo
- nome curto
- nome oficial
- periodicidade
- unidade
- inicio aproximado
- categoria
- fonte
- observacoes metodologicas

## Ferramentas que eu evitaria

Evitaria criar ferramentas como:

- `analyze_economy`
- `forecast_inflation`
- `predict_exchange_rate`
- `run_regression`
- `find_best_model`
- `explain_causal_impact`

Essas ferramentas exigem escolhas metodologicas fortes, podem induzir conclusoes ruins e aumentam muito o escopo. Melhor deixar isso para notebooks, bibliotecas estatisticas, bancos analiticos ou agentes especializados.

## Roadmap sugerido

Ordem recomendada:

1. `get_sgs_series_windowed`
2. `aggregate_time_series`
3. `compound_rate_series`
4. `summarize_time_series`
5. `export_dataset` com JSON e CSV
6. `compare_series_periods`
7. XLSX via resource binario, se CSV nao for suficiente
8. Expansao cuidadosa do catalogo macro

Essa ordem resolve primeiro a dor real observada: a necessidade de scripts locais para tarefas basicas de coleta longa, composicao, agregacao e exportacao.

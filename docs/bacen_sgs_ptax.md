# BACEN: SGS e PTAX — Referência de APIs

Documentação de referência para integração com as duas principais APIs públicas de dados financeiros do Banco Central do Brasil: **SGS** (séries temporais macroeconômicas) e **PTAX** (cotações de câmbio). Ambas são gratuitas, não exigem autenticação e são mantidas pelo BCB.

---

## 1. SGS — Sistema Gerenciador de Séries Temporais

### O que é

Base de séries temporais econômicas e sociais do BCB (Selic, CDI, IPCA, câmbio, crédito, etc.), cada série identificada por um código numérico único. É a fonte mais geral — análoga, em espírito, ao SIDRA do IBGE, mas sem busca textual nativa por nome de série.

### Endpoint base

```
https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo_serie}/dados?formato=json&dataInicial={dataInicial}&dataFinal={dataFinal}
```

### Parâmetros

| Parâmetro | Obrigatório | Formato | Descrição |
|---|---|---|---|
| `codigo_serie` | sim | inteiro | Código numérico da série (vai na própria URL, não como query param) |
| `dataInicial` | não | `dd/MM/aaaa` | Início do período |
| `dataFinal` | não | `dd/MM/aaaa` | Fim do período |
| `formato` | sim | `json` \| `csv` \| `xml` | Formato de saída |

### Últimos N valores

Para pegar apenas os valores mais recentes sem especificar datas:

```
https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo_serie}/dados/ultimos/{N}?formato=json
```

> **Limite:** N é limitado a 20.

### Exemplo de chamada

```
https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados?formato=json&dataInicial=01/01/2023&dataFinal=31/12/2023
```

Resposta (formato padrão de todas as séries SGS):

```json
[
  { "data": "02/01/2023", "valor": "13,75" },
  { "data": "03/01/2023", "valor": "13,75" }
]
```

### Limitação de volume (desde 26/03/2025)

A diferença entre `dataFinal` e `dataInicial` não pode ser superior a 10 anos — consultas fora dessa janela retornam erro. Para séries históricas longas (ex: Selic desde os anos 1990), é necessário paginar em janelas de até 10 anos e concatenar os resultados no seu cliente.

### Descoberta de séries (códigos)

O SGS não tem um endpoint de busca textual. As formas de descobrir o código de uma série são:

- Localizador web do BCB (não é API, é página HTML): `https://www3.bcb.gov.br/sgspub/localizarseries/localizarSeries.do?method=prepararTelaLocalizarSeries`
- Bibliotecas de terceiros que mantêm dicionários de código já catalogados: [`python-bcb`](https://wilsonfreitas.github.io/python-bcb/) (Python) e [`rbcb`](https://github.com/wilsonfreitas/rbcb) (R), ambas mantidas por Wilson Freitas.
- Manter um dicionário estático próprio no seu servidor MCP com os códigos mais usados (tabela abaixo).

### Códigos de série mais usados

| Código | Série | Periodicidade |
|---|---|---|
| `1` | Dólar americano (venda) — taxa de câmbio livre | diária |
| `10813` | Dólar americano (compra) — taxa de câmbio livre | diária |
| `11` | Taxa Selic (efetiva) | diária |
| `432` | Meta Selic definida pelo Copom | diária |
| `12` | CDI | diária |
| `4390` | Selic acumulada no mês | mensal |
| `1178` | Selic anualizada base 252 | diária |
| `433` | IPCA — variação mensal | mensal |
| `188` | INPC | mensal |
| `189` | IGP-M | mensal |

### Fontes / documentação

- Portal de Dados Abertos do BCB (catálogo de cada série, com swagger e exemplos): https://dadosabertos.bcb.gov.br
- Exemplo de dataset de série (Selic): https://dadosabertos.bcb.gov.br/dataset/11-taxa-de-juros---selic
- Documentação técnica do webservice (PDF): http://catalogo.governoeletronico.gov.br/arquivos/Documentos/WS_SGS_BCB.pdf

---

## 2. PTAX — Cotações de Câmbio (via gateway Olinda)

### O que é

API dedicada a cotações de câmbio, com granularidade intradiária (boletins de abertura, intermediários e fechamento), separada do SGS e hospedada no gateway **Olinda**. Usa o protocolo **OData** em vez de REST simples — isso muda a forma de montar query strings.

### Endpoint base

```
https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/{recurso}?$format=json&{outros_parametros}
```

### Recursos disponíveis

| Recurso | Descrição |
|---|---|
| `Moedas` | Lista as moedas disponíveis para consulta |
| `CotacaoDolarDia` | Cotação de compra/venda do dólar em uma data específica |
| `CotacaoDolarPeriodo` | Cotação de compra/venda do dólar para um período |
| `CotacaoMoedaDia` | Cotação de qualquer moeda (paridade + cotação) em uma data |
| `CotacaoMoedaPeriodo` | Cotação de qualquer moeda para um período |

### Boletins por dia

Cada data tem **5 boletins**: um de Abertura, três Intermediários e um de Fechamento (o boletim de Fechamento é a taxa PTAX oficial usada como referência de mercado).

### Campos retornados (boletim de câmbio)

| Campo | Tipo | Descrição |
|---|---|---|
| `paridadeCompra` / `paridadeVenda` | number | Paridade da moeda contra o dólar |
| `cotacaoCompra` / `cotacaoVenda` | number | Cotação da moeda contra o Real |
| `dataHoraCotacao` | string | Data e hora da cotação |
| `tipoBoletim` | string | `Abertura` \| `Intermediário` \| `Fechamento Interbancário` \| `Fechamento` |

### Exemplos de chamada

Lista de moedas disponíveis:
```
https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/Moedas?$format=json
```

Cotação do dólar em uma data específica:
```
https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='06-16-2026'&$format=json
```

Cotação do dólar por período:
```
https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@dataInicial='06-01-2026'&@dataFinalCotacao='06-16-2026'&$format=json
```

> A sintaxe de parâmetros do OData usa `(param=@param)?@param='valor'`, diferente do `?param=valor` simples do SGS. Vale checar o Swagger antes de montar a query, pois o nome exato dos parâmetros varia por recurso.

### Histórico

A série de dólar comercial está disponível desde 28/11/1984. Até 1990 refletia taxas administradas; de 1990 a 2011, era a média das taxas efetivas do interbancário; desde julho de 2011, a Ptax é a média aritmética de quatro consultas diárias aos dealers de câmbio, com o boletim de Fechamento sendo a média dos boletins do dia.

### Fontes / documentação

- Dataset (todos os boletins, qualquer moeda): https://dadosabertos.bcb.gov.br/dataset/taxas-de-cambio-todos-os-boletins-diarios
- Dataset dedicado ao dólar: https://dadosabertos.bcb.gov.br/dataset/dolar-americano-usd-todos-os-boletins-diarios
- Swagger interativo: https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/swagger-ui3/

---

## 3. SGS vs. PTAX — quando usar cada uma

| | SGS | PTAX |
|---|---|---|
| Protocolo | REST simples | OData |
| Granularidade temporal | 1 valor por dia (ou frequência da série) | até 5 boletins por dia |
| Cobertura | Macro geral (juros, inflação, crédito, câmbio agregado) | Especificamente câmbio, com profundidade intradiária |
| Descoberta de dados | Sem busca textual nativa; precisa do código de antemão | Recurso `Moedas` lista moedas disponíveis |
| Limite de período | 10 anos por consulta | Não documentado um limite equivalente; recomenda-se paginar por segurança |

Para um MCP server: um dólar "do dia" ou série histórica de câmbio agregada pode vir do SGS (código `1`); já comparações intradiárias, ou cotação de moedas além do dólar, exigem PTAX.
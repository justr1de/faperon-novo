# Contrato da API v1

Fonte única de verdade entre `apps/api` (Django) e `apps/web` (Next.js). O Django gera o OpenAPI a partir do código (drf-spectacular, `/api/schema/`) e o front gera os tipos TS a partir dele. Este documento define os formatos que os dois lados assumem enquanto o schema não existe.

Todas as rotas ficam sob `/api/v1/`. O Next.js faz proxy de `/api/*` para o Django. Respostas em JSON UTF-8. Erros: `{"erro": "mensagem", "campos": {"param": "detalhe"}}` com HTTP 400 (parâmetro inválido), 404 (recurso inexistente) ou 422 (combinação inválida, ex.: unidades diferentes na comparação).

Limite de uso: todas as rotas têm um teto geral de 300 requisições por minuto por IP (variável `ANON_RATE_LIMIT`; o IP é o último do `X-Forwarded-For`, ADR 0023). Acima disso a API responde `429` com `Retry-After` e o corpo `{"erro": "...", "campos": {}}`. O PDF tem limites próprios (abaixo). Uma navegação normal (cerca de 10 chamadas por tela) fica longe do teto.

Convenções:

- `produto` e `indicador` usam **slug** (ex.: `soja-em-grao`, `quantidade-produzida`), nunca id numérico.
- `municipio` usa o **código IBGE de 7 dígitos** (ex.: `1100015`).
- `inicio` e `fim` são anos inteiros. `fim` é o ano de referência do ranking. Padrão quando ausentes: `fim` = último ano com dados do recorte, `inicio` = `fim - 9`.
- Valor ausente: `valor: null` e `status` explica (`ok`, `sigiloso` para "X", `inexistente` para "-", "..." e "0" não informado). Nunca zero no lugar de ausente.
- `meta` aparece em toda resposta de dados (SPEC-08): `{"fonte": "IBGE – Pesquisa Agrícola Municipal (PAM)", "tabela_sidra": 5457, "url_fonte": "https://sidra.ibge.gov.br/Tabela/5457", "atualizado_em": "2026-09-24T14:00:00Z"}`. `atualizado_em` é a conclusão da última Carga bem-sucedida da tabela.

## Catálogo

| Endpoint | Retorno |
| --- | --- |
| `GET /api/v1/produtos?segmento=agricultura\|pecuaria&q=` | `[{"slug","nome","segmento","tabela_sidra"}]` ordenado por nome; `q` filtra por nome sem acento |
| `GET /api/v1/indicadores?produto=<slug>` | `[{"slug","nome","unidade","agregacao"}]`; `agregacao` = `soma` \| `media_ponderada` \| `nao_agregavel`; `unidade` já é a do produto |
| `GET /api/v1/municipios` | `[{"codigo_ibge","nome"}]` dos 52 municípios de RO, nome sem o sufixo " - RO" |
| `GET /api/v1/meta` | `{"ultima_carga": ISO\|null, "cargas":[{"tabela","status","concluida_em","linhas"}], "anos": {"min","max"}}` |

## Destaques da home

`GET /api/v1/destaques` retorna, numa só chamada, o resumo dos indicadores exibidos na faixa "Rondônia em números" do Início (soja, milho, café canéfora, cacau, rebanho bovino e leite). Recortes sem dados são omitidos.

```json
{
  "itens": [
    {
      "chave": "soja", "rotulo": "Soja",
      "produto": {"slug": "soja-em-grao", "nome": "Soja (em grão)", "segmento": "agricultura"},
      "indicador": {"slug": "quantidade-produzida", "nome": "Quantidade produzida", "unidade": "Toneladas", "agregacao": "soma"},
      "ano_referencia": 2024, "total": 2221610.0,
      "serie": [{"ano": 2015, "valor": 747000.0, "status": "ok"}],
      "variacao_percentual": 197.4,
      "top": [{"municipio": {"codigo_ibge": "1101468", "nome": "Pimenteiras do Oeste"}, "valor": 197220.0, "percentual_total": 8.88}],
      "meta": {}
    }
  ],
  "meta": {"atualizado_em": "2026-09-24T14:00:00Z"}
}
```

A janela da série é a padrão (10 anos até o último ano com dados). `variacao_percentual` compara o primeiro e o último ponto com valor; é `null` com menos de dois pontos. `top` traz até 5 municípios com valor `ok`.

## Consultas do painel

Parâmetros comuns: `produto`, `indicador`, `inicio`, `fim`.

`GET /api/v1/ranking` retorna:

```json
{
  "produto": {"slug": "soja-em-grao", "nome": "Soja (em grão)", "segmento": "agricultura"},
  "indicador": {"slug": "quantidade-produzida", "nome": "Quantidade produzida", "unidade": "Toneladas", "agregacao": "soma"},
  "inicio": 2015, "fim": 2024, "ano_referencia": 2024,
  "total_estadual": 1234567.0,
  "itens": [
    {"posicao": 1, "municipio": {"codigo_ibge": "1100072", "nome": "Corumbiara"}, "valor": 183546.0, "status": "ok", "percentual_total": 14.87}
  ],
  "meta": {}
}
```

Ordem: `ok` por valor decrescente (`posicao` 1..n), depois `sigiloso` (`posicao: null`, `valor: null`, exibido como "X"), depois `inexistente`. Sempre os 52 municípios. `total_estadual` é a soma para `soma`; média ponderada para `media_ponderada` (rendimento = produção ÷ área colhida do mesmo ano); `null` para `nao_agregavel`. `percentual_total` é `null` quando o total não existe ou para indicadores não somáveis.

`GET /api/v1/serie?...&municipio=` retorna `{"produto","indicador","municipio": null | {"codigo_ibge","nome"}, "inicio","fim","pontos":[{"ano","valor","status"}], "meta"}`. Sem `municipio`, o ponto é o total de RO (regra de `agregacao`); ponto sem nenhum dado vira `valor: null`.

`GET /api/v1/comparacao` aceita dois modos:

- `produto`, `indicador`, `municipios=1100015,1100023` (2 a 5 códigos distintos; repetidos contam uma vez) → `"modo": "municipios"`.
- `produtos=soja-em-grao,milho-em-grao` (2 a 5 slugs distintos; repetidos contam uma vez, e a contagem é validada antes de consultar o banco), `indicador`, `municipio?` opcional (sem ele, total RO) → `"modo": "produtos"`. Retorna 422 se as unidades dos produtos diferirem.

Resposta: `{"modo","indicador","unidade","inicio","fim","anos":[2015,...],"series":[{"id","nome","pontos":[{"ano","valor","status"}]}],"meta"}`.

`GET /api/v1/analise?...&municipio?` retorna:

```json
{
  "titulo": "Soja (em grão) — Quantidade produzida, 2015–2024",
  "paragrafos": ["A quantidade produzida de Soja (em grão) em Rondônia passou de ... para ... (+123,4%) ..."],
  "metricas": {
    "variacao_absoluta": 100.0, "variacao_percentual": 12.3, "cagr_percentual": 3.1,
    "maior_ano": {"ano": 2024, "valor": 1.0}, "menor_ano": {"ano": 2015, "valor": 1.0},
    "top5": [{"municipio": {"codigo_ibge": "1100072", "nome": "Corumbiara"}, "valor": 1.0, "percentual": 14.9}],
    "concentracao_top5_percentual": 55.2
  },
  "meta": {}
}
```

Métricas indisponíveis (ex.: início zero, `nao_agregavel` sem total) ficam `null` e o texto omite a frase correspondente. A análise é determinística: mesma entrada, mesmo texto.

`GET /api/v1/relatorio.pdf?...&municipios=` retorna `application/pdf` com `Content-Disposition: attachment; filename="faperon-<produto>-<indicador>-<inicio>-<fim>.pdf"`. Aceita os mesmos parâmetros da análise mais `municipios` (comparação, opcional). Cache por recorte e por Carga; rate limit por IP (429 com `Retry-After`).

## Observatório

Quatro rotas somente de leitura, uma por bloco da página `/central-de-inteligencia/observatorio`. Cada bloco é independente: um parâmetro inválido em um deles responde 400 só para aquela rota e não afeta as outras.

| Rota | Parâmetros (todos opcionais) | Padrões |
|---|---|---|
| `GET /api/v1/observatorio/panorama` | `ano` (inteiro, 1974 a 2100), `janela` (`5`, `10` ou `20`) | `ano` = último ano com dados do valor da produção (só aparecem anos a partir de 1995, o piso do IPCA); `janela` = `10` |
| `GET /api/v1/observatorio/crescimento` | `cultura` (slug), `inicio`, `fim` (anos de 1974 a 2100) | `cultura` = a de maior valor da produção no último ano com dados; `fim` = último ano com dados; `inicio` = `fim - 9` |
| `GET /api/v1/observatorio/territorio` | `metrica` (`valor`, `area`, `rebanho`, `dominante`), `cultura` (slug), `ano` (1974 a 2100) | `metrica` = `valor`; `cultura` = nenhuma (todas; ignorada com `rebanho` e `dominante`, que a devolvem `null`); `ano` = último ano com dados |
| `GET /api/v1/observatorio/pecuaria` | `rebanho` (slug), `inicio`, `fim` (anos de 1974 a 2100) | `rebanho` = `bovino`; `fim` = último ano com dados; `inicio` = `fim - 9` |

Os valores efetivamente usados voltam em `filtros.valores`; as escolhas possíveis, em `filtros.opcoes`. Valores monetários são **reais**: corrigidos pelo IPCA médio anual e expressos a preços do ano `qualidade.ano_ref_monetario`.

### Forma comum

```json
{
  "filtros": {"valores": {}, "opcoes": {}},
  "metricas": {},
  "series": {},
  "texto": {"manchete": "Frase de uma linha com o achado principal.", "como_ler": ["Parágrafo 1.", "Parágrafo 2."]},
  "qualidade": {"municipios_sigilosos": 1, "ano_ref_monetario": 2024, "avisos": ["..."]},
  "meta": {
    "fontes": [{"fonte": "IBGE – Pesquisa Agrícola Municipal (PAM)", "tabela_sidra": 5457, "url_fonte": "https://sidra.ibge.gov.br/Tabela/5457"}],
    "atualizado_em": "2026-10-01T12:00:00Z"
  }
}
```

- `meta.fontes` é uma lista (cada bloco combina PAM, PPM e/ou IPCA); `atualizado_em` é a conclusão da última Carga bem-sucedida.
- `qualidade.municipios_sigilosos`: municípios com dado sigiloso ("X") que ficaram fora de somas, rankings ou conclusões do bloco.
- `qualidade.ano_ref_monetario`: ano dos preços; `null` quando não há como corrigir valores e também no `territorio` com `metrica=area` ou `rebanho`, que não usam IPCA.
- Opções de seleção são `{"slug", "nome"}`; `anos` é lista de inteiros.
- `metricas` e `series` podem vir **vazios (`{}`)** com HTTP 200 quando não há o que mostrar (sem dados no recorte ou sem IPCA); o motivo está em `qualidade.avisos` (e em `texto.manchete`). Métrica individual indisponível vem `null`. Ausente nunca é zero. Em `territorio` as `metricas` (`total`, `top5_pct`, `hhi`, `concentracao`) também podem ser `null` individualmente.

#### `avisos`: semântica

`qualidade.avisos` é uma lista de frases prontas para exibir, em português, sem códigos. Hoje:

- **Sem dado** (`Não há dados publicados pelo IBGE para este recorte.`): o recorte existe mas o IBGE não publicou nada; `metricas`/`series` vazios.
- **IPCA ausente** (`Não é possível calcular valores reais: o IPCA necessário ... não está disponível.`): faltam índices de preço. Só as partes monetárias degradam (lista vazia, `ano_ref_monetario: null`); métricas físicas (área, rebanho, produção) continuam. Não é o mesmo que "sem dado".
- Sem IPCA, no `panorama` e no `territorio` com `metrica=valor` a resposta tem `metricas` e `series` vazios (`{}`); no `crescimento` só `valor_por_hectare` fica vazio; na `pecuaria` só `leite.valor_real` fica `null`; no `territorio` com `metrica=dominante` o município pode ter `status: "ok"` com `valor: null`, e `ano_ref_monetario` passa a `null`.
- Avisos e onde aparecem: sem carne bovina (o valor soma PAM + PPM e a PPM não publica carne nem abate) → só `panorama`; IPCA do ano pedido ainda não fechado (valores a preços de outro ano) → blocos monetários; período começa depois do pedido (antes do Plano Real não há correção) → `panorama`; ano final anterior a 1995, sem correção possível (o valor por hectare não é calculado) → `crescimento`; sigilo parcial (`N município(s) com dado sigiloso para alguma cultura fica(m) sem cultura dominante e fora da lista de dependentes.`) → só `territorio`; variação do rebanho calculada sobre a base comum de municípios dos dois anos, e sigilo no rebanho/leite (`... fica(m) fora dos totais e do ranking; o principal polo pode ser outro.`) → só `pecuaria`.

### `panorama`

- `filtros.valores`: `{ano, janela, inicio}`; `opcoes`: `{anos, janelas}`.
- `metricas`: `valor_total_real`, `valor_lavouras_real`, `valor_origem_animal_real`, `variacao_real_pct`, `area_colhida_ha`.
- `series.composicao`: `[{slug, nome, valor, participacao}]` (mil reais reais; `participacao` em %; o último item pode ser `demais`).
- `series.evolucao`: `{anos: [int], itens: [{slug, nome, valores: [float|null]}]}`, um valor por ano em `anos`.

### `crescimento`

- `filtros.valores`: `{cultura, inicio, fim}`; `opcoes`: `{culturas: [{slug, nome}], anos}`.
- `metricas`: `variacao_producao_pct`, `parte_area_pct`, `parte_rendimento_pct` (decomposição; somam 100), `perda_media_pct`, `perda_ultimo_ano_pct` (cada uma pode ser `null`).
- `series.indices`: `{anos, area, rendimento, producao}`, números-índice com base 100 no primeiro ano.
- `series.perda`: `[{ano, valor}]` (% da área plantada não colhida; `valor` pode ser `null`). Anos fora dos dados devolvem 200 com séries `null`, não erro.
- `series.valor_por_hectare`: `[{slug, nome, valor, participacao: null}]` (reais por hectare, ano final).

### `territorio`

- `filtros.valores`: `{metrica, cultura, ano}`; `opcoes`: `{metricas: [{slug, nome, unidade}], culturas, anos}`.
- `metricas`: `unidade`, `total`, `top5_pct`, `hhi` (0 a 10.000), `concentracao` (`baixa`, `moderada` ou `alta`).
- A métrica `valor` é o valor da produção das **lavouras** (PAM, sem origem animal): seu nome em `opcoes.metricas` é "Valor da produção das lavouras", e a manchete diz "do valor das lavouras". A frase sobre municípios dependentes só aparece nas métricas `valor` e `dominante`.
- `series.municipios`: os 52 municípios, `[{codigo_ibge, nome, microrregiao, valor, status, categoria}]`. `status` é `ok`, `sigiloso` ou `sem_dado`; nos dois últimos `valor` é `null` (nunca 0). `categoria` é o slug da cultura dominante (só com `metrica=dominante`) ou `outras` quando a dominante não está entre as 8 principais; `null` quando sigiloso/desconhecido.
- `series.microrregioes`: `[{nome, valor}]`.
- `series.dependentes`: `[{codigo_ibge, nome, cultura, participacao}]` (municípios com mais da metade do valor agrícola em uma cultura).
- `series.categorias`: `[{slug, nome}]`, legenda do mapa (vazia fora de `dominante`; inclui `{slug: "outras", nome: "Outras"}` quando algum município usa essa categoria).
- `metricas.unidade` é `""` em `dominante`. `metricas` e `series` vêm `{}` quando não há dados.

### `pecuaria`

- `filtros.valores`: `{rebanho, inicio, fim}`; `opcoes`: `{rebanhos: [{slug, nome}], anos}`.
- `metricas`: `efetivo_final`, `variacao_pct`, `top5_pct` e `leite: {volume_mil_litros, valor_real, produtividade_l_vaca, variacao_produtividade_pct}` (`leite` é `null` quando não há volume de leite no ano final).
- `series.efetivo`: `[{ano, valor}]`; `series.municipios`: `[{codigo_ibge, nome, valor}]` (ordenado, maiores primeiro); `series.composicao`: `[{slug, nome, valor, participacao}]`; `series.leite_polos`: `[{codigo_ibge, nome, volume, produtividade}]`.

### Erros

Mesmo formato do restante da API: `{"erro": "Parâmetros inválidos", "campos": {"janela": "\"7\" não é uma escolha válida."}}`.

- `400`: `janela`/`metrica` fora das escolhas, slug malformado, valor não numérico, `ano`, `inicio` ou `fim` fora de 1974 a 2100 (o teto impede janelas gigantes), `inicio > fim` (`campos: {"inicio": "maior que fim"}`), e `ano` sem dados **só em `panorama` e `territorio`** (`campos: {"ano": "use um ano entre 1994 e 2025"}`). Em `crescimento` e `pecuaria`, `inicio`/`fim` fora do período com dados **não** dão 400: a resposta é 200 com valores `null`. Os anos percorridos nas séries são cortados ao intervalo com dados (ex.: `inicio=1980&fim=2090` com dados de 2015 a 2024 devolve 2015 a 2024); janela inteiramente fora dos dados mantém os anos pedidos, todos `null`.
- `404`: `cultura` ou `rebanho` inexistente (`{"erro": "Cultura 'xxx' não existe", "campos": {}}`).
- Ausência de dados **não** é erro: responde 200 com `metricas`/`series` vazios e o motivo em `qualidade.avisos`.

### Agregação do café

Somas e composições entre produtos contam o café da PAM uma vez só: o "Café (em grão) Total" é mantido e os componentes "Café (em grão) Canephora" e "Café (em grão) Arábica" ficam fora das agregações entre produtos quando o Total existe. Pedir `cultura=cafe-em-grao-canephora` (ou `-arabica`) explicitamente continua devolvendo esse produto.

### Composição dos rebanhos (`pecuaria`)

A `series.composicao` mantém o agregado e tira o subconjunto, pela mesma lógica do café: `galinaceos-total` fica e `galinaceos-galinhas` sai; `suino-total` fica e `suino-matrizes-de-suinos` sai. Assim a soma não esconde cabeças (em Rondônia o total de galináceos é cerca de 3 vezes o de galinhas).

## Crédito rural (SICOR)

Quatro rotas somente de leitura para a página `/credito-rural`, com o crédito rural contratado em Rondônia segundo a Matriz de Dados do Crédito Rural (SICOR) do Banco Central. Detalhes e motivos: ADR 0036.

Parâmetros (todos opcionais e iguais nas quatro rotas):

| Parâmetro | Valores | Padrão |
|---|---|---|
| `ano` | inteiro de 2000 a 2100; só anos com dado (fora deles, 400 com `campos: {"ano": "use um ano entre 2018 e 2026"}`) | o último ano com dado |
| `municipio` | código IBGE de 7 dígitos ou slug do nome (`ji-parana`, `alta-floresta-doeste`); inexistente → 404 | Rondônia inteira |
| `programa` | `pronaf`, `pronamp` ou `demais` (outros programas e sem programa) | todos |
| `finalidade` | `custeio`, `investimento`, `comercializacao` ou `industrializacao` | todas |

Forma comum:

```json
{
  "filtros": {
    "valores": {"ano": 2026, "municipio": null, "programa": null, "finalidade": null},
    "opcoes": {"anos": [2018, 2026], "municipios": [{"codigo_ibge": "1100122", "nome": "Ji-Paraná", "slug": "ji-parana"}],
               "programas": [{"slug": "pronaf", "nome": "Pronaf"}], "finalidades": [{"slug": "custeio", "nome": "Custeio"}]}
  },
  "metricas": {},
  "series": {},
  "qualidade": {"ano_completo": false, "meses_com_dado": 9, "mes_mais_recente": "2026-09", "avisos": ["2026 tem dados de janeiro a setembro: ..."]},
  "meta": {"fontes": [{"fonte": "Banco Central do Brasil, Matriz de Dados do Crédito Rural (SICOR)", "url_fonte": "https://www.bcb.gov.br/estabilidadefinanceira/micrrural", "licenca": "ODbL"}],
           "atualizado_em": "2026-10-18T12:00:00Z"}
}
```

- Valores em **reais nominais** (sem IPCA). `filtros.valores.municipio` é `{codigo_ibge, nome, slug}` ou `null`.
- **Período comparável:** o ano vai até o último mês publicado no estado (`qualidade.meses_com_dado`); `qualidade.ano_completo` é `false` antes de dezembro, com um aviso. `mes_mais_recente` é o último mês da série inteira (`AAAA-MM`).
- **Ausente nunca é zero:** município sem contrato num mês já publicado tem valor `0` (zero de verdade); mês ainda não publicado é `null`. Sem nenhuma carga ainda, as quatro rotas devolvem 200 com `metricas` e `series` vazios, `ano: null` e o aviso "Os dados do crédito rural ainda não foram carregados…".

`GET /api/v1/credito/resumo`:

- `metricas`: `valor_total`, `contratos`, `valor_medio` (`null` sem contratos), `valor_pronaf`, `participacao_pronaf_pct` (Pronaf no total do recorte **sem** o filtro de programa; `null` com total zero), `valor_ano_anterior` e `variacao_pct` (mesmos meses do ano anterior, mesmo recorte; `null` sem o ano anterior), `area_custeio_ha`.
- `series.programas`, `series.finalidades` e `series.atividades`: `[{slug, nome, valor, contratos, participacao}]`, sempre com todos os itens (zero quando não houve contrato). `programas` ignora o filtro de programa.
- `texto`: `{manchete, como_ler}` (frases prontas).

`GET /api/v1/credito/serie`: `series.mensal` são os 12 meses do ano, `[{mes, valor, contratos, valor_pronaf, valor_ano_anterior}]` (`null` depois do último mês publicado); `series.anual` é `[{ano, valor, contratos, valor_pronaf, meses, completo}]` para todos os anos com dado. `metricas` vem `{}`.

`GET /api/v1/credito/ranking`: `series.municipios` tem os 52 municípios em ordem de valor, `[{posicao, codigo_ibge, nome, slug, microrregiao, valor, contratos, valor_por_contrato, participacao_pct}]` (`valor_por_contrato` é `null` sem contratos). O filtro `municipio` não se aplica. `metricas`: `valor_total`, `top5_pct`.

`GET /api/v1/credito/por-produto`: `series.produtos` são os 12 produtos de maior valor mais um item `{slug: "demais", nome: "Demais produtos (N)"}` com o resto, `[{slug, nome, atividade, valor, participacao_pct, area_ha}]` (custeio e investimento; o BCB não publica contratos por produto). Com `finalidade=comercializacao` ou `industrializacao`, `series` vem `{}` e o motivo vai em `qualidade.avisos`. `metricas`: `valor_total`, `produtos` (quantos produtos distintos).

## Zétele (assistente do site)

Detalhes e motivos: ADR 0029, ADR 0030 e ADR 0032 (canal público).

`GET /api/v1/zetele/estado` → `200 {"disponivel": bool, "motivo": null | "sem_chave" | "orcamento_diario" | "indisponivel"}`. Não chama o modelo.

`POST /api/v1/zetele/perguntar`, corpo JSON:

```json
{"pergunta": "Qual município mais produz soja em Rondônia?",
 "historico": [{"papel": "visitante", "texto": "..."}, {"papel": "zetele", "texto": "..."}],
 "pagina": "/painel"}
```

- `pergunta`: 1 a 500 caracteres. `historico`: até 6 mensagens de até 1.200 caracteres; `papel` é `visitante` ou `zetele`. `pagina`: `/`, `/central-de-inteligencia`, `/central-de-inteligencia/observatorio` ou `/painel`. No `/` o Zétele só orienta (sem consultar dados).
- `200`: `{"status": "respondida" | "recusada" | "erro", "texto": "...", "fontes": [{"rotulo", "url_fonte", "url_interna", "atualizado_em"}], "sugestoes": ["..."]}`. `fontes` é montado pelo servidor; o texto só tem links Markdown para rotas do site, para as URLs das fontes, para os hosts da lista (IBGE, CNA, FAPERON) e para o WhatsApp oficial.
- `400 {"erro": "Parâmetros inválidos", "campos": {...}}`; `429` com `Retry-After` (6/min por IP, 30/min no total); `503 {"erro", "motivo"}` com `Retry-After` (`sem_chave`, `orcamento_diario` (200/dia), `indisponivel`, `ocupado` (3 simultâneas por processo)).
- O proxy do Next aceita POST com corpo de até 16 KB.

## Zétele do sistema e agendamento por voz

Detalhes e motivos: ADR 0032. Base de conhecimento, tabela de perguntas e limites próprios, separados do Zétele do site.

`GET /api/v1/sistema/zetele/estado` → igual ao do site, mas com o teto diário do sistema (`ZETELE_SISTEMA_LIMITE_DIARIO`, 250 por padrão, contando a voz).

`POST /api/v1/sistema/zetele/perguntar`: mesmo corpo e mesmas respostas do `/api/v1/zetele/perguntar`, com `pagina` entre `/sistema`, `/sistema/agenda`, `/sistema/frotas`, `/sistema/espacos`, `/sistema/contas`, `/sistema/relatorios` e `/sistema/atividades`. Não usa ferramentas de dados. Limites: `429` a 10/min por IP e 30/min no total.

`POST /api/v1/sistema/interpretar`, corpo JSON:

```json
{"tipo": "evento" | "reserva" | "espaco" | "atividade", "texto": "reunião com o sindicato terça às nove",
 "hoje": "2026-10-17", "veiculos": [{"id": "...", "descricao": "Toyota Hilux (QRB2F41)"}],
 "espacos": [{"id": "auditorio", "descricao": "Auditório"}]}
```

- `texto`: até 500 caracteres (a transcrição não é gravada). `veiculos`: até 20; `espacos`: até 10.
- `200 {"tipo", "campos": {...}, "faltando": ["data", ...]}`: campos conferidos em código (datas reais, horas `HH:mm` com fim depois do início, veículo e espaço da lista); o que não passa volta vazio.
- `422` quando o modelo recusa ou foge do formato; `429` e `503` como no Zétele do sistema (a voz gasta o mesmo teto diário).

## Voz do Zétele do sistema (ouvir e falar)

Detalhes e motivos: ADR 0034. Só no canal sistema. Não confundir com o `/api/v1/sistema/interpretar` do "Agendar por voz".

`GET /api/v1/sistema/zetele/estado` também traz `"voz": {"ouvir": bool, "falar": bool}`. `ouvir` é falso sem `GROQ_API_KEY` e `falar` é falso sem `GEMINI_API_KEY`: o front esconde o microfone ou o botão "Ouvir".

`POST /api/v1/sistema/zetele/ouvir`, corpo `multipart/form-data` com o campo `audio`:

- até 3 MB; tipo e extensão entre flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav e webm (ex.: `pergunta.webm` com `audio/webm;codecs=opus`, `pergunta.mp4` com `audio/mp4`);
- `200 {"texto": "..."}` (até 500 caracteres): só transcreve; quem envia a pergunta é o `/perguntar`. **Não conta** no teto diário;
- `400 {"erro": "Parâmetros inválidos", "campos": {"audio": [...]}}` (tipo, extensão ou tamanho); `413` quando o corpo passa de 3 MB + 64 KB; `415` fora de multipart; `422` quando não há fala no áudio.

`POST /api/v1/sistema/zetele/falar`, corpo JSON `{"texto": "..."}` (até 4.000 caracteres):

- `200` com `Content-Type: audio/wav` (24 kHz, mono, 16 bits) e `Cache-Control: no-store`. O servidor tira markdown, links, listas e emojis e lê até 1.200 caracteres, cortando na última frase inteira;
- **conta** no teto diário do sistema (`ZETELE_SISTEMA_LIMITE_DIARIO`), e a contagem é devolvida se a síntese falhar;
- `400` quando não sobra nada para ler; `415` fora de JSON.

Nas duas rotas:

- `429` com `Retry-After`: 10/min por IP e 30/min no total, somando ouvir e falar;
- `503 {"erro", "motivo"}` com `Retry-After`:
  - `voz_desligada`: sem chave do fornecedor;
  - `orcamento_diario`;
  - `indisponivel`: fornecedor fora (2 minutos de descanso só daquela metade da voz) ou disjuntor do Zétele aberto;
  - `ocupado`.
- O proxy do Next aceita multipart de até 3 MB + 64 KB só no `/ouvir`.

## Saúde

`GET /api/v1/saude` → `{"status": "ok", "banco": "ok"}` (usado pelo healthcheck do Compose).

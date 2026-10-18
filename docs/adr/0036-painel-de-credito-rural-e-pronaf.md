# ADR 0036: Painel de crédito rural e Pronaf com a matriz SICOR do Banco Central

Status: Aceita

## Contexto

A pesquisa de fontes de 18/10/2026 (`docs/pesquisa/2026-10-18-fontes-idaron-mapa-mda.md`) apontou o SICOR, a Matriz de Dados do Crédito Rural do Banco Central, como a fonte prática do Pronaf por município: o MDA quase não publica dado próprio e o IDARON não tem dado aberto. A Central de Inteligência ganha uma terceira porta, `/credito-rural`, com o crédito contratado em Rondônia por município, mês, programa, finalidade e produto.

## Fonte, licença e carga

- **Serviço:** OData sem chave em `https://olinda.bcb.gov.br/olinda/servico/SICOR/versao/v2/odata/`, licença **ODbL**. A página e a API trazem a atribuição "Fonte: Banco Central do Brasil, Matriz de Dados do Crédito Rural (SICOR)".
- **Recursos usados** (conferidos no `$metadata`):
  - `CusteioInvestimentoComercialIndustrialSemFiltros`: quantidade e valor de custeio, investimento, comercialização e industrialização, com área de custeio e de investimento, por município (código do BCB e código IBGE), mês, programa e atividade. É a base dos totais e dos contratos.
  - `CusteioMunicipioProduto` e `InvestMunicipioProduto`: valor e área por produto. Não trazem quantidade de contratos, e o de investimento não traz o código IBGE (o mapa código do BCB → IBGE sai do primeiro recurso). A comercialização só existe por UF, então não há detalhe por produto dela nem da industrialização.
- **Códigos:** `cdEstado` é do BCB (RO = `'22'`); `cdPrograma` `0001` = Pronaf, `0050` = Pronamp, o resto (inclusive `0999`, sem programa) vira "demais"; `Atividade` `1` = agrícola, `2` = pecuária.
- **Armadilhas verificadas:** o serviço não aceita `$skip` (responde 500 "Erro desconhecido"), então a paginação é por período: o cliente pede o ano com `$top` de 20.000 e, se a resposta enche, pede mês a mês; um mês que ainda enche é erro, para nunca somar pela metade. Espaços do `$filter` precisam ir como `%20` (com `+` o serviço responde 400). Chamadas simultâneas recebem 500 com frequência; o cliente faz uma por vez, com novas tentativas e espera crescente (4 tentativas, 5 s, 10 s, 20 s). Cada chamada leva de 5 a 20 s.
- **Carga:** `credito/carga.py` carrega um ano de emissão por vez numa transação (upsert pelo índice único; o que a fonte deixou de publicar naquele ano sai). Falha mantém os dados anteriores e fica em `carga_credito`. Fonte vazia num ano que já tinha dados é falha, não apagamento. Municípios fora do cadastro (`dim_municipio`) são descartados com aviso no log; sem cadastro, a carga falha.
- **Comando:** `python manage.py carregar_sicor [--desde 2018] [--ate N] [--ano N]`.
- **Agendador:** o `run_scheduler` confere o crédito uma vez por dia, antes da ingestão do IBGE (o BCB atualiza a matriz por mês, sem data fixa). Com a tabela vazia, carrega a série desde 2018; depois, os dois últimos anos (o BCB revisa o ano anterior) e todo ano da série que nunca carregou com sucesso. Depois de uma tentativa, espera 6 h. Uma falha do crédito nunca derruba a ingestão do IBGE.

## Modelo agregado

App `credito`, com o município reaproveitado de `indicadores.Municipio` (código IBGE):

- `fato_credito` (`CreditoMunicipio`): município, ano, mês, programa (`pronaf`, `pronamp`, `demais`), finalidade (`custeio`, `investimento`, `comercializacao`, `industrializacao`) e atividade (`agricola`, `pecuaria`), com contratos, valor (R$) e área financiada (só custeio e investimento). Índice único nas seis chaves.
- `fato_credito_produto` (`CreditoProduto`): as mesmas chaves mais o produto (slug e nome normalizados: sem aspas e com só a inicial maiúscula), com valor e área; sem contratos, que o BCB não publica por produto.
- `carga_credito`: ano, status, linhas, datas e erro.

Ausente nunca é zero: só há linha para o que a fonte publicou com valor ou contratos. Município sem linha num mês já publicado não contratou crédito naquele mês (zero de verdade, mostrado como R$ 0); mês ainda não publicado é nulo em todos os municípios.

## Comparação de períodos

O período do ano escolhido vai de janeiro até o último mês publicado no estado inteiro (ex.: janeiro a setembro de 2026). A variação compara esse período com os mesmos meses do ano anterior, com o mesmo filtro de município, programa e finalidade. Ano incompleto vem com aviso em `qualidade.avisos`, e `qualidade.ano_completo` diz se o ano fechou. Sem o ano anterior carregado, a variação é nula. A participação do Pronaf é calculada no total do recorte sem o filtro de programa. Os valores são nominais (sem IPCA), o que a nota metodológica diz.

## O que fica de fora

- Operações individuais e valores por produtor: o painel só usa totais por município e mês, que é o que a matriz agregada publica.
- Instituição financeira, fonte de recursos, subprograma, faixa de valor e sexo do tomador (existem em outros recursos do SICOR, sem município ou fora do escopo desta entrega).
- Uma ferramenta de números do Zétele para o crédito: nesta entrega o Zétele público só orienta na página (base pública e perguntas prontas).

## Seed

O crédito **não** entra no `faperon-seed.json.gz`. Num servidor novo, o `seed --if-empty` do serviço `api` restaura o cadastro de municípios antes de o `scheduler` subir (ele depende da API saudável), e a primeira passada do agendador carrega a série desde 2018 em poucos minutos (3 chamadas por ano). Assim o seed continua só com dados do IBGE, sem uma segunda versão de formato, e o painel fica vazio só nesses primeiros minutos, com o aviso "Os dados do crédito rural ainda não foram carregados".

## Consequências

- Rotas `GET /api/v1/credito/resumo`, `serie`, `ranking` e `por-produto` (contrato em `docs/api-contract.md`).
- Página `/credito-rural`, terceira porta da Central, no sitemap e com o Zétele público (base `zetele/conhecimento/publico/credito-rural.md`).
- Se o BCB mudar os nomes dos recursos ou dos campos, a carga falha com mensagem e mantém os dados anteriores.

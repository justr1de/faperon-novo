# Épico 11: Mesa de processos (substituta da Ping)

Situação: **desenho em revisão** (05/11/2026). Desenho completo em `docs/superpowers/specs/2026-11-05-mesa-de-processos-design.md`.

## Objetivo

Substituir a Ping. como sistema de processos da FAPERON, com mesa por departamento, editor de documentos com modelos prontos e assinador próprio, importando os processos da Ping com o número original. A troca é por departamento, começando pelo COMINST, sem data fixa.

## Regras de trabalho deste épico (pedido do usuário em 05/11/2026)

- Cada ticket só fecha com a suíte inteira verde (pytest, vitest, tsc, eslint e o e2e do fluxo afetado), revisão pelo Opus e commit.
- Backup: push do branch `feat/mesa-de-processos` para o remoto `fork` ao fim de cada entrega e depois de tickets grandes. Nunca no `main` do `origin` sem confirmação, porque ele publica o site.
- Erros cometidos pelo caminho vão para `docs/erros-conhecidos/dificuldades.md`, na seção "Mesa de processos".

## Situação dos tickets

Legenda: **A fazer**, **Em andamento**, **Feito** (com o commit), **Bloqueado** (com o motivo).

### Entrega 0: preparação

| Ticket | Descrição | Situação |
|---|---|---|
| 11.0.1 | Desenho (spec) e tickets do épico | Em revisão |
| 11.0.2 | Plano de implementação da entrega 1 (skill writing-plans) | A fazer |
| 11.0.3 | Dados da FAPERON: tipos de processo da Ping com códigos, departamentos e siglas, pessoas do COMINST com papéis | Aguardando o usuário |
| 11.0.4 | Modelos de documento da Ping (COMINST primeiro) | Aguardando o usuário |

### Entrega 1: núcleo da mesa (ADR 0038)

| Ticket | Descrição | Situação |
|---|---|---|
| 11.1.1 | App `organizacoes` com a FAPERON; apps `processos` com `Unidade`, `Lotacao`, `TipoProcesso`, `TipoDocumento` e admin | A fazer |
| 11.1.2 | `Numerador` sem buracos e número no padrão da Ping (formatar, ler, validar), com teste de concorrência | A fazer |
| 11.1.3 | `Processo`, `ProcessoNaUnidade` e `Andamento` imutável com cadeia de hash, gatilho no banco e comando `verificar_cadeia` | A fazer |
| 11.1.4 | Serviço de domínio: abrir, enviar (várias mesas, manter aberto, retorno programado), atribuir, prazo, concluir aqui, reabrir, sobrestar, retomar, ciência, comentário | A fazer |
| 11.1.5 | Permissões (`visiveis_para`, `pode_agir`) com a matriz de testes | A fazer |
| 11.1.6 | Documentos externos: upload conferido pelo conteúdo, SHA-256, armazenamento (disco e S3), cancelar com motivo | A fazer |
| 11.1.7 | Organização da mesa: marcadores, anotações, acompanhamento, visões salvas | A fazer |
| 11.1.8 | Relacionar processos e exportar o PDF do processo (capa, andamentos, documentos, folhas numeradas) | A fazer |
| 11.1.9 | "Remeter à Ping" | A fazer |
| 11.1.10 | API REST da mesa e do processo (DRF, OpenAPI, tipos gerados no front) | A fazer |
| 11.1.11 | Tela da mesa: seletor de mesa, abas, colunas, filtros rápidos, painel lateral, ações em lote, busca por número | A fazer |
| 11.1.12 | Telas de abrir processo e da página do processo (árvore de documentos, linha do tempo, ações, visualizador de PDF) | A fazer |
| 11.1.13 | Telas de cadastro (mesas, lotações, tipos, marcadores) | A fazer |
| 11.1.14 | e2e do núcleo, ADR 0038, erros conhecidos e backup | A fazer |

### Entrega 2: editor e modelos (ADR 0039)

| Ticket | Descrição | Situação |
|---|---|---|
| 11.2.1 | Modelos `ModeloDocumento` (com versão), `ConteudoDocumento`, `VersaoDocumento`, `Trecho`, `PapelTimbrado` | A fazer |
| 11.2.2 | Geração do PDF (WeasyPrint) com papel timbrado, marca d'água de minuta e exportação para Word | A fazer |
| 11.2.3 | Numeração de documentos por tipo, unidade e ano, e o código de verificação | A fazer |
| 11.2.4 | Editor TipTap: barra de ferramentas, tabela, imagem, quebra de página, campos e trechos | A fazer |
| 11.2.5 | Tela "Incluir documento": formulário dos campos mais o editor mais a pré-visualização, com salvamento automático e controle de edição simultânea | A fazer |
| 11.2.6 | Histórico e comparação de versões | A fazer |
| 11.2.7 | Gestão de modelos pelo administrador (editor de campos, publicar versão) | A fazer |
| 11.2.8 | Biblioteca inicial de modelos (os da Ping; na falta, a lista de referência do desenho) | Depende do 11.0.4 |
| 11.2.9 | e2e do editor, ADR 0039, erros conhecidos e backup | A fazer |

### Entrega 3: assinador (ADR 0040)

| Ticket | Descrição | Situação |
|---|---|---|
| 11.3.1 | Interface `ProvedorAssinatura`, `ProvedorFalso` e modelos de pedido, signatário e evidência imutável | A fazer |
| 11.3.2 | Segundo fator do funcionário: TOTP (cadastro com QR Code) e, quando o canal existir, código pelo WhatsApp | A fazer |
| 11.3.3 | `ProvedorProprio`: congelar o PDF, assinar como funcionário, ordem e parada na recusa, numerar e gerar o PDF final com a página de assinaturas e o QR Code | A fazer |
| 11.3.4 | Selo PAdES com o e-CNPJ (pyHanko), com aviso de vencimento | A fazer |
| 11.3.5 | Fila "Aguardando minha assinatura" e assinatura em lote | A fazer |
| 11.3.6 | Página pública `/verificar` (código ou arquivo) | A fazer |
| 11.3.7 | E-mail pelo SES (`sa-east-1`) com a fila de envio (parte do épico 8) | A fazer |
| 11.3.8 | Pessoa de fora: link com token, CPF e nascimento, código por e-mail ou WhatsApp, termo, assinar ou recusar | A fazer |
| 11.3.9 | Documento para órgão público: baixar, subir o assinado pelo gov.br ou ICP-Brasil e validar (pyHanko com as raízes guardadas) | A fazer |
| 11.3.10 | e2e do assinador, ADR 0040, erros conhecidos e backup | A fazer |

**Marco do COMINST:** entregas 1, 2 e 3 (até o 11.3.6), mais os modelos do COMINST e uma semana de piloto em paralelo com a Ping.

### Entrega 4: níveis de acesso

| Ticket | Descrição | Situação |
|---|---|---|
| 11.4.1 | Público, restrito e sigiloso, com hipótese legal; documento restrito torna o processo restrito | A fazer |
| 11.4.2 | Credencial de acesso a sigiloso (conceder, renunciar, cassar) | A fazer |
| 11.4.3 | Registro de quem viu ou baixou (processos restritos e sigilosos), com a retenção definida com o encarregado de dados | A fazer |

### Entrega 5: importação da Ping

| Ticket | Descrição | Situação |
|---|---|---|
| 11.5.1 | Cadastro manual de processo antigo pelo número da Ping, com o PDF de origem | A fazer |
| 11.5.2 | Importação da planilha exportada da mesa da Ping, com relatório por linha | Depende da pendência 5 do desenho |
| 11.5.3 | Subida em massa de PDFs pelo número no nome do arquivo | A fazer |
| 11.5.4 | Importador da exportação oficial da Ping | Depende da resposta da Ping |
| 11.5.5 | Virada de um departamento: importar os abertos, conferir, liberar a mesa | A fazer |

### Entrega 6: vínculos e relatórios (depois da Etapa A do multitenant)

| Ticket | Descrição | Situação |
|---|---|---|
| 11.6.1 | `ItemProcesso` com uma FK por tipo e a regra de "exatamente uma" | Depende do épico 5 |
| 11.6.2 | Pedido de reserva de sala e de veículo cria a reserva no módulo, com a checagem de conflito | Depende do épico 5 |
| 11.6.3 | Pedido de diárias e prestação de contas ligados à Viagem (épico 6) | Depende do épico 6 |
| 11.6.4 | Ações avulsas (`processo_id` nulo) e o relatório delas | Depende do épico 5 |
| 11.6.5 | Estatísticas por mesa: estoque, entradas e saídas, tempo médio por tipo, parados, produtividade | A fazer |

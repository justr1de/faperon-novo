# Épico 11: Mesa de processos (substituta da Ping)

Situação: **desenho em revisão** (05/11/2026). Desenho completo em `docs/superpowers/specs/2026-11-05-mesa-de-processos-design.md`.

## Objetivo

Substituir a Ping. como sistema de processos da FAPERON, com mesa por departamento, editor de documentos com modelos prontos e assinador próprio, importando os processos da Ping com o número original. A troca é por departamento, começando pelo COMINST, sem data fixa.

## Regras de trabalho deste épico (pedido do usuário em 05/11/2026)

- Cada ticket só fecha com a suíte inteira verde (pytest, vitest, tsc, eslint e o e2e do fluxo afetado), revisão pelo Opus e commit.
- Backup: push do branch `feat/mesa-de-processos` para o remoto `fork` ao fim de cada entrega e depois de tickets grandes. Nunca no `main` do `origin` sem confirmação, porque ele publica o site.
- Erros cometidos pelo caminho vão para `docs/erros-conhecidos/dificuldades.md`, na seção "Mesa de processos".

## Ordem de construção

A sequência segue as dependências: cada passo só usa o que os anteriores já entregaram e testaram. Dentro de cada fase, a ordem é obrigatória. Os passos marcados com ∥ podem correr em paralelo com a fase em que estão.

**Fase 0: preparação**
1. 11.0.2 Plano da entrega 1 (parte 1A, backend; a parte 1B, telas, é escrita quando a API estiver pronta).
2. ∥ 11.0.3 e 11.0.4 Dados e modelos da FAPERON (com o usuário, em paralelo às fases 1 a 4).

**Fase 1: fundação de dados (backend)**
3. Organização (FAPERON, código `14`, sequencial inicial 5000) e armazenamento de arquivos (disco ou S3).
4. Cadastros: mesas, lotações, tipos de processo e de documento, mais as regras básicas de permissão (11.1.1).
5. Número no padrão da Ping: montar, formatar e ler (11.1.2, parte 1).
6. Numerador sem buracos, com teste de concorrência (11.1.2, parte 2).
7. Processo, presença nas mesas e andamentos imutáveis com cadeia de hash (11.1.3).

**Fase 2: regras do processo (backend)**
8. Abrir, enviar, ver, concluir e reabrir, com as permissões (11.1.4 e 11.1.5).
9. Atribuir, prazo, sobrestar, retomar, ciência e comentário (11.1.4).
10. Documentos externos: upload conferido, hash, armazenamento, cancelar (11.1.6).
11. Organização da mesa e consultas: marcadores, anotações, acompanhamento, visões, abas, filtros, contadores, busca (11.1.7).
12. Relacionar processos, exportar o PDF do processo, "Remeter à Ping" (11.1.8 e 11.1.9).

**Fase 3: API (backend)**
13. API da mesa e do processo (11.1.10, parte 1).
14. API de documentos, exportação, relacionamentos (11.1.10, parte 2).
15. API de organização da mesa e de cadastros (11.1.10, parte 3).

**Fase 4: telas do núcleo (front, plano 1B)**
16. Telas de cadastro (11.1.13). Vêm primeiro porque, sem mesas e tipos, nada mais funciona na tela.
17. Abrir processo e página do processo (11.1.12).
18. Mesa (11.1.11).
19. e2e do núcleo, ADR 0038, backup (11.1.14). **Marco: núcleo pronto.**

**Fase 5: editor e modelos (entrega 2)**
20. Dados dos modelos e do papel timbrado (11.2.1). Depois, a geração do PDF e do Word (11.2.2) e a numeração com o código de verificação (11.2.3).
21. Editor TipTap (11.2.4). Depois, a tela "Incluir documento" (11.2.5), as versões (11.2.6) e a gestão de modelos (11.2.7).
22. Biblioteca de modelos do COMINST (11.2.8, depende do 11.0.4). Depois, o e2e e a ADR 0039 (11.2.9). **Marco: editor pronto.**

**Fase 6: assinador dos funcionários (entrega 3, primeira parte)**
23. Interface de provedor e o provedor falso (11.3.1). Depois, o segundo fator TOTP (11.3.2).
24. Provedor próprio (11.3.3). Depois, o selo e-CNPJ (11.3.4), a fila e a assinatura em lote (11.3.5) e a página `/verificar` (11.3.6).

**Fase 7: virada do COMINST**
25. Cadastro manual de processo antigo (11.5.1) e subida em massa de PDFs (11.5.3). Vêm antes do piloto, porque o COMINST precisa dos processos abertos dele no sistema novo.
26. Carga dos dados do COMINST: mesa, pessoas, tipos e modelos.
27. Uma semana de piloto em paralelo com a Ping. Correções.
28. Virada do COMINST (11.5.5). **Marco: COMINST fora da Ping.**

**Fase 8: assinatura de pessoas de fora (entrega 3, segunda parte)**
29. E-mail pelo SES (11.3.7). Depois, a pessoa de fora (11.3.8) e o órgão público (11.3.9). Fecha com o e2e e a ADR 0040 (11.3.10).

**Fase 9: níveis de acesso (entrega 4)**
30. Público, restrito e sigiloso (11.4.1), credencial (11.4.2) e registro de quem viu (11.4.3). **Tem de ficar pronto antes de o DP (departamento pessoal) entrar**, porque os processos dele trazem dados pessoais sensíveis.

**Fase 10: os outros departamentos**
31. ∥ Importação da planilha (11.5.2) e da exportação oficial da Ping (11.5.4), assim que a Ping ou o botão "Exportar" derem o material.
32. Virada de cada departamento (CONT, FIN, COMPRAS, DP…), com piloto curto em cada um.

**Fase 11: vínculos e relatórios (entrega 6, depois do épico 5)**
33. Estatísticas por mesa (11.6.5). Não dependem da Etapa A, então podem vir antes.
34. Depois da Etapa A: `ItemProcesso` (11.6.1), reservas (11.6.2), ações avulsas (11.6.4) e diárias com a Viagem (11.6.3, depois do épico 6).

## Situação dos tickets

Legenda: **A fazer**, **Em andamento**, **Feito** (com o commit), **Bloqueado** (com o motivo).

### Entrega 0: preparação

| Ticket | Descrição | Situação |
|---|---|---|
| 11.0.1 | Desenho (spec) e tickets do épico | Feito (aprovado para seguir em 05/11; ajustes durante a implementação) |
| 11.0.2 | Plano de implementação da entrega 1 (skill writing-plans) | Em andamento: decisões em `docs/continuidade/2026-11-05-mesa-de-processos.md`; plano 1A ainda não gravado |
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

**Marco do COMINST:** entregas 1, 2 e 3 (até o 11.3.6), mais o cadastro manual de processos antigos (11.5.1 e 11.5.3), os modelos do COMINST e uma semana de piloto em paralelo com a Ping. Ver a "Ordem de construção" acima.

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

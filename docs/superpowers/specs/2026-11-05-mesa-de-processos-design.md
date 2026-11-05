# Mesa de processos da FAPERON: desenho

- **Data:** 05/11/2026
- **Situação:** desenho para revisão do usuário. Nenhum código foi escrito.
- **Épico:** 11 (`docs/backlog/e11-mesa-de-processos.md`), com os tickets de acompanhamento.
- **Pesquisa de apoio:** `docs/pesquisa/2026-10-28-mesa-de-processos-ux-e-dados.md`, `docs/pesquisa/2026-10-28-sei-e-numeracao.md` e `docs/pesquisa/2026-10-28-ping-sistema-atual.md` (com o adendo de 29/10, que decifrou o número da Ping).
- **ADRs que este desenho vai gerar:** 0038 (núcleo e numeração), 0039 (editor e modelos), 0040 (assinador próprio). A 0037 está reservada para o canal do WhatsApp.

## 1. Objetivo

Substituir a Ping. como sistema de processos da FAPERON, com uma mesa por departamento no estilo do SEI, editor de documentos com modelos prontos e assinador próprio. Os processos que hoje estão na Ping entram no sistema novo com o número original.

**Critério de sucesso:** o COMINST deixa de abrir processos na Ping e passa a trabalhar só no sistema novo. Isso quer dizer abrir processos, escrever documentos pelos modelos, assinar, tramitar e consultar o histórico, sem voltar à Ping para nada do dia a dia. Os outros departamentos entram depois, um por vez, sem mudança de código: só cadastro.

## 2. Decisões do brainstorm (05/11/2026)

| Tema | Decisão |
|---|---|
| Escopo | Completo: núcleo, editor de documentos e assinador. A divisão em entregas ficou a meu critério. |
| Forma de trabalho | Via longa e robusta. Testes ao fim de cada rotina, tickets no backlog, backup no remoto `fork` depois de cada bloco grande, erros registrados em `docs/erros-conhecidos/dificuldades.md`. |
| Troca da Ping | Gradual, **por departamento**, começando pelo **COMINST**. Sem data fixa: entra quando a entrega estiver pronta e testada. |
| Importação | Os processos da Ping serão importados. Se a Ping não entregar a base, a importação é semi-manual (planilha mais PDF) ou manual. |
| Assinatura | **Assinador próprio**, para funcionários e pessoas de fora, atrás de uma interface de provedor que permite trocar por outro (Docusign, Clicksign etc.) no futuro. |
| Órgãos públicos | O assinador próprio não é garantia de aceite por órgão público. Documento marcado "vai para órgão público" é assinado pelo gov.br ou com certificado ICP-Brasil e devolvido ao sistema. |
| Editor | Editor de texto formatado dentro do sistema, com **modelos prontos** por tipo de documento (campos estruturados mais texto livre). Os modelos da Ping serão fornecidos pelo usuário. |
| Reservas e viagem | Os documentos de reserva e de viagem **criam o registro de verdade** nos módulos (Frotas, Espaços, Contas). A ligação entra na entrega 6, depois da Etapa A do multitenant. Os modelos já nascem com campos estruturados. |

## 3. Decisões técnicas tomadas neste desenho

O usuário pediu que eu decidisse o restante. Estas são as decisões e o motivo de cada uma.

1. **Número do processo no padrão da Ping, com o sequencial numa faixa reservada.** Formato `TTTT.SSSSII/AAAA-DD`: código do tipo de processo, sequencial da organização, código da organização (`14` para a FAPERON), ano e dia da criação. O sistema novo começa o sequencial em **5000**. A Ping estava em 2128 em agosto de 2026 e cresce cerca de 30 por mês, então os dois sistemas convivem por anos sem colidir. O sequencial é gerado por um contador no Postgres travado na transação (sem `SEQUENCE`, que deixa buracos). O número é guardado só com os dígitos e é único por organização. A busca aceita o número com ou sem pontuação. Os processos importados mantêm o número original. Quando o sequencial passar de 9999, ganha um quinto dígito, o que o formato da Ping já admite (`\d+`).
2. **Três apps novos no Django, cada um com uma responsabilidade:** `processos` (unidades, tipos, processo, andamentos, mesa, documentos externos), `documentos` (modelos, editor, versões, geração do PDF, numeração de documentos) e `assinaturas` (pedidos, provedores, selo, verificação pública). Mais um app pequeno, `organizacoes`, com a tabela de organizações, que a Etapa A do multitenant vai ampliar.
3. **`organizacao_id` em todas as tabelas novas desde já**, com índice. A RLS do Postgres fica para a Etapa B, quando os sindicatos entrarem, como decidido em 23/10.
4. **Andamentos imutáveis com encadeamento de hash por processo.** Cada andamento grava o hash do anterior. Um gatilho do banco recusa `UPDATE` e `DELETE` nessa tabela. Correção é sempre um andamento novo. Um comando confere a cadeia.
5. **Unidade (mesa) é diferente da "área" do perfil.** As mesas são os departamentos da Ping (COMINST, CONT, FIN, DP, COMPRAS…), cadastráveis. A lotação liga pessoa e mesa, com o papel `membro`, `gestor` ou `leitura`. A `area` do `Perfil` continua como está, porque os outros módulos usam.
6. **Arquivos pelo armazenamento do Django:** disco em desenvolvimento e o bucket S3 privado, cifrado e versionado em `sa-east-1` nos servidores (ADR 0033), no prefixo `processos/`. Todo arquivo guarda o SHA-256 e nunca é sobrescrito.
7. **Upload só de PDF, PNG e JPEG**, conferidos pelo conteúdo do arquivo e não pela extensão, com até 30 MB cada. O PDF precisa abrir sem erro. Antivírus (ClamAV) fica registrado como pendência, porque gasta cerca de 1 GB de memória numa máquina de 4 GB. Por ora, só funcionários sobem arquivos.
8. **Editor TipTap** (código aberto, MIT) no front. O documento é guardado como JSON do editor mais os valores dos campos do modelo. O PDF é gerado no servidor pelo WeasyPrint, que já está no projeto e já tem a renderização serializada (ADR 0025), a partir do mesmo HTML e CSS do papel timbrado. Assim o PDF sai igual ao que se vê na tela. A exportação para Word sai do mesmo HTML.
9. **Numeração dos documentos na assinatura**, não na criação da minuta, para não deixar buracos com minutas abandonadas. Exemplo: `Ofício nº 012/2026/FAPERON-COMINST`. O contador é por organização, tipo de documento, unidade e ano. Documento que não precisa de assinatura é numerado ao ser finalizado. Além disso, todo documento finalizado ganha um **código de verificação** único (8 dígitos mais 4 de conferência), que vale para a página pública.
10. **Assinador próprio:**
    - **Funcionário:** assina com a senha mais um segundo fator. O segundo fator pode ser um código pelo WhatsApp, quando o canal estiver ativo, ou um aplicativo autenticador (TOTP), que funciona desde o primeiro dia e não custa nada.
    - **Pessoa de fora:** assina por link único com prazo, informando CPF e data de nascimento e digitando o código recebido por WhatsApp ou e-mail.
    - **PDF final:** recebe a página de assinaturas, o QR Code de verificação e o **selo PAdES da FAPERON** com o certificado e-CNPJ A1, assinado pelo pyHanko. Sem o certificado configurado, o sistema funciona sem o selo e avisa na tela de administração.
11. **Envio de código para pessoas de fora:**
    - **WhatsApp:** exige modelo de mensagem aprovado pela Meta, e o canal ainda está no Sandbox do Twilio.
    - **E-mail:** por isso, o envio por e-mail (Amazon SES em `sa-east-1`, pelo SMTP do Django) entra junto com a entrega 3. Isso adianta a parte de e-mail do épico 8.
12. **Assinatura gov.br ou ICP-Brasil feita fora do sistema.** A pessoa assina o PDF fora e sobe de volta. O pyHanko confere a assinatura com as raízes da ICP-Brasil e do gov.br, guardadas no repositório, e o resultado fica registrado no andamento.
13. **Notificações:** na primeira entrega, só dentro do sistema (contador nas abas da mesa e na barra). O aviso por WhatsApp entra quando o canal estiver em produção. O resumo diário por e-mail entra com o SES.
14. **Saída "Remeter à Ping".** Enquanto houver departamento na Ping, um processo do sistema novo pode precisar ir para lá. Essa ação gera o PDF completo do processo (capa, andamentos e documentos), registra o andamento "remetido à Ping (departamento X)" e tira o processo da mesa. A volta é pela importação.
15. **Front no Next existente**, em `/sistema/processos`, com React Query, que já está no projeto. A navegação entra na barra atual; quando a casca nova do épico 4 chegar, o item muda de lugar sem retrabalho. As páginas públicas são `/verificar` e `/assinar/[token]`.
16. **Papéis de implementação** (CLAUDE.md global): o Sonnet implementa seguindo os planos, e o Opus revisa, faz o QA e roda os testes de cada ticket.

## 4. Entregas

Cada entrega é usável sozinha e fecha com a suíte completa verde, revisão e backup no `fork`.

| # | Entrega | O que o usuário ganha | Depende de |
|---|---|---|---|
| 1 | **Núcleo da mesa** | Abrir processo com número no padrão da Ping, mesa do departamento, tramitar, atribuir, marcar, anotar, prazo, concluir, linha do tempo, subir PDF e imagem, relacionar processos, exportar o PDF do processo, "Remeter à Ping", cadastros (mesas, lotações, tipos, marcadores) | — |
| 2 | **Editor e modelos** | Escrever documentos no sistema pelos modelos, com papel timbrado, versões, comparação, PDF e Word, e a biblioteca de modelos da FAPERON | 1 |
| 3 | **Assinador** | Assinatura de funcionários (senha mais segundo fator) e de pessoas de fora (link mais código), bloco de assinatura, assinatura em lote, numeração na assinatura, selo e-CNPJ, página pública de verificação, assinatura gov.br e ICP-Brasil devolvida ao sistema, e-mail pelo SES | 2 |
| 4 | **Níveis de acesso** | Processo público interno, restrito (só as mesas por onde passou) ou sigiloso (pessoas nomeadas), com hipótese legal e registro de quem viu | 1 |
| 5 | **Importação da Ping** | Cadastro manual pelo número da Ping, importação da planilha exportada da mesa da Ping, subida em massa dos PDFs pelo número no nome do arquivo e importador da exportação oficial, se ela vier | 1, 2 |
| 6 | **Vínculos e relatórios** | Documentos de reserva e de viagem criam o registro nos módulos, itens dos módulos ligados ao processo, ações avulsas, estatísticas por mesa | 1 a 3 e a Etapa A |

**Marco do COMINST:** entregas 1, 2 e 3 (só a parte dos funcionários), mais o cadastro manual e a subida em massa de processos antigos da entrega 5 (para trazer os processos abertos do COMINST), os modelos do COMINST carregados e uma semana de piloto em paralelo com a Ping. A ordem completa está em "Ordem de construção", em `docs/backlog/e11-mesa-de-processos.md`. As entregas 3b (pessoas de fora), 4 e 5 vêm logo em seguida. A ordem das entregas 4 e 5 pode trocar, conforme a Ping responda ao pedido de exportação.

## 5. Modelo de dados

Todas as tabelas têm `organizacao_id` (FK, indexada), `criado_em` e, quando há autor, `criado_por` (FK para o usuário, `PROTECT`). Ninguém é apagado: cadastros têm `ativo`.

### 5.1 `organizacoes`

- **`Organizacao`:** `nome`, `sigla`, `codigo_processo` (os 2 dígitos `II`, `14` na FAPERON), `sequencial_inicial` (5000), `ativo`. A migração cria a FAPERON.

### 5.2 `processos`

- **`Unidade`** (a mesa): `sigla` (única por organização, como COMINST), `nome`, `ativo`, `ordem`.
- **`Lotacao`:** `usuario`, `unidade`, `papel` (membro, gestor, leitura), `inicio`, `fim` (nulo quando vigente). Única por usuário e unidade vigente.
- **`TipoProcesso`:** `codigo` (4 dígitos, o `TTTT`, único por organização), `nome`, `descricao`, `orientacao` (passo a passo e documentos exigidos, mostrado ao abrir o processo), `unidades_que_podem_abrir` (M2M, vazio para todas), `ativo`.
- **`Numerador`:** `organizacao`, `escopo` (texto: `processo`, ou `documento:<tipo>:<unidade>`), `ano` (nulo para o sequencial do processo, que não reinicia), `ultimo`. Único por (organização, escopo, ano). O incremento é `select_for_update` dentro de `transaction.atomic`, e é a última trava da transação, para evitar deadlock.
- **`Processo`:**
  - **Identificação:** `numero` (só dígitos, único por organização), `tipo`, `especificacao` (o assunto, até 250 caracteres), `interessados` (texto livre por enquanto; vira FK para pessoas e sindicatos na Etapa B), `unidade_geradora`, `criado_em`.
  - **Estado atual, guardado para a mesa ser rápida:** `situacao` (em_andamento, sobrestado, concluido), `ultimo_andamento_em`.
  - **Acesso:** `nivel_acesso` (publico; restrito e sigiloso na entrega 4) e `hipotese_legal`.
  - **Origem:** `origem` (sistema, importado_ping, importado_manual), `numero_origem`, `criado_em_origem` (data original, nos importados).
- **`ProcessoNaUnidade`** (onde o processo está aberto): `processo`, `unidade`, `aberto` (bool), `recebido_de` (unidade ou nulo, se gerado ali), `recebido_em`, `visualizado_em` (primeiro acesso de alguém da unidade, que tira o destaque de "novo"), `atribuido_a` (usuário ou nulo), `prazo` (data ou nulo), `retorno_programado_para` (data ou nulo), `concluido_em`. Única por (processo, unidade). O processo está "na mesa" da unidade quando `aberto = True`.
- **`Andamento`** (append-only):
  - **Campos:** `processo`, `tipo`, `unidade` (onde aconteceu), `autor`, `ocorrido_em` (hora do servidor), `dados` (JSONB do tipo), `hash_anterior`, `hash`.
  - **Tipos:** criado, enviado, recebido_visualizado, atribuido, prazo_definido, retorno_programado, concluido_na_unidade, reaberto, sobrestado, retomado, documento_incluido, documento_cancelado, documento_assinado, processo_relacionado, relacionamento_removido, remetido_ping, importado, ciencia, comentario.
  - **Hash:** SHA-256 do JSON canônico (chaves ordenadas) de `processo`, `tipo`, `unidade`, `autor`, `ocorrido_em`, `dados` e `hash_anterior`.
  - **Proteção no banco:** gatilho `BEFORE UPDATE OR DELETE` que lança exceção.
- **`Documento`** (todo documento do processo, externo ou interno):
  - **Campos:** `processo`, `sequencia` (ordem no processo, 1, 2, 3…), `natureza` (externo, interno), `tipo_documento`, `descricao`, `unidade`, `situacao` (minuta, finalizado, aguardando_assinatura, assinado, cancelado), `numero_formatado` (nulo até numerar), `codigo_verificacao` (único global), `arquivo_final` (o PDF que vale), `sha256_final`, `cancelado_motivo`, `cancelado_por`, `cancelado_em`.
  - **Regras:** documento finalizado nunca é apagado nem editado; só pode ser cancelado, com motivo. Minuta pode ser excluída por quem a criou.
  - Documento interno ganha os campos de conteúdo na entrega 2. Documento externo guarda também `data_documento`, `formato` (nato_digital, digitalizado) e `arquivo_original`.
- **`TipoDocumento`:** `nome`, `sigla_numeracao` (OFÍCIO, MEMO…), `numeracao` (por_unidade, por_organizacao, nenhuma), `exige_assinatura` (bool), `permite_externo` e `permite_interno` (bool), `ativo`.
- **`Relacionamento`:** `processo_a`, `processo_b`, `motivo`, `criado_por`, `removido_em`. Simétrico e sem duplicata ativa. Remover gera andamento nos dois processos.
- **Organização da mesa** (não entra no histórico oficial e pode ser apagada; é por unidade):
  - **`Marcador`:** `unidade`, `nome`, `cor`, `ativo`.
  - **`MarcacaoProcesso`:** `processo`, `unidade`, `marcador`, `texto`.
  - **`Anotacao`:** `processo`, `unidade`, `texto`, `prioridade` (bool), `autor`. Só a própria unidade vê.
  - **`Acompanhamento`:** `processo`, `usuario`, `grupo` (texto). Lista pessoal.
  - **`VisaoSalva`:** `unidade` ou `usuario`, `nome`, `filtros` (JSON), `padrao_da_unidade` (bool).

O "comentário", que outras unidades veem, é um andamento do tipo `comentario`.

### 5.3 `documentos` (entrega 2)

- **`ModeloDocumento`:**
  - **Identificação:** `tipo_documento`, `nome`, `unidade` (nulo = da organização), `versao`, `ativo`.
  - **Conteúdo:** `corpo` (JSON TipTap com marcadores de campo, como `{{destinatario}}`), `campos` (JSON Schema dos campos estruturados, com rótulo, tipo, obrigatório e máscara), `cabecalho_rodape` (qual papel timbrado usar).
  - **Regra:** editar um modelo cria uma versão nova; documentos antigos guardam a versão usada.
- **`ConteudoDocumento`** (do documento interno): `documento`, `modelo` e `versao_modelo`, `valores` (JSON dos campos), `corpo` (JSON TipTap).
- **`VersaoDocumento`:** cópia de `valores` e `corpo` a cada salvamento manual ou a cada 5 minutos de edição, com `autor` e `salvo_em`. Serve à comparação de versões.
- **`Trecho`:** texto pronto reutilizável (fecho padrão, base legal comum), da unidade ou da organização.
- **`PapelTimbrado`:** cabeçalho e rodapé em HTML/CSS, com a logo da FAPERON. É um só por organização no início; a estrutura permite um por unidade.

### 5.4 `assinaturas` (entrega 3)

- **`PedidoAssinatura`:** `documento`, `sha256_congelado` (do PDF gerado para assinar), `arquivo_para_assinar`, `ordem_obrigatoria` (bool), `parar_na_recusa` (bool), `vai_para_orgao_publico` (bool), `situacao` (aberto, concluido, recusado, cancelado), `provedor` (proprio; outros no futuro), `id_externo`.
- **`Signatario`:**
  - **Quem é:** `pedido`, `ordem`, `usuario` (funcionário) ou os dados de pessoa de fora (`nome`, `cpf`, `data_nascimento`, `email`, `telefone`), `papel` (assinante, aprovador, testemunha).
  - **Estado:** `situacao` (pendente, assinou, recusou), `motivo_recusa`.
  - **Para pessoas de fora:** `token_hash` (o link guarda só o hash do token), `token_expira_em`, `tentativas_codigo`.
- **`EvidenciaAssinatura`** (append-only, com gatilho como o `Andamento`): `signatario`, `evento` (link_aberto, identidade_conferida, codigo_enviado, codigo_conferido, termo_aceito, assinou, recusou), `ip`, `user_agent`, `canal_do_codigo`, `destino_mascarado`, `sha256_documento`, `ocorrido_em`, `hash_anterior`, `hash`.
- **`AssinaturaExterna`** (gov.br e ICP-Brasil devolvidas): `pedido`, `arquivo`, `resultado_validacao` (JSON com quem assinou, cadeia, data e integridade), `validado_em`.
- **`SegundoFator`:** `usuario`, `metodo` (totp, whatsapp), `segredo_cifrado` (TOTP), `confirmado_em`.

## 6. Comportamento

### 6.1 Mesa

- **Seletor de mesa** no topo para quem está lotado em mais de uma. A mesa padrão é a última usada.
- **Abas:** *Recebidos*, *Gerados*, *Concluídos (30 dias)* e *Aguardando minha assinatura* (a partir da entrega 3), cada uma com contador.
- **Colunas:** Número, Tipo, Especificação, Responsável, Último andamento ("há 3 dias"), Parado há (dias, com semáforo verde até 7, amarelo até 15, vermelho acima; limites configuráveis por mesa), Prazo, Marcadores. Processo recebido e ainda não visualizado aparece em negrito.
- **Filtros rápidos:** Meus, Sem responsável, Prazo vencido ou vencendo em 3 dias, Parados há mais de 15 dias, Com retorno programado. **"Mais filtros":** tipo, marcador, período, interessado, texto livre. Visões salvas por mesa e por pessoa.
- **Painel lateral ao clicar na linha:** resumo, os últimos 5 andamentos, documentos e as ações (Atribuir, Enviar, Marcar, Anotar, Prazo, Retorno programado, Concluir aqui).
- **Ações em lote,** com a barra aparecendo só quando há linhas selecionadas: Atribuir, Marcar e Desmarcar, Enviar, Concluir aqui.
- **Busca global** pelo número, com ou sem máscara, e pelo código de verificação de documento.

### 6.2 Processo

- **Abrir:** escolhe o tipo (filtrado pelos que a mesa pode abrir), a especificação e os interessados, e vê a orientação do tipo. O processo nasce aberto na mesa geradora com o andamento "criado".
- **Enviar:** para uma ou mais mesas, com despacho opcional, a opção "manter aberto nesta mesa" e a opção "retorno programado até a data X". O processo aparece na hora na mesa de destino, sem botão de "receber"; o primeiro acesso de alguém de lá fica registrado.
- **Concluir aqui:** fecha o processo na mesa. Quando não está aberto em nenhuma mesa, a situação vira concluído. **Reabrir** é permitido só às mesas por onde ele passou.
- **Sobrestar:** suspende com motivo; o processo sai da mesa, mas aparece no filtro "sobrestados".
- **Página do processo:** cabeçalho, árvore de documentos na ordem da sequência, linha do tempo completa com um ícone por tipo e ações. Documento assinado mostra o hash, quem assinou e quando.
- **Exportar PDF do processo:** capa, lista de andamentos e todos os documentos finalizados juntados na ordem, com marca de página "Processo nº X, folha N".
- **Remeter à Ping:** exige escolher o departamento de destino na Ping. Gera o PDF completo e o andamento `remetido_ping`, e conclui o processo em todas as mesas do sistema novo.

### 6.3 Permissões (entrega 1)

- **Ver o processo:** qualquer pessoa da organização com lotação vigente, já que todo processo é público interno até a entrega 4. O administrador também vê. O papel de auditor, que lê tudo sem agir, entra com a Etapa C do multitenant.
- **Agir na mesa** (enviar, atribuir, concluir, incluir documento, marcar, anotar): membro ou gestor da unidade onde o processo está aberto.
- **Cadastrar mesas, lotações, tipos de processo, tipos de documento e modelos:** administrador. O **gestor** cuida dos marcadores da mesa e da visão padrão.
- **Onde fica a regra:** toda consulta passa por `Processo.objects.visiveis_para(usuario)` e toda ação por `pode_agir(usuario, processo, unidade)`. Os testes cobrem cada combinação de papel e situação.

### 6.4 Editor (entrega 2)

- **Criar o documento:** "Incluir documento" → escolhe o tipo → escolhe o modelo → preenche os campos (formulário à esquerda) e o corpo (editor à direita), com a pré-visualização da folha com papel timbrado.
- **Ferramentas do editor:** negrito, itálico, sublinhado, listas, recuo, alinhamento, tabela, imagem (até 2 MB, PNG ou JPEG), quebra de página, campos e trechos prontos.
- **Salvamento:** salva sozinho a cada poucos segundos, com indicador "salvo". O histórico de versões compara duas versões, com o texto removido e o adicionado em cores.
- **Finalizar** gera o PDF no servidor. Se o tipo exige assinatura, abre o pedido de assinatura (entrega 3); senão, numera e finaliza.
- **Exportar:** PDF a qualquer momento (com a marca d'água "MINUTA" até finalizar) e Word (.docx).
- **Gestão de modelos** (administrador): o mesmo editor, mais o editor de campos (rótulo, tipo, obrigatório). Publicar um modelo cria uma versão nova.
- **Biblioteca inicial:** os modelos da Ping que o usuário vai fornecer. Na falta deles, a lista de referência: Ofício, Memorando, Despacho, Parecer, Comunicação interna, Declaração, Certidão, Termo de responsabilidade, Termo de ciência, Ata de reunião, Pedido de diárias, Autorização de viagem, Relatório de viagem, Prestação de contas de diárias, Pedido de reserva de sala ou espaço, Pedido de reserva de veículo, Relatório de atividade, Relatório mensal, Solicitação de compra ou serviço e Termo de referência simples.

### 6.5 Assinador (entrega 3)

- **Interface `ProvedorAssinatura`:** `criar_pedido(documento, signatarios)`, `situacao(pedido)`, `cancelar(pedido)` e `baixar_assinado(pedido)`. A implementação `ProvedorProprio` é a padrão e a `ProvedorFalso` serve aos testes. Um provedor externo futuro (Docusign, Clicksign) implementa a mesma interface e recebe o retorno da plataforma por webhook.
- **Congelar:** ao pedir assinaturas, o PDF é gerado e o SHA-256 é guardado. A partir daí, o conteúdo não muda; para corrigir, é preciso cancelar o pedido.
- **Funcionário:** o documento aparece em "Aguardando minha assinatura". Ele abre, lê, clica em Assinar e informa a senha mais o segundo fator. Também pode assinar em lote: seleciona vários documentos, lê cada um no visualizador e confirma uma vez só.
- **Pessoa de fora:**
  1. Recebe o link `/assinar/<token>` por e-mail ou WhatsApp, válido por 7 dias e para um documento só.
  2. Confere a identidade com CPF e data de nascimento.
  3. Recebe e digita um código de 6 dígitos, que vale 10 minutos, com no máximo 5 tentativas.
  4. Lê e aceita o termo.
  5. Assina ou recusa, com motivo.

  Cada passo vira uma evidência encadeada, e o link aberto mostra só o necessário, sem dados de outros signatários.
- **Ao concluir:** numera o documento (se ainda não tiver número), gera o PDF final com a página de assinaturas e o QR Code de `/verificar?codigo=...`, aplica o selo PAdES com o e-CNPJ, guarda o SHA-256 final e grava o andamento `documento_assinado`.
- **`/verificar`:** aceita o código ou o PDF enviado e compara o hash. Responde se o documento é autêntico, quem assinou e quando, ou se o arquivo não confere. Tem limite de pedidos por IP. Nunca mostra o conteúdo de documento de processo restrito; só confirma a autenticidade.
- **Órgão público:** com `vai_para_orgao_publico`, a tela não oferece a assinatura própria. Mostra "Baixar para assinar no gov.br" e "Enviar o arquivo assinado". Esse arquivo é validado e vira o PDF final do documento.

## 7. Segurança e LGPD

- **Rotas da área logada:** `SessaoAutenticacao` mais `EstaLogado` (ADR 0035), com CSRF nas que alteram dados.
- **Rotas públicas** (`/verificar`, `/assinar/<token>`): limite por IP, token com 256 bits de entropia guardado só como hash, e mensagem de erro sem dizer se o documento existe.
- **CPF:** de pessoas de fora, guardado inteiro só no `Signatario` (necessário para a evidência) e mostrado sempre mascarado. Documentos com dados pessoais seguem o nível de acesso do processo.
- **Logs:** nunca registram o conteúdo de documento, o CPF, o código ou o token.
- **Encarregado de dados:** o uso com dados reais (pessoas reais, processos reais importados) só começa com o aval de Weslley Hariel Lima e Silva Palomeque Gonçalves (`weslley.palomeque@dataro-it.com.br`), como nas ADRs 0033 e 0035. Com ele se definem a retenção, o registro de acesso e o termo de aceite das pessoas de fora.
- **Parecer jurídico:** o texto do termo de aceite e o uso da assinatura própria perante terceiros pedem um parecer curto do jurídico da FAPERON. Fica como pendência sem responsável na DATA-RO.

## 8. Erros e casos-limite

- **Dois cliques em "Abrir processo":** o front desativa o botão, e o back aceita uma chave de idempotência por requisição. O número não é gasto se a transação falhar, porque o contador volta no rollback.
- **Duas pessoas enviando o mesmo processo ao mesmo tempo:** a linha `ProcessoNaUnidade` é travada (`select_for_update`). A segunda pessoa recebe "o processo mudou; atualize a página".
- **Edição simultânea do mesmo documento:** a gravação é otimista, com `versao` no salvamento. A segunda pessoa recebe "outra pessoa alterou este documento", e as duas versões ficam no histórico.
- **Falha ao gerar o PDF:** o documento continua minuta, e a mensagem diz o que fazer. O erro vai para o log com o id do documento, sem o conteúdo.
- **Selo e-CNPJ vencido ou ausente:** o PDF final sai sem o selo, com aviso na administração 30 dias antes do vencimento.
- **Signatário de fora que não recebe o código:** "reenviar", no máximo 3 vezes por hora. Depois disso, o remetente pode trocar o canal (e-mail ou WhatsApp).
- **Importação com número repetido ou formato inválido:** a linha é recusada com o motivo, e as outras seguem. No fim sai um relatório da importação.

## 9. Testes

Cada ticket fecha com a suíte inteira verde:
- **API:** `pytest` dentro do container, com Postgres de verdade.
- **Web:** `vitest`, mais `tsc` e `eslint`.
- **Navegador:** `playwright` nos fluxos com tela, com a checagem de acessibilidade do axe.

Os testes que esta entrega exige além do usual:
- **Numerador concorrente:** 20 threads abrindo processos ao mesmo tempo, sem número repetido e sem buraco; rollback no meio não gasta número.
- **Imutabilidade:** `UPDATE` e `DELETE` em `Andamento` e `EvidenciaAssinatura` falham no banco, e a verificação da cadeia acusa adulteração feita por fora.
- **Número no padrão da Ping:** formatar e ler de volta; aceitar com e sem máscara; o sequencial de 5 dígitos; os números reais citados na pesquisa (`0181.205014/2026-29` e o caso atípico `0399.001396/2024-23`) lidos corretamente. A captura com os 13 números não foi guardada no repositório (tem nomes de funcionários).
- **Permissões:** matriz de papel (membro, gestor, leitura, sem lotação, administrador) por ação e por situação do processo.
- **PDF:** o PDF gerado tem o papel timbrado e o número; o PDF assinado passa na validação do pyHanko com um certificado de teste; adulterar um byte faz a verificação falhar.
- **Pessoa de fora:** token vencido, código errado 5 vezes, link reaproveitado, CPF que não confere.
- **e2e:** o caminho completo do COMINST (abrir → escrever pelo modelo → assinar → enviar a outra mesa → a outra mesa vê e conclui → verificar pelo QR Code).

## 10. Fora do escopo deste épico

- RLS e as mesas dos sindicatos (Etapa B do multitenant).
- Assinatura ICP-Brasil com certificado em token (A3) dentro do navegador. A porta de provedor deixa isso pronto para plugar.
- Edição colaborativa em tempo real (duas pessoas digitando juntas).
- Barramento com outros sistemas (Tramita GOV.BR, SenarDocs).
- Formulário público de abertura de processo (os "requerimentos" da Ping). Fica para avaliar depois da entrega 5, se a FAPERON usar.
- Zétele consultando processos. Entra depois da entrega 4, para respeitar os níveis de acesso.

## 11. Pendências com o usuário e a FAPERON

1. Modelos de documento da Ping (os do COMINST primeiro).
2. Lista de tipos de processo da Ping com os códigos `TTTT` (confirmar o `0417`) e a lista de departamentos e siglas.
3. Pessoas do COMINST e os papéis (membro ou gestor) de cada uma, para a lotação.
4. Pedido formal de exportação à Ping (seção 7 da pesquisa da Ping) e o contrato da FAPERON com ela.
5. Teste do botão "Exportar" da mesa da Ping: que colunas e que formato ele gera.
6. Certificado e-CNPJ A1 da FAPERON para o selo (ou a decisão de começar sem selo).
7. Aval do encarregado de dados para dados reais, e parecer jurídico sobre o termo de aceite.
8. Conta do SES em `sa-east-1` verificada para o domínio de envio de e-mail.

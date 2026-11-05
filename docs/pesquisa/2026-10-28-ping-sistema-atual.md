# Ping. — o sistema de processos que a FAPERON usa hoje

Pesquisa na web feita em 28/10/2026 para preparar a construção do sistema próprio de processos (estilo SEI) e a importação dos processos que hoje estão na Ping, mantendo o padrão de numeração.

Tudo o que está aqui veio de fontes públicas (site, LinkedIn, Receita Federal via APIs abertas, imprensa, e o próprio código JavaScript público do aplicativo web da Ping). Onde a informação é autodeclarada pela empresa, está marcado. Nada foi confirmado com a Ping nem com a FAPERON.

## Resumo

- **Quem é:** PING. SERVIÇOS DE ENGENHARIA DE SOFTWARE LTDA (nome fantasia "PING."), CNPJ 32.214.687/0001-54, Av. Carlos Gomes, 2837, Sala D, São Cristóvão, Porto Velho/RO, CEP 76804-021. Aberta em 10/12/2018 (começou como MEI, virou Ltda em 2019), EPP no Simples, capital social R$ 400 mil. Sócia-administradora: Tânia Borges da Costa (CEO). Demais sócios: Bruno da Silva Pinheiro (CS), Ricardo Carlos Martins Marini, Romário do Nascimento Oliveira (CTO), Clayton Guimarães Cova dos Santos (CPO), Salomão Borges da Silva (COO, desde 2024). Os termos de uso ainda chamam a empresa de "Pdio Serviços de Engenharia de Software Ltda" com o mesmo CNPJ — provavelmente o nome anterior.
- **Produto:** uma plataforma SaaS única, "Ping." ("Gestão inteligente de documentos"), cujo aplicativo web se intitula **"Ping. | Processo Eletrônico"** (app.meuping.io). Tem módulo de assinatura ("Ping. Assinaturas", assinaturas.meuping.io). Não há nome de produto separado para "protocolo"; o conceito central é o **processo** (`proceeding`), com **protocolo** numerado, tramitação entre **departamentos**, documentos, assinaturas, requerimentos (formulário público), automações e integrações.
- **Clientes conhecidos (autodeclarados no site):** CRECI-RO, Senar Rondônia, Sindsef-RO, Senar Ceará, Unimed Rondônia; a empresa afirma ter mais de 50 clientes e 6 mil usuários ativos. Não encontrei contrato público com a Ping no PNCP nem em diários oficiais (a busca foi limitada; ver item 5).
- **Formato do número de protocolo (achado no código do app):** o protocolo é guardado como dígitos e exibido como **`AAAA.NNNNN/AAAA-DD`** — quatro dígitos, ponto, sequência de tamanho variável, barra, quatro dígitos, hífen, dois dígitos (ex.: `0001.123/2025-07`, formato hipotético só para ilustrar a máscara). A regex de exibição é `^(\d{4})(\d+)(\d{4})(\d{2})$` → `$1.$2/$3-$4`. O significado de cada bloco (prefixo da instituição/departamento? ano? dígito verificador?) não está público — é a pergunta número 1 para a FAPERON/Ping.
- **Exportação/API:** a API do app é **GraphQL** (há mutações `ExportProceedingPdf` e `ExportDocumentPdf`, com capa, andamento e documentos separados; `DownloadSignedDocument`), há **importação em lote por planilha** (`record_imports`) e um cadastro de **integrações por endpoint** (`account_integrations`). Não há documentação pública para desenvolvedores, não há exportação em ZIP/CSV/XML visível na interface, e os **termos de uso não tratam de portabilidade nem de devolução de dados** ao fim do contrato. Existe página pública de **autenticação de documento** por código + CRC.
- **Estado atual:** a empresa está ativa e em crescimento (1º lugar em Serviços Digitais e Top 10 geral no Prêmio Sebrae Startups 2026, em agosto/2026). A plataforma atual é a "versão 3" (`api-ping3`), e o código carrega rotas "legacy" para documentos e assinaturas da versão anterior — ou seja, a própria Ping já migrou dados de um sistema antigo para o atual, o que é um bom precedente para pedir uma exportação estruturada.

## 1. Quem é a Ping

### Dados cadastrais (Receita Federal, via BrasilAPI e CNPJ.ws)

| Campo | Valor |
|---|---|
| Razão social | PING. SERVIÇOS DE ENGENHARIA DE SOFTWARE LTDA |
| Nome fantasia | PING. |
| CNPJ | 32.214.687/0001-54 |
| Natureza jurídica | Sociedade Empresária Limitada; porte EPP; optante do Simples |
| Início de atividade | 10/12/2018 (opção pelo MEI em 10/12/2018, exclusão do MEI em 31/03/2019) |
| Capital social | R$ 400.000,00 |
| Endereço | Av. Carlos Gomes, 2837, Sala D, São Cristóvão, Porto Velho/RO, CEP 76804-021 |
| Telefone cadastral | (69) 99989-0101 |
| CNAE principal | 6202-3/00 Desenvolvimento e licenciamento de programas de computador customizáveis |
| CNAEs secundários | 6201-5/01, 6203-1/00, 6204-0/00, 6209-1/00, 6319-4/00, 7319-0/03, 7740-3/00, 8599-6/04 |

Quadro societário (todos pessoas físicas; datas de entrada):

| Sócio | Qualificação | Entrada |
|---|---|---|
| Tânia Borges da Costa | Sócia-administradora | 28/06/2019 |
| Bruno da Silva Pinheiro | Sócio | 28/06/2019 |
| Ricardo Carlos Martins Marini | Sócio | 28/06/2019 |
| Romário do Nascimento Oliveira | Sócio | 28/06/2019 |
| Clayton Guimarães Cova dos Santos | Sócio | 28/06/2019 |
| Salomão Borges da Silva | Sócio | 31/01/2024 |

Fontes: https://brasilapi.com.br/api/cnpj/v1/32214687000154 e https://publica.cnpj.ws/cnpj/32214687000154 (ambas espelham os dados abertos da Receita). A ficha no Econodata (https://www.econodata.com.br/contato/leo-smith-c2ee8e8f12613dafa090a50d9f1c84e1) confirma razão social e CNPJ, mas lista um "Leo Smith" como presidente — dado de agregador, não bate com a Receita; ignorar.

Os **termos de uso** publicados pelo app (https://meuping-assets.s3.sa-east-1.amazonaws.com/termos-de-uso.pdf) identificam o fornecedor como "Pdio Serviços de Engenharia de Software Ltda, CNPJ nº 32.214.687/0001-54" — mesmo CNPJ, nome diferente. A página da empresa no Facebook é `ping.pdio` e o termo cita o e-mail contato@pdio.com.br, o que indica que "Pdio" é a denominação anterior.

### Equipe e cargos (site "Quem somos", https://meuping.com/?page_id=85)

- Tânia Borges — CEO; advogada, MBA em Processo Civil.
- Salomão Borges — COO; estatístico.
- Bruno Pinheiro — CS (Customer Success); analista de sistemas. Era apresentado como CEO em 2021 (https://startupi.com.br/?p=198212).
- Clayton Santos — CPO; engenheiro de software.
- Romário Oliveira — CTO; bacharel em Sistemas de Informação.
- Ricardo Marini — advogado, especialista em Direito Administrativo e Gestão Pública.

### Presença e canais

- Site institucional: https://meuping.com (WordPress; meuping.io redireciona para lá). Telefones no site: +55 11 99845-0374 e +55 69 99247-5597; e-mail contato@meuping.com. Suporte citado nos termos: suporte@meuping.com.
- Aplicativo: https://app.meuping.io (também responde em app.meuping.com). Título: "Ping. | Processo Eletrônico". Protegido por Cloudflare.
- LinkedIn: https://br.linkedin.com/company/meuping — "Especialistas em processos", fundada em 2018, 2–10 funcionários (13 listados), sede na Av. Presidente Dutra, 4731 (endereço antigo). Afirma (autodeclarado) mais de R$ 7 milhões economizados pelos clientes, 6 mil usuários ativos e 15 segmentos.
- Instagram: https://www.instagram.com/meuping.io (877 seguidores; bio "Do papel na mesa ao processo mapeado, executado e medido"; destaque "Top 10 Sebrae Startups"). O link da bio aponta para um **formulário público de abertura de processo** no app: `https://app.meuping.io/forms/proceedings/new?proceeding_type_id=<uuid>`.
- YouTube: https://www.youtube.com/@ping.6153 (não consegui ler o canal).
- Blog no Medium: https://meuping.medium.com/ (bloqueado para leitura automática).

### Histórico na imprensa e em programas de startups

- 2021: Startupi Innovation Tour Rondônia — Bruno Pinheiro como CEO; bordão "Se tem papel na sua mesa, tem algo errado" (https://startupi.com.br/?p=198212, 24/10/2021).
- Hub RO (artigo de ~2021, hoje fora do ar, https://hub-ro.com.br/blog/empresas-em-porto-velho-rondonia-exemplos-de-inovacao): descrevia gestão de documentos, arquivamento digital, assinatura eletrônica, acompanhamento de processos e relatórios por setor/usuário; prometia até 70% de ganho de agilidade e 60% de corte no gasto com papel (autodeclarado; só vi o trecho no resumo de busca).
- Junho/2025: uma das 5 startups de RO selecionadas para o Startup Experience ESX 2025 (Sebrae) — descrita como "plataforma de gerenciamento eletrônico de documentos inteligentes" (https://ro.agenciasebrae.com.br/inovacao-e-tecnologia/cinco-startups-de-rondonia-sao-selecionadas-para-o-startup-experience-esx-2025/).
- Maio/2026: LibTalks Amazônia (O Liberal) — Tânia Borges, CEO e cofundadora; "plataforma SaaS de Gestão Documental Inteligente"; mais de 50 empresas e instituições atendidas e mais de R$ 9 milhões em economia (autodeclarado) (https://www.oliberal.com/economia/libtalks-amazonia-veja-quem-sao-as-liderancas-femininas-do-5-episodio-em-porto-velho-1.1126364 e https://www.oliberal.com/economia/libtalks-amazonia-comeca-em-porto-velho-com-a-forca-do-empreendedorismo-feminino-1.1127778).
- Agosto/2026: **1º lugar na categoria Serviços Digitais e Top 10 geral do Prêmio Sebrae Startups 2026**, no Startup Summit em Florianópolis (https://ro.agenciasebrae.com.br/inovacao-e-tecnologia/rondonia-ganha-projecao-nacional-no-startup-summit-2026-com-startups-premiadas-e-finalistas-internacionais/, 31/08/2026). O LinkedIn também cita Top 100 em 2024 e Top 1.000 em 2025, e vitória no "Bera Hackathon" (Prefeitura de Porto Velho, Sebrae RO e IFRO).

### Outras "Ping" que apareceram e não são esta

- Ping Tecnologia e Segurança — Dourados/MS, CNPJ 15.309.955/0001-00, segurança eletrônica (https://www.solutudo.com.br/ping-tecnologia-e-seguranca-172900).
- PingPlay — streaming, outra empresa.
- "e-PING" — padrão de interoperabilidade do governo federal, não é empresa.

A única Ping de processos/documentos em Rondônia é a de Porto Velho descrita acima.

## 2. Funcionalidades e clientes

### O que o site diz (https://meuping.com, páginas "Soluções" e "Gestão e Automação")

- Gestão e automação de documentos e processos; controle de prazos; "documentos tramitando entre filiais".
- Assinatura eletrônica e digital, inclusive **assinatura via WhatsApp**; validade jurídica declarada.
- Acesso por navegador **ou aplicativo**; integração **via API** com ferramentas corporativas (sem dizer quais).
- IA (ações sugeridas, "análise de risco processual") e BI (relatórios e métricas processuais em tempo real).
- Formulários digitais com fluxo de coleta (ex.: avaliação de risco psicossocial — NR-17/GRO/PGR), segundo o LinkedIn.
- Infra declarada: AWS, Google Cloud, Microsoft. O bucket de arquivos públicos está em `sa-east-1` (São Paulo).
- Planos de assinatura (dos termos do Ping. Assinaturas): Gratuito (5 documentos), Básico (15), Pro (50), Premium (100), com limites de armazenamento — indica que o produto também é vendido em autosserviço.

### O que o código público do app mostra (app.meuping.com, bundles em /assets, lidos em 28/10/2026)

O aplicativo é uma SPA (React + Vite) que conversa com uma API **GraphQL** (endpoint de staging embutido: `https://api-ping3-staging.meuping.org/api/graphql`; backend aparenta ser Ruby on Rails — usa ActionCable para tempo real e upload direto para S3). Pelos nomes das queries/mutações e rotas, o modelo é:

- **Processo (`proceeding`)**: campos `protocol`, `access_level`, `description`, `observations`, `public`, `department` (com `initials` e `institution.initials`), `proceeding_type` (tipos com grupos, campos adicionais configuráveis, departamentos de destino, formulário público opcional), `legal_chance` (base legal), `user` (requerente), `documents[]` (com `sequence`, `order`, `document_type`, `department`, `file`, `signed_file`, `signatures[]`), status (`statuses`, kanban por coluna), tags, etiquetas (`labels`), atribuições a usuários, monitoramento, processos relacionados, andamentos (`proceeding_progresses`), notificações.
- **Tramitação**: `CreateProceedingForwarding` envia processos para um ou mais departamentos, com comentário, **prazo (`deadline_date`)**, opção de incluir relacionados e de manter aberto no departamento de origem. `CreateProceedingForwardingEmail` encaminha documentos por e-mail (com capa, andamentos, documentos separados, e pode receber resposta por e-mail). `CloseProceeding` / `ReopenProceeding`.
- **Caixas por departamento**: `ProceedingsMine`, `ProceedingsReceived`, `ProceedingsGenerated`, `ProceedingsAll`, "Mesa de Trabalho" (`/desktop`), favoritos, busca avançada e **`SearchCodeOrProtocol`** (busca por código de documento ou número de protocolo).
- **Documentos**: internos (editor de texto com seções, modelos/`templates`), externos (upload), por e-mail; versões e comparação de versões; aprovação/recusa; cancelamento; ciência (`document_awares`); ordenação dentro do processo; tipos de documento e extensões permitidas configuráveis.
- **Assinatura**: solicitação a usuários internos e externos (com CPF/passaporte/nascimento), grupos com ordem e "parar na recusa", métodos (código e rubrica, rubrica e token, token e selfie), assinatura digital, "assinantes" (`user_signers`).
- **Requerimentos** (`requirements`): pedidos feitos por formulário público (`/forms/proceedings/new`, `CreatePublicProceeding`) e avaliados internamente.
- **Administração**: instituições, departamentos (sigla), usuários, usuários externos, cargos (`job_roles`), campos adicionais, automações (`automations`, com scripts e tags), integrações (`account_integrations` com endpoints, método HTTP, mapa de campos), prompts de IA (OpenAI), chat de suporte (tawk.to), notificações push (Firebase).
- **Relatórios/painel**: estatísticas em tempo real por assinatura/usuário (`DocumentStats`, `UserStats`), calendário de prazos por campos de data.
- **Manual embutido**: a ajuda do app carrega PDFs de `meuping-assets.s3.sa-east-1.amazonaws.com/help/<tópico>.pdf`, com tópicos "Tela inicial", "Mesa de Trabalho", "Menu Lateral", "Assinaturas", "Área de solicitações", "Documentos", "Processos", "Requerimentos", "Usuários", "Tipos de Cadastro". (Não baixei os PDFs do manual; a FAPERON pode pedir o manual à Ping ou exportá-lo do próprio app.)
- **App móvel**: o site fala em "aplicativo", o código registra dispositivos (`CreateOrUpdateDevice`) e push; não encontrei o app na App Store nem no Google Play com os nomes "Ping", "meuping" ou "Ping Processo Eletrônico". Pode ser PWA.

### Clientes conhecidos

Autodeclarados no site (https://meuping.com, seção de cases): **CRECI-RO** (case com o presidente "Júlio", https://meuping.com/?p=9682), **Senar Rondônia** ("um dos clientes que mais se beneficiaram com a diminuição da papelada", https://meuping.com/?p=9677), **Sindsef-RO** (depoimento, https://meuping.com/?p=2463), **Senar Ceará** e **Unimed Rondônia** (logos). Segmentos citados: construção civil, logística, saúde, educação, indústria. Não há menção pública à FAPERON nem a sindicatos rurais, mas o Senar-RO é parte do Sistema FAPERON, então é plausível que a instância seja compartilhada ou irmã — pergunta para a FAPERON.

Não encontrei prefeituras ou câmaras como clientes, nem publicações de contratos (PNCP, Portal da Transparência, diários oficiais). Ver item 5.

## 3. Formato do número de processo/protocolo

Não encontrei nenhum número de protocolo da Ping publicado em diário oficial, edital ou portal de consulta. O que encontrei foi a **regra de formatação no código do aplicativo** (arquivo `assets/proceeding-CwCt5-L9.js`, servido por app.meuping.com em 28/10/2026):

```js
// detecta um protocolo já formatado
/\d{4}\.\d+\/\d{4}-\d{2}/
// formata o valor bruto (só dígitos) para exibição
e.replace(/^(\d{4})(\d+)(\d{4})(\d{2})$/, `$1.$2/$3-$4`)
// e o inverso: remove tudo que não é alfanumérico antes de buscar
e.replace(/[^a-zA-Z0-9]/g, ``)
```

Ou seja, o protocolo é armazenado como uma sequência de dígitos e exibido como **`XXXX.N…N/AAAA-DD`**: 4 dígitos, ponto, sequência de tamanho variável, barra, 4 dígitos, hífen, 2 dígitos. É a mesma família do NUP federal (`00000.000000/0000-00`, 5+6+4+2) e do que o SEI exibe, mas com prefixo de 4 dígitos e sequência sem zeros fixos. Pela analogia com o NUP, o bloco de 4 dígitos após a barra deve ser o ano e os 2 finais um dígito verificador; o prefixo de 4 dígitos deve identificar a instituição ou o departamento (o modelo guarda `institution.initials` e `department.initials`). **Isso é inferência; precisa de confirmação com exemplos reais.**

Também há um "código" por documento (`document.code`), distinto do protocolo do processo, usado na busca e na autenticação pública (código + CRC). Os documentos do sistema antigo ("legacy") eram autenticados por `publico[codigo_verificador]` + `publico[codigo_crc]`, e o app atual redireciona essas URLs antigas para `/authenticate?code=…&crc=…`.

Para fixar a regra de numeração do novo sistema, a FAPERON precisa nos dar uns 10 números reais (de anos diferentes e de departamentos diferentes) e, se possível, o último número gerado em cada série.

## 4. API, exportação, consulta pública e termos de uso

### API e integrações

- A API é GraphQL (endpoint de produção não exposto no bundle; o de staging é `api-ping3-staging.meuping.org/api/graphql`). Não há documentação pública para desenvolvedores (nenhum resultado para docs/api/help em meuping.com ou .io; o subdomínio docs.meuping.com responde 522).
- O site anuncia "integração via API"; o app tem cadastro de **integrações de saída** (`account_integrations`: nome, módulo, endpoints com caminho, método HTTP, autenticação e mapa de campos) e tipos de processo com `on_create_integration_endpoints` — isto é, a Ping consegue chamar sistemas externos quando um processo é criado. Não há evidência de uma API pública documentada para o cliente **ler** seus dados.

### Exportação

- Por processo: `ExportProceedingPdf` (escolhe documentos; opções: com capa, com andamento do processo, com documentos separados). Por documento: `ExportDocumentPdf`, `DownloadSignedDocument`. O editor interno tem "exportar para PDF/Word".
- Não vi exportação em lote (ZIP/CSV/XML) nem "exportar tudo" na interface pública do app.
- **Importação em lote**: existe a tela `/record-imports` (histórico em `/record-imports/history`) com tipos de importação descritos pela API (`record_import_types`: colunas obrigatórias/opcionais, cabeçalhos de modelo, arquivos auxiliares, relações entre registros, criação de registros a partir do arquivo, convite de usuários internos). Isso mostra que a Ping já tem estrutura de dados tabular por entidade — a mesma estrutura serve de pedido de exportação ("nos devolvam no mesmo layout das planilhas de importação").
- A versão atual é a "ping3"; o app mantém rotas/queries "legacy" (`LegacyProceeding`, `LegacyDocument`, `legacy_requested_signature`), ou seja, **a própria Ping já migrou processos de uma versão anterior**, preservando IDs antigos (`legacy_id`).

### Consulta pública

- Há página pública de **autenticação de documento**: `https://app.meuping.io/authenticate` (ou `/autenticar`), por código do documento + código CRC; devolve tipo, nível de acesso, arquivo assinado e lista de assinaturas. O robots.txt bloqueia a indexação dessas rotas.
- Há **formulário público de abertura de processo** por tipo: `https://app.meuping.io/forms/proceedings/new?proceeding_type_id=<uuid>` (`CreatePublicProceeding`, `PublicProceedingType`).
- Não encontrei portal público de **consulta de processo por número** (do tipo "consulta de protocolo" de prefeitura). Processos têm flag `public` e `access_level`, mas não achei rota pública de consulta.

### Termos de uso e devolução de dados

Os únicos termos públicos são os do **Ping. Assinaturas** (https://meuping-assets.s3.sa-east-1.amazonaws.com/termos-de-uso.pdf, 9 páginas, sem data nem versão; as rotas `/terms-of-service` e `/privacy-policy` do app apontam para esse PDF). O que eles dizem e o que não dizem:

- Fornecedor: "Pdio Serviços de Engenharia de Software Ltda", CNPJ 32.214.687/0001-54; foro de Porto Velho/RO; domicílio fiscal Porto Velho.
- Define "Instância" como "ambiente do Ping. parametrizado para as necessidades organizacionais internas do Cliente" e fala em "Pasta/Processo eletrônico" e em "Log" de assinaturas (nome, e-mail, IP, horário, eventos) "logicamente associado" ao documento e processo — o log é parte integrante dos documentos.
- Declara que o Ping. "provê um relato confiável sobre fluxo, conteúdo e ações concernentes a qualquer Documento ou Pasta/Processo eletrônico".
- **Não há cláusula de portabilidade, exportação, devolução ou exclusão de dados ao fim do contrato, nem prazo de retenção, nem backup, nem encarregado (LGPD).** A seção "Da rescisão" só diz que o usuário pode cancelar a qualquer momento e que a Pdio pode suspender contas por risco de segurança ou inadimplência.
- Propriedade intelectual: proíbe engenharia reversa e cópia de elementos do Ping. (relevante: nosso sistema deve ser construído do zero; o que fizemos aqui foi ler o JavaScript público servido ao navegador para entender o formato de dados, sem copiar nada).
- A relação contratual da FAPERON provavelmente é um contrato B2B separado (plano corporativo), e é nele que devem estar as regras de devolução de dados. **Pedir o contrato à FAPERON.**

Política de privacidade separada: não encontrada (a rota do app reaproveita o PDF de termos).

## 5. O que foi buscado e não apareceu

Buscas feitas (WebSearch, 28/10/2026) que não trouxeram nada sobre a Ping de Porto Velho:

- Contratações públicas: `pncp.gov.br "Ping" gestão eletrônica de documentos Rondônia`; API de busca do PNCP por "meuping", "ping gestao documental" e pelo CNPJ 32214687000154 (o PNCP bloqueou/não respondeu às chamadas automatizadas — **vale repetir manualmente em https://pncp.gov.br/app/contratos buscando pelo CNPJ**). Portal da Transparência e Diário Oficial com o CNPJ: sem resultado indexado.
- CRECI-RO: `CRECI-RO contrato "Ping" OR "meuping"` e `CRECI-RO transparência contratos "ENGENHARIA DE SOFTWARE"` — nada (o CRECI é autarquia federal; o contrato deveria constar no Portal da Transparência federal ou no portal do próprio CRECI-RO).
- Senar-RO / FAPERON / sindicatos rurais com "Ping": nada. O site faperon.com.br (Wix, "Sistema Faperon") não pôde ser lido automaticamente.
- Imprensa de RO (Rondônia Dinâmica, Rondoniagora, Rondônia Ao Vivo, News Rondônia, Tudo Rondônia, G1 RO): nenhuma matéria específica sobre a Ping; só as da Agência Sebrae RO, O Liberal (PA) e Startupi.
- Programas: Inova RO, Centelha RO, StartupRO, InovAtiva, Like a Boss — nenhuma menção à Ping (só ESX 2025 e Prêmio Sebrae Startups).
- Lojas de apps: nenhum app "Ping"/"meuping" de gestão documental na App Store ou Google Play.
- Números de protocolo reais da Ping em diários/editais/consulta pública: nenhum.
- Termos de uso/política de privacidade do produto "Processo Eletrônico" (não o de assinaturas): não encontrados.
- Documentação de API/desenvolvedor: não encontrada.

## 6. Perguntas para a FAPERON

1. Quem é o contato da Ping para a FAPERON (comercial e técnico) e qual é o contrato (data, vigência, plano, valor)? Pedir o contrato e qualquer termo/SLA assinado — é lá que estarão as regras de devolução de dados.
2. A instância é só da FAPERON ou é compartilhada com o Senar-RO / sindicatos (a Ping tem o conceito de "instituição" e "departamento" dentro de uma conta)? Quais instituições, departamentos e siglas existem?
3. Dez a vinte números de protocolo reais, de anos e departamentos diferentes, e o último número gerado em 2026 — para decifrar o formato `XXXX.N/AAAA-DD` (o que é o prefixo de 4 dígitos; a sequência reinicia por ano? por departamento? como se calcula o dígito final?).
4. Quantos processos existem (abertos/fechados), quantos documentos, quanto espaço em arquivos, desde quando (há processos "legacy" da versão anterior da Ping?).
5. Quais tipos de processo, tipos de documento, status (colunas do kanban), tags, campos adicionais, modelos e automações estão configurados — exportar as telas de administração ou pedir a lista.
6. Há formulários públicos de abertura de processo (links `forms/proceedings/new`) divulgados a sindicatos ou produtores? Precisam continuar funcionando? Há links de autenticação de documento (código + CRC) impressos em documentos que precisam continuar válidos?
7. Quem usa o sistema (usuários internos, usuários externos/assinantes externos) e quais cargos/assinaturas digitais (ICP-Brasil?) são usados.
8. Já pediram alguma exportação à Ping antes? Em que formato veio?
9. O que de fato é usado no dia a dia (tramitação entre setores, prazos, assinatura, requerimentos, e-mail de encaminhamento) — para priorizar o que o novo sistema precisa ter no dia 1.

## 7. Perguntas para a Ping (pedido formal de exportação)

1. Exportação completa dos dados da conta da FAPERON em formato estruturado (JSON ou CSV por entidade — processos, andamentos/tramitações, documentos com metadados, assinaturas com log, departamentos, usuários, tipos, status, tags, campos adicionais e valores), **no mesmo layout das planilhas de importação (`record_import_types`)** ou no esquema GraphQL. Pedir também o schema GraphQL (introspecção) ou o dicionário de dados.
2. Arquivos: originais e versões assinadas de todos os documentos, com nome, hash e vínculo ao processo/sequência; se possível, também o PDF consolidado de cada processo (`ExportProceedingPdf` com capa e andamentos) para guarda.
3. Regra oficial de numeração do protocolo (composição dos blocos, reinício, dígito verificador) e do código de documento + CRC, para que o novo sistema continue a série sem colisão.
4. Logs de auditoria (quem fez o quê e quando) por processo e documento, incluindo IP e método de autenticação das assinaturas (os termos dizem que o log é parte integrante do documento).
5. Acesso temporário à API GraphQL (token) para extração assistida, caso não exista exportação pronta.
6. Prazo de retenção e exclusão dos dados após o encerramento; manutenção dos links públicos de autenticação de documentos por algum período (ou entrega do que for preciso para que o novo sistema valide os códigos antigos).
7. Política de privacidade e encarregado de dados (LGPD) para registrar no nosso ADR de migração.

## Fontes

Empresa e cadastro
- Receita Federal via BrasilAPI: https://brasilapi.com.br/api/cnpj/v1/32214687000154
- Receita Federal via CNPJ.ws: https://publica.cnpj.ws/cnpj/32214687000154
- Econodata (agregador): https://www.econodata.com.br/contato/leo-smith-c2ee8e8f12613dafa090a50d9f1c84e1
- Site institucional: https://meuping.com/ ; Quem somos: https://meuping.com/?page_id=85 ; Soluções: https://meuping.com/?page_id=465 ; Gestão e Automação: https://meuping.com/?page_id=467 ; Cases: https://meuping.com/?page_id=97 ; CRECI-RO: https://meuping.com/?p=9682 ; Senar RO: https://meuping.com/?p=9677 ; Sindsef RO: https://meuping.com/?p=2463
- LinkedIn: https://br.linkedin.com/company/meuping
- Instagram: https://www.instagram.com/meuping.io ; Linktree: https://linktr.ee/meuping.io
- Termos de uso (Ping. Assinaturas): https://meuping-assets.s3.sa-east-1.amazonaws.com/termos-de-uso.pdf

Imprensa e programas
- Startupi, 24/10/2021: https://startupi.com.br/?p=198212
- Hub RO (fora do ar em 28/10/2026): https://hub-ro.com.br/blog/empresas-em-porto-velho-rondonia-exemplos-de-inovacao
- Agência Sebrae RO, 06/06/2025 (ESX 2025): https://ro.agenciasebrae.com.br/inovacao-e-tecnologia/cinco-startups-de-rondonia-sao-selecionadas-para-o-startup-experience-esx-2025/
- O Liberal, 27/05/2026: https://www.oliberal.com/economia/libtalks-amazonia-veja-quem-sao-as-liderancas-femininas-do-5-episodio-em-porto-velho-1.1126364
- O Liberal, 29/05/2026: https://www.oliberal.com/economia/libtalks-amazonia-comeca-em-porto-velho-com-a-forca-do-empreendedorismo-feminino-1.1127778
- Agência Sebrae RO, 31/08/2026 (Prêmio Sebrae Startups 2026): https://ro.agenciasebrae.com.br/inovacao-e-tecnologia/rondonia-ganha-projecao-nacional-no-startup-summit-2026-com-startups-premiadas-e-finalistas-internacionais/

Aplicativo (código público servido ao navegador em 28/10/2026)
- Shell do app: https://app.meuping.com/ (título "Ping. | Processo Eletrônico"; robots.txt bloqueia /authenticate e /autenticar)
- Formatação do protocolo: https://app.meuping.com/assets/proceeding-CwCt5-L9.js
- Queries/mutações GraphQL, rotas, importação e autenticação: bundles em https://app.meuping.com/assets/ (entre eles `graphql-53FH1h4e.js`, `record-imports-ZO1EU0Gp.js`, `document-authenticate-DpAVkFaD.js`, `legacy-document-authenticate-BCExT54g.js`, `desktop-wI1IkFpA.js`)
- Formulário público de abertura de processo (link da bio do Instagram): https://app.meuping.io/forms/proceedings/new?proceeding_type_id=d32bd8cc-5977-447d-8347-a40c7f031cba

Contexto (não são sobre a Ping)
- Protocolo eletrônico do Senar nacional (SenarDocs), para interoperabilidade futura: https://cnabrasil.org.br/senar/protocolo-eletronico-senardocs
- Outras "Ping": https://www.solutudo.com.br/ping-tecnologia-e-seguranca-172900

## Adendo (29/10/2026): o número real da FAPERON, lido na mesa de trabalho

Captura da "Mesa de trabalho" da Ping da FAPERON (mesa FAPERON-COMINST), enviada pelo usuário. Ela não foi guardada no repositório porque mostra nomes de funcionários. Dos 26 números visíveis, 13 eram de processos gerados nessa mesa, e neles a data de criação aparece na tela. A leitura abaixo saiu desses 13.

**Formato:** `TTTT.SSSSII/AAAA-DD`. Não é o NUP: o cálculo módulo 11 não bate com os dois últimos dígitos em nenhum dos 13 casos.

| Bloco | O que é | Evidência |
|---|---|---|
| `TTTT` | Código do **tipo de processo** | `0181` aparece sempre em "No País - Prestação de Contas", `0396` em "Institucional", `0399` em "Solicitação de Diárias" e `0397` em "Processo de Compras". A exceção é `0417`, que aparece em dois tipos; pode ser um tipo renomeado (a confirmar). |
| `SSSS` | **Sequencial da instituição**, que não reinicia no ano | Cresce com a data de criação: 1682 (mai/2025), 1828 (out/2025), 1918 (jan/2026), 2128 (ago/2026). |
| `II` | Provável **código da instituição** na Ping (`14` = FAPERON) | Aparece em todos os números de 2025 e 2026. Uma exceção: `0399.001396/2024-23`, que pode ser de outra instituição ou de um formato antigo (a confirmar). |
| `AAAA` | Ano de criação | |
| `DD` | **Dia do mês da criação**, não é dígito verificador | Bate nos 13 processos gerados. Exemplo: `0181.205014/2026-29`, criado em 29/04/26. |

**Uso observado:**
- Muitos processos funcionam como **pasta anual**. Exemplos: "CARTÃO CORPORATIVO <pessoa> - 2026", "<pessoa> DIÁRIAS 2026", "OFÍCIOS 2026", "MEMORANDO 2025".
- Esses processos ficam abertos por 200 a 500 dias.
- Há siglas de departamento junto ao nome de quem iniciou o processo: CONT, FIN, DP, COMPRAS e COMINST.
- **Telas da Ping:**
  - **Menu:** Mesa de trabalho, Novo processo, Requerimentos (Meus, Para avaliação), Monitoramento, Assinaturas, Automações, Modelos favoritos, Marcadores e Situações.
  - **Abas da mesa:** Recebidos, Gerados e Todos.
  - **Colunas:** processo, protocolo, tipo, descrição, dias, data, iniciado por e atribuído.
  - **Na tela:** Exportar e Selecionar campos; três modos de visão (lista, colunas e calendário); seletor de departamento no topo.

# Zétele no WhatsApp, subprojeto 1: o canal — design

Data: 2026-10-18 · Status: aguardando revisão

## Objetivo

Levar o **Zétele interno** (o da área do sistema, ADR 0032) para o WhatsApp. Um funcionário com o telefone no cadastro manda texto ou áudio para o número do Zétele e recebe a resposta em texto, e também em voz quando ele mandou áudio. Nesta fase o Zétele **só conversa**: não grava atividades nem reservas. Gravar é o subprojeto 3, que depende de os dados do sistema saírem do navegador (subprojeto 2).

**Critério de sucesso.** No servidor de teste, o Marcos, com `+55 69 …` cadastrado na tela Usuários, manda um áudio "Zétele, qual município mais produziu café em Rondônia?". Em até 30 s ele recebe:
- uma mensagem de texto, que abre com "Olá, Marcos", traz o número do Painel e cita a fonte;
- em seguida, uma mensagem de voz com a voz do Zétele.

Um número fora do cadastro recebe só a mensagem fixa, sem chamada à IA.

## Onde isto se encaixa

A integração com o WhatsApp foi dividida em cinco subprojetos, cada um com design, plano e entrega próprios:

1. **Canal** (este documento): Sandbox do Twilio, reconhecimento pelo telefone, conversa em texto e áudio.
2. **Dados do sistema no servidor:** atividades, agenda, reservas de espaços e de veículos, com as regras de conflito. Hoje tudo isso fica no `localStorage` (ADR 0031).
3. **Ações pelo WhatsApp:** registrar atividade e reservar sala ou veículo, com confirmação na conversa.
4. **Documentos:** comprovantes, listas de presença e ofícios, com extração de campos e vínculo ao item.
5. **Avisos ativos:** lembretes e aprovações pendentes. Exigem número próprio e modelos aprovados pela Meta, portanto conta paga.

## Decisões já tomadas (com o usuário, em 18/10/2026)

- **Provedor da demonstração:** o **Sandbox de WhatsApp do Twilio**, na conta de teste, gratuita.
  - **Número:** o Sandbox usa um número compartilhado (+1 415 523 8886) e só atende quem mandou `join <código>`. A participação vence 3 dias depois.
  - **Cota e ritmo:** a conta de teste traz 100 mensagens de WhatsApp grátis, e o Sandbox envia no máximo uma mensagem a cada 3 s.
  - **Brasil:** o Twilio avisa que o envio para o Brasil pode ser bloqueado temporariamente.
  - **Fonte:** twilio.com/docs/whatsapp/sandbox, consultado em 18/10/2026.
- **Provedor plugável:** o código fala com uma interface `Provedor`. Trocar o Twilio Sandbox por um número próprio no Twilio, ou pela Cloud API da Meta (a escolha de produção da ADR 0033), é uma implementação nova, sem mexer no resto.
- **Quem conversa:** **só funcionários cadastrados e ativos.** O telefone fica no cadastro do usuário (`Perfil.telefone`, já existente, no formato E.164) e é preenchido pelo administrador na tela Usuários.
  - O Zétele procura o remetente nesse campo. Se acha um funcionário ativo, atende com os papéis dele.
  - Número desconhecido recebe uma mensagem fixa.
  - O número do Zétele é fixo.
- **Proteções do telefone:**
  - o telefone é único entre os usuários (vários podem ficar sem telefone);
  - a primeira resposta de cada conversa abre com o nome da pessoa;
  - cada troca de telefone é registrada no `RegistroDeConta`.
- **Processamento:** **fila numa tabela do Postgres e um trabalhador** em contêiner próprio. Sem Redis, por causa dos 2 GB da t4g.small (ADR 0033).
- **Resposta a áudio:** **texto e depois a mensagem de voz**. São duas mensagens, porque o WhatsApp não aceita legenda em áudio. Uma mensagem de texto recebe só texto.

## Fora do escopo

- **Do subprojeto 3 em diante:** qualquer gravação (atividade, reserva, despesa); leitura de documentos e fotos; avisos ativos e modelos de mensagem; o provedor da Meta.
- **Fora de qualquer subprojeto, por ora:**
  - o Zétele público no WhatsApp;
  - vínculo do número feito pelo próprio funcionário, com código;
  - número próprio da FAPERON;
  - painel de conversas;
  - S3 para a mídia, que só faz sentido no subprojeto 4.

## Estado atual (o que já existe e será reaproveitado)

- **Usuários:** `usuarios.Perfil.telefone` (`apps/api/usuarios/models.py:41`) já valida E.164 (`^\+[1-9]\d{7,14}$`), mas **não é único**. A tela Usuários já tem o campo "Telefone (opcional)" (`apps/web/src/components/sistema/usuarios/usuarios.tsx:87`). Os papéis são os booleanos do `Perfil`: `administrador`, `coordenador`, `gestor_frota`, `gestor_espacos` e `gestor_contas`.
- **Zétele:**
  - `zetele.agente.responder(cliente, pergunta, historico, pagina, canal=...)` responde com RAG e ferramentas;
  - o canal do sistema fica em `zetele/canais.py`, com o limite diário em `ZETELE_SISTEMA_LIMITE_DIARIO` (750);
  - `zetele.registro` grava a pergunta mascarada, sem a resposta (ADR 0030);
  - o disjuntor e a disponibilidade ficam em `zetele/disponibilidade.py`.
- **Voz:** `zetele.audio` tem `Transcritor` (Groq, `whisper-large-v3-turbo`) e `Sintetizador` (Gemini, voz `pt-br-podcaster-1`, que devolve WAV). Ficam atrás de `obter_transcritor()` e `obter_sintetizador()` em `zetele/views.py`. A velocidade de 1,25× hoje é aplicada no navegador (`playbackRate`). No WhatsApp, ela precisa ir para o próprio arquivo.
- **Agendador:** `ingestao/management/commands/run_scheduler.py` já roda o expurgo do Zétele.
- **Servidores:**
  - o Caddy (`infra/aws-teste/inicializar.sh`) manda tudo para o Next em `127.0.0.1:3000`, e o Next repassa `/api/v1/` ao Django;
  - os compose de ambiente (`infra/aws-teste/docker-compose.{teste,producao}.yml`) só trocam as imagens de `api`, `scheduler` e `web`;
  - as chaves vêm do Parameter Store pelo `infra/aws-teste/chaves.sh`.

## Arquitetura

```
WhatsApp ──► Twilio ──POST form──► Caddy ──► Django  /api/v1/whatsapp/webhook
                                              │  confere X-Twilio-Signature
                                              │  grava MensagemWhatsApp(pendente)
                                              └─► 200 <Response/>   (milissegundos)

trabalhador (manage.py whatsapp_trabalhador, contêiner `whatsapp`)
  SELECT … FOR UPDATE SKIP LOCKED  ─► identifica o Perfil pelo telefone
                                   ─► (áudio) baixa a mídia do Twilio ─► Groq
                                   ─► zetele.agente.responder(canal=SISTEMA, histórico da fila)
                                   ─► formata para o WhatsApp, divide em ≤1.600 caracteres
                                   ─► Provedor.enviar_texto
                                   ─► (se veio áudio) Gemini ─► ffmpeg (ogg/opus, 1,25×)
                                        ─► arquivo temporário com link assinado ─► Provedor.enviar_audio
```

### App Django novo: `apps/api/whatsapp/`

| Arquivo | Responsabilidade |
|---|---|
| `models.py` | `MensagemWhatsApp`: é a fila, o histórico e a proteção contra repetição. |
| `provedores/base.py` | `Provedor` (Protocol) e os tipos `Entrada` e `Midia`. |
| `provedores/twilio.py` | Implementação Twilio: confere a assinatura com `twilio.request_validator.RequestValidator`, lê o formulário, baixa a mídia com autenticação básica (SID e token) e envia pela API de Mensagens. |
| `provedores/falso.py` | Provedor em memória, para os testes e para o desenvolvimento local. |
| `views.py` | `WebhookView`: só confere, grava e responde. |
| `processamento.py` | `processar(mensagem, provedor, cliente, transcritor, sintetizador)`: o caminho completo de uma mensagem, sem laço nem banco de fila. É testável sozinho. |
| `formatacao.py` | Converte o markdown do Zétele para o WhatsApp e divide o texto. |
| `audio.py` | Converte WAV para ogg/opus com o `ffmpeg`, aplica 1,25× (`atempo=1.25`), grava o arquivo temporário e gera o link assinado. |
| `midia_view.py` | `GET /api/v1/whatsapp/midia/<token>`: entrega o ogg enquanto o link vale (15 min) e responde 404 depois. |
| `management/commands/whatsapp_trabalhador.py` | Laço: pega até 5 pendentes, processa, dorme 1 s quando a fila está vazia e encerra limpo com SIGTERM. |
| `expurgo.py` | Chamado pelo agendador. |

### Modelo `MensagemWhatsApp`

| Campo | Tipo | Observação |
|---|---|---|
| `id_externo` | `CharField(64, unique)` | `MessageSid` do Twilio. Uma repetição do webhook bate no `unique` e é ignorada. |
| `provedor` | `CharField(20)` | `"twilio"`. |
| `telefone` | `CharField(16)` | Remetente em E.164, sem o prefixo `whatsapp:`. **Só fica preenchido quando o número é de um funcionário**; de número desconhecido, guarda vazio. |
| `perfil` | `FK(Perfil, null, PROTECT)` | Resolvido no webhook. |
| `tipo` | `texto` · `audio` · `documento` · `outro` | Vem de `NumMedia` e `MediaContentType0`. |
| `texto` | `TextField(blank)` | O `Body`, ou a transcrição. **Apagado 24 h depois.** |
| `resposta` | `TextField(blank)` | O texto enviado, usado no histórico da conversa. **Apagado 24 h depois.** |
| `url_midia` | `URLField(blank)` | URL do Twilio, apagada logo depois do processamento. |
| `situacao` | `pendente` · `processando` · `respondida` · `ignorada` · `erro` | |
| `motivo` | `CharField(40, blank)` | `desconhecido`, `limite_pessoa`, `limite_diario`, `indisponivel`, `documento`, `falha_envio`… |
| `tentativas` | `PositiveSmallIntegerField` | No máximo 3. |
| `recebida_em`, `processada_em`, `proxima_tentativa_em` | `DateTimeField` | Índice em (`situacao`, `proxima_tentativa_em`). |

Mudança em `usuarios.Perfil`: `UniqueConstraint(fields=["telefone"], condition=~Q(telefone=""), name="perfil_telefone_unico")`, com migração. Antes de aplicar, a migração confere se há telefones repetidos e falha com uma mensagem clara.

### Fluxo do webhook (`POST /api/v1/whatsapp/webhook`)

1. Com `WHATSAPP_ATIVO=false`, responde `404` (o canal desligado não existe por fora).
2. Confere o `X-Twilio-Signature` contra `WHATSAPP_URL_WEBHOOK`, a URL pública exata configurada no Twilio, e os campos do formulário. Se falhar, responde `403` e grava um log sem o conteúdo.
3. Lê `MessageSid`, `From`, `Body`, `NumMedia`, `MediaUrl0` e `MediaContentType0`.
4. Procura o `Perfil` ativo com aquele telefone.
5. Grava `MensagemWhatsApp(situacao=pendente)` com `get_or_create` pelo `id_externo`.
6. Responde `200` com `<?xml version="1.0" encoding="UTF-8"?><Response/>` (`text/xml`).

O webhook é isento de CSRF, não usa sessão e tem limite próprio por IP (`whatsapp_webhook`, 120/min). O Caddy ganha uma rota `handle /api/v1/whatsapp/*` direto para o Django. Assim o Next não reescreve o corpo, e a assinatura confere com o original.

### Processamento de uma mensagem (`processamento.processar`)

| Caso | O que acontece | `situacao`, `motivo` |
|---|---|---|
| Sem `perfil` | Envia a mensagem fixa de número não cadastrado e não chama a IA. | `ignorada`, `desconhecido` |
| `documento` ou `outro` | Envia "Ainda não consigo ler arquivos pelo WhatsApp; isso chega numa próxima etapa." e não baixa nada. | `respondida`, `documento` |
| Texto "ajuda" (sem diferenciar maiúsculas, com ou sem acento) | Envia o texto fixo do que dá para fazer, sem chamar a IA. | `respondida` |
| Mais de 30 mensagens da pessoa na última hora | Envia uma mensagem fixa com o horário de liberar. | `ignorada`, `limite_pessoa` |
| Limite diário do canal do sistema esgotado ou disjuntor aberto | Envia uma mensagem fixa. | `ignorada`, `limite_diario` ou `indisponivel` |
| `audio` | Baixa (até 16 MB, `audio/*`), transcreve e segue como texto. Se a transcrição falhar, envia "Não consegui entender o áudio, pode mandar de novo ou escrever?". | `respondida` ou `erro` |
| Texto | `responder(cliente, texto, historico, "/sistema", canal=SISTEMA)`. O histórico são as últimas 6 trocas respondidas da mesma pessoa nas últimas 24 h. | `respondida` |

Regras comuns a todos os casos:
- **Saudação:** a primeira resposta da pessoa em 24 h abre com "Olá, {primeiro nome}!".
- **Registro:** a pergunta entra mascarada no `PerguntaSistema`, como no site.
- **Papéis:** os papéis do perfil seguem no contexto do agente. Nesta fase, as ferramentas do Zétele interno só leem dados públicos, então os papéis passam a restringir algo no subprojeto 3.
- **Voz:** se a mensagem veio em áudio e o sintetizador está ativo, o trabalhador gera a voz depois de enviar o texto e manda o ogg. Se só a voz falhar, o texto já foi entregue e a mensagem fica `respondida`, com o log da falha.

**Erros de rede ou do provedor:** nova tentativa em 10 s, 60 s e 5 min (`proxima_tentativa_em`). Depois disso, a situação fica `erro`, com `motivo=falha_envio`. Uma mensagem presa em `processando` por mais de 5 min, quando o trabalhador cai no meio, volta para `pendente`.

### Formatação para o WhatsApp (`formatacao.py`)

- `**x**` e `__x__` viram `*x*`; `*x*` em itálico vira `_x_`.
- Títulos `#` viram uma linha em negrito.
- `[texto](url)` vira `texto: url`, e caminho interno (`/painel?…`) vira URL absoluta com o `SITE_URL`.
- Listas com `-` continuam iguais.
- Tabelas markdown viram linhas "coluna: valor".
- **Divisão:** acima de 1.600 caracteres, o texto é dividido no fim de parágrafo mais próximo, depois no de frase, e só em último caso no espaço. As partes são enviadas em ordem, com 3 s entre elas (o ritmo do Sandbox).

### Áudio de resposta (`audio.py`)

- **Conversão:** `ffmpeg -i in.wav -filter:a atempo=1.25 -c:a libopus -b:a 32k out.ogg`, com tempo limite de 20 s. O `ffmpeg` entra na imagem da API pelo `apt`, só no estágio final.
- **Arquivo e link:** o arquivo vai para `WHATSAPP_PASTA_MIDIA/<uuid>.ogg` (ajuste novo, padrão `/app/midia/whatsapp`), num volume compartilhado entre `api` e `whatsapp`. O link `SITE_URL/api/v1/whatsapp/midia/<token>` usa `django.core.signing.TimestampSigner` e vale 15 min.
- **Limpeza:** o expurgo apaga os arquivos com mais de 1 h.

### Expurgo (no agendador, a cada ciclo)

- `texto`, `resposta` e `url_midia` são esvaziados nas mensagens com mais de 24 h.
- Linhas com mais de 90 dias são apagadas.
- Arquivos `whatsapp/*.ogg` com mais de 1 h são apagados.

### Mensagens fixas

Ficam em `whatsapp/textos.py`, em português simples, sem emoji.

**Número não cadastrado:**

> Olá! Este é o Zétele, assistente da equipe da FAPERON. Seu número não está cadastrado. Se você trabalha na FAPERON, peça à Administração para incluir seu telefone no seu cadastro.

**"ajuda":**

> Por aqui você pode me perguntar sobre o site, a Central de Inteligência e como usar a área administrativa, por texto ou áudio. Em breve também vai dar para registrar atividades e reservar salas e veículos.

## Configuração

| Nome | Onde | Padrão |
|---|---|---|
| `WHATSAPP_ATIVO` | `settings` / `.env` | `false` |
| `WHATSAPP_PROVEDOR` | `settings` | `twilio` (`falso` nos testes) |
| `WHATSAPP_URL_WEBHOOK` | `settings` | `{SITE_URL}/api/v1/whatsapp/webhook` |
| `WHATSAPP_NUMERO` | `.env.local` / Parameter Store | `whatsapp:+14155238886` (Sandbox) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | `.env.local` / Parameter Store `/faperon-<amb>/twilio-account-sid` e `/twilio-auth-token` | (sem padrão) |
| `WHATSAPP_LIMITE_POR_HORA` | `settings` | `30` |
| `WHATSAPP_PASTA_MIDIA` | `settings` | `/app/midia/whatsapp` (volume compartilhado entre `api` e `whatsapp`) |

As mudanças de infraestrutura:
- `chaves.sh` e `atualizar-chaves.sh` passam a levar as duas chaves do Twilio e o número;
- os compose (o de desenvolvimento e os de ambiente) ganham o serviço `whatsapp`, com a mesma imagem da API, o comando `python manage.py whatsapp_trabalhador`, o volume de mídia e `mem_limit` de 256 MB;
- o Caddy ganha a rota direta do webhook.

**Passo a passo do usuário no Twilio (uma vez, cerca de 5 min):**
1. Criar a conta de teste.
2. No **console antigo**, abrir Messaging → Try it out → WhatsApp e ativar o Sandbox.
3. Em *Sandbox settings*, colar `https://52-67-105-63.sslip.io/api/v1/whatsapp/webhook` em "When a message comes in", com o método `POST`.
4. Copiar o Account SID e o Auth Token para o `.env.local`. Eu nunca leio nem mostro esses valores.
5. Rodar `bash infra/aws-teste/atualizar-chaves.sh`.
6. Do celular, mandar `join <código>` para o número do Sandbox.

## Segurança e LGPD

- **Assinatura:** toda requisição sem assinatura válida recebe `403`. A URL usada na conferência vem da configuração, nunca do `Host` da requisição.
- **Segredos:** o Auth Token e o SID só existem no `.env.local` e no Parameter Store, nunca no git nem nos logs.
- **Logs:** registram o id interno, a situação e o motivo, nunca o texto, o telefone completo ou a URL de mídia. O telefone aparece mascarado (`+55 69 9****-**00`).
- **Número desconhecido:** só a linha de controle fica no banco, sem telefone, texto ou mídia.
- **Retenção:**
  - texto e resposta ficam 24 h;
  - linhas de controle ficam 90 dias;
  - o áudio recebido nunca é gravado em disco (só em memória, até a transcrição);
  - o áudio enviado fica no máximo 1 h.
- **Transferência internacional:** as mensagens passam pelo Twilio (EUA) e pela Meta. O texto vai à Anthropic, e o áudio ao Groq e ao Google. **Só dados de demonstração** até o aval do encarregado de dados da DATA-RO, Weslley Hariel Lima e Silva Palomeque Gonçalves (`weslley.palomeque@dataro-it.com.br`).
- **ADR nova (0037):** o canal WhatsApp com o Sandbox do Twilio, o provedor plugável, a fila no Postgres e a retenção. A ADR atualiza a ADR 0033 no que muda: o Twilio para a demonstração e a fila sem Redis.

## Testes

**pytest** (provedor falso, `ClienteLLM` falso e transcritor e sintetizador falsos; nada sai para a rede):
- **Webhook:**
  - assinatura válida grava `pendente` e responde 200 com TwiML vazio;
  - assinatura inválida responde 403 e não grava;
  - `WHATSAPP_ATIVO=false` responde 404;
  - um `MessageSid` repetido não gera segunda linha;
  - um número desconhecido grava a linha sem telefone.
- **Assinatura de verdade:** um teste monta a assinatura com o algoritmo do Twilio (HMAC-SHA1 da URL mais os campos ordenados) e confere que o `RequestValidator` a aceita pela URL configurada, mesmo com outro `Host`.
- **Processamento:**
  - uma linha da tabela de casos para cada situação e motivo;
  - a saudação só na primeira resposta em 24 h;
  - o histórico com as 6 últimas trocas da mesma pessoa, e nunca de outra;
  - em áudio, o texto vai primeiro e a voz depois;
  - se só a voz falhar, a mensagem continua `respondida`;
  - novas tentativas com espera crescente, e `erro` depois da terceira;
  - uma mensagem presa em `processando` volta para a fila.
- **Formatação:** cada regra de conversão, divisão em parágrafo e frase, nenhum pedaço acima de 1.600 caracteres e links internos absolutos.
- **Áudio:**
  - o `ffmpeg` é chamado com `atempo=1.25` e `libopus`; um teste de integração, marcado, roda o `ffmpeg` real se ele existir;
  - o link assinado vence em 15 min.
- **Expurgo:** esvazia os campos às 24 h, apaga as linhas aos 90 dias e os ogg em 1 h.
- **Usuários:**
  - telefone repetido devolve 400 com mensagem clara na API de usuários;
  - a troca de telefone gera um `RegistroDeConta`.

**Front:**
- a mensagem de erro de telefone repetido aparece na tela Usuários (Vitest);
- nada mais muda no front.

**Teste real, no servidor de teste, com o usuário:**
- texto;
- áudio;
- número desconhecido;
- "ajuda";
- uma resposta longa, dividida em várias mensagens.

## Riscos

- **Sandbox bloqueado para o Brasil:** se a entrega ao Brasil falhar com o número do Sandbox, a demonstração depende do suporte do Twilio ou de um número próprio, que exige conta paga.
- **Cota de 100 mensagens grátis:** com áudio e texto, são cerca de 2 a 4 mensagens por pergunta, o que dá entre 25 e 50 perguntas. Depois disso, o consumo passa para o crédito de teste do Twilio.
- **Participação de 3 dias:** os participantes da demonstração precisam mandar `join <código>` de novo a cada 3 dias. É uma limitação do Sandbox, e não há como contornar.
- **Memória da t4g.small:** o trabalhador acrescenta cerca de 100 MB. O `mem_limit` e o swap seguram o pico. Se apertar, o trabalhador passa a rodar dentro do processo do agendador.

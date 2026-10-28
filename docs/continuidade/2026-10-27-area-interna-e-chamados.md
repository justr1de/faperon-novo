# Continuidade: área interna, chamados e prestação de contas (27/10/2026)

Estado salvo em 27/10/2026 para retomar depois. Junta duas sessões do mesmo dia:
- **Manhã:** pedido de chamados, FAQ e manual, e brainstorm da Central de Ajuda (seções 1 e 2).
- **Tarde:** análise das telas atuais, pesquisa de layout e de prestação de contas, e montagem do backlog.

## Onde retomar

1. **Épico 1, Central de Ajuda:** continuar o brainstorm na **seção 3**. As seções 1 e 2 e todas as decisões estão abaixo. Faltam:
   - dados e estados no Django (app `chamados`, com `organizacao_id`);
   - permissões e LGPD dos anexos;
   - tratamento de erros;
   - testes.

   Depois vêm a spec em `docs/superpowers/specs/`, a ADR e o plano (skill writing-plans).
2. Em seguida, seguir a ordem de `docs/backlog/README.md`.

## Arquivos criados hoje (ainda sem commit, no branch `feat/whatsapp-canal`)

| Arquivo | O que é |
|---|---|
| `docs/backlog/README.md` | Os 11 épicos (0 a 10), na ordem aprovada, e a lista de melhorias por módulo |
| `docs/backlog/e01-central-de-ajuda.md` | Épico 1: decisões e tickets 1.1 a 1.9 |
| `docs/backlog/e04-casca-da-area-interna.md` | Épico 4: problemas vistos nas telas e tickets 4.1 a 4.9 |
| `docs/backlog/e06-viagem-e-prestacao-de-contas.md` | Épico 6: a Viagem, tickets 6.1 a 6.10 e o que confirmar com contador, jurídico e SENAR-RO |
| `docs/pesquisa/2026-10-27-ux-area-interna.md` | Pesquisa de layout e UX de sistemas internos, com fontes |
| `docs/pesquisa/2026-10-27-prestacao-de-contas.md` | Pesquisa de prestação de contas, comprovantes, controle, integrações e LGPD, com fontes |
| este arquivo | Continuidade |

Observação: a sessão da manhã tinha prometido `docs/backlog/`, mas não gravou o arquivo. A lista de 10 épicos dela se perdeu. Na tarde, a lista foi refeita mantendo os números 0 (WhatsApp), 2 (FAQ) e 8 (e-mail SMTP), que eram citados no desenho dos chamados.

## Ordem dos épicos (aprovada: "Ordem ok")

0. Canal do WhatsApp (em andamento; tarefas 1 a 4 feitas)
1. **Central de Ajuda** (prioridade)
2. FAQ completo
3. Manual em PDF, com papel timbrado da DATA-RO e logo da FAPERON (mais tarde)
4. Casca nova da área interna
5. Etapa A do multitenant (Postgres com organização)
6. Viagem + Prestação de contas v2
7. Etapa B do multitenant (sindicatos, contas, associados, matérias)
8. Avisos por e-mail (SMTP)
9. Etapa C do multitenant (visão da FAPERON, conferência dos sindicatos, convênios, auditoria)
10. Melhorias por módulo

## Épico 1: Central de Ajuda, decisões e desenho até aqui

**Pedido original (manhã):** um menu "Abrir chamado". O Tiago Martins, analista da FAPERON e futuro administrador da área logada, avisou que os sindicatos têm dificuldade com tecnologia. O pedido também incluía um FAQ completo e um manual detalhado em PDF, este para depois.

**Respostas do usuário**
- Tickets em `docs/backlog/`, no repositório.
- Todo chamado vai **direto para a DATA-RO**.
- Fila dentro do sistema e aviso no WhatsApp.
- "Não consigo entrar" no `/login`: sim, com formulário curto.
- Evidência: contexto automático e anexo opcional.
- Caminho A, um módulo próprio, com o Zétele como porta de entrada.
- Prazo prometido na tela: "até 1 dia útil".
- "Falar em vez de digitar" vira ticket separado (épico 10).
- O administrador da FAPERON vê os chamados da própria organização, **só em leitura**.

**Seção 1: quem abre o chamado (aprovada)**
- **Botão "Ajuda"**, sempre com texto e ícone de boia, inclusive no celular. Abre um menu com: Abrir chamado; Meus chamados (selo quando há resposta); Tour guiado (sai da barra e vem para cá); Perguntas frequentes (quando o épico 2 existir). O botão é um componente próprio: hoje fica na barra e, no épico 4, vai para o menu lateral.
- **Zétele:** quando não resolve, oferece "Falar com o suporte DATA-RO" e leva a pergunta para o chamado.
- **`/login`:** o link "Não consigo entrar" abre um formulário com nome, e-mail, WhatsApp e organização. Tem limite por IP e armadilha anti-robô.
- **Assistente em 3 passos**, com letra grande e linguagem simples:
  1. O que você precisa: Não consigo fazer uma tarefa, Apareceu um erro, Dúvida de como usar, Pedido, Sugestão.
  2. Onde e o quê: a área já vem marcada pela tela onde a pessoa estava; texto com exemplo no campo; até 3 fotos ou PDFs de 5 MB cada.
  3. Contato e "Isso está impedindo seu trabalho?": se sim, a prioridade sobe.
- **Confirmação:** número `CH-0042` e o prazo. O sistema guarda sozinho a tela, o navegador, o aparelho e o último erro mostrado.
- **Meus chamados:**
  - status Recebido, Em atendimento, Aguardando você, Resolvido e Fechado;
  - conversa em formato de chat, com anexos;
  - "Isso resolveu?": se não, o chamado reabre;
  - fecha sozinho 7 dias depois de resolvido.

**Seção 2: a fila da DATA-RO (aprovada)**
- **Papel `suporte_dataro`:** só o administrador concede. Dá acesso apenas aos chamados, não aos dados dos módulos. Quem tem o papel vê o item "Fila de chamados", com o número de abertos.
- **Fila em `/sistema/chamados/fila`:**
  - **Colunas:** número, assunto, tipo, área, organização, quem abriu, prioridade, status, tempo aberto, responsável.
  - **Filtros:** status, tipo, área, organização, prioridade, "meus" e "sem responsável".
  - **Ordem:** primeiro os que estão impedindo o trabalho, depois os mais antigos.
  - **Selo "atrasado":** depois de 1 dia útil sem resposta.
- **Dentro do chamado:** conversa, anexos, contexto automático, "Assumir", troca de status e de prioridade, nota interna (só a DATA-RO vê), resposta e respostas prontas.
- **Chamado sem login:** recebe o selo "sem login, conferir identidade". A DATA-RO confere quem é pelo WhatsApp antes de mexer na conta.
- **Avisos no WhatsApp para a DATA-RO:**
  - a cada chamado novo e a cada resposta da pessoa;
  - vão para os números em `SUPORTE_WHATSAPP`;
  - levam número, tipo, área, organização e o link, **sem o texto do chamado**;
  - uma fila no Postgres reenvia se falhar.
- **Avisos para quem abriu:**
  - selo no sistema;
  - no WhatsApp, "Sua solicitação CH-0042 foi respondida. Veja no sistema.", só se a pessoa tiver telefone cadastrado e o épico 0 estiver no ar.
  - De hora em hora, uma tarefa marca os atrasados e reavisa a DATA-RO uma vez.
- **Visibilidade:**
  - o administrador da FAPERON lê os chamados da organização;
  - na etapa B, cada sindicato vê só os próprios chamados;
  - os gestores e auditores da FAPERON veem os de todos.

## Análise das telas atuais (tarde)

Capturas feitas em 27/10 com o mock da API e `next dev` (1440 px e 390 px), entrando como Marcos. O que se viu:
- **Navegação:** os módulos ficam no cabeçalho do site público. A barra de baixo mistura usuário e ações de administração, com dois "Sair". No celular, as ações viram ícones sem nome.
- **Rodapé e enfeites:** o rodapé público e as ilustrações laterais aparecem em toda tela. O Zétele grande cobre "Editar" na frota, conflitos em espaços, "Baixar CSV" em relatórios e o valor da despesa no celular.
- **Início:** não mostra pendências. O Marcos tinha 2 despesas e 3 pedidos de espaço para aprovar e só descobria isso entrando em cada módulo.
- **Prestação de contas:** lista simples, sem total, filtro de período ou status, prazo, histórico, lote ou leitura de comprovante.
- **Indicadores:** a página passa de 4.000 px de altura.

**Para refazer as capturas:**
```bash
cd apps/web
MOCK_PORT=8001 node scripts/mock-api.mjs &
API_INTERNAL_URL=http://localhost:8001 npx next dev -p 3200 &
# login: marcos@exemplo.faperon.br / demonstracao-local
```

## Prestação de contas: o que ficou decidido

- **Tipos a cobrir:** reembolso de funcionário, adiantamento e diárias, sindicatos à FAPERON e convênios ou projetos. O usuário marcou os quatro.
- **Ideia central:** a **Viagem**. Ela junta adiantamento e diárias, reserva do veículo, despesas e atividades, e a prestação de contas sai montada no retorno.
- **Base comum:** fonte do recurso em cada despesa. Em convênio pelo MROSC, a nota precisa estar no CNPJ da FAPERON e os documentos são guardados por 10 anos.
- **Detalhes e tickets:** `docs/backlog/e06-viagem-e-prestacao-de-contas.md`. Lá também estão as perguntas a confirmar com o contador, o jurídico e o SENAR-RO.

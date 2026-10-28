# Backlog da área interna

Épicos e tickets da área interna (sistema logado) da FAPERON e, depois, dos sindicatos. Criado em 27/10/2026, a partir do pedido de chamados, FAQ e manual (sessão da manhã) e do brainstorm de layout e prestação de contas (tarde). A ordem foi aprovada pelo usuário em 27/10/2026.

Cada épico com escopo definido tem um arquivo próprio (`eNN-*.md`) com objetivo, tickets, critérios de aceite e dependências. Os demais ganham arquivo quando entrarem em brainstorm.

## Situação dos épicos

| # | Épico | Situação | Depende de | Arquivo |
|---|---|---|---|---|
| 0 | Canal do WhatsApp (área administrativa e Zétele no WhatsApp) | Em andamento: tarefas 1 a 4 feitas no `feat/whatsapp-canal` | — | `docs/superpowers/plans/2026-10-18-zetele-whatsapp-canal.md` |
| 1 | Central de Ajuda: botão Ajuda, abrir chamado, meus chamados, fila da DATA-RO, avisos, "Não consigo entrar" | **Prioridade.** Desenho com as seções 1 e 2 feitas | 0 (só o aviso no WhatsApp) | [e01-central-de-ajuda.md](e01-central-de-ajuda.md) |
| 2 | FAQ completo das funcionalidades | A fazer, depois do 1 | 1 | — |
| 3 | Manual de uso em PDF, com papel timbrado da DATA-RO e logo da FAPERON no cabeçalho e na capa | A fazer, mais tarde (pedido do usuário) | 2, 4 | — |
| 4 | Casca nova da área interna | A fazer. Só no front | — | [e04-casca-da-area-interna.md](e04-casca-da-area-interna.md) |
| 5 | Etapa A do multitenant: dados dos módulos no Postgres, já com `organizacao_id` | Planejado | — | memória `sindicatos-multitenant` |
| 6 | Viagem + Prestação de contas v2 | A fazer | 5 | [e06-viagem-e-prestacao-de-contas.md](e06-viagem-e-prestacao-de-contas.md) |
| 7 | Etapa B do multitenant: sindicatos, contas, associados, matérias | Planejado | 5 | — |
| 8 | Avisos por e-mail (SMTP) | Planejado | — | — |
| 9 | Etapa C do multitenant: visão da FAPERON, conferência das contas dos sindicatos, convênios, auditoria | Planejado | 6, 7 | — |
| 10 | Melhorias por módulo | Aos poucos | 4 (padrões de lista) | ver abaixo |

## Épico 10: melhorias por módulo (lista viva)

- **Agenda:** visão de semana e de dia; filtros por camada (meus, FAPERON, frota, espaços) no lugar da legenda; integração com o Google Agenda (pendência da reunião com o Tiago em 17/10).
- **Frotas:** saída e retorno com foto do odômetro e do combustível; vencimentos de licenciamento, seguro e IPVA; abastecimento vira despesa sem lançar duas vezes (junto com o épico 6).
- **Espaços:** aprovar num painel lateral, com o conflito ao lado; pedidos que se repetem; itens do evento (coffee break, projetor).
- **Atividades:** município escolhido de lista; foto; registro sem internet (fila de envio); ligação com a Viagem (épico 6).
- **Relatórios:** envio mensal automático; filtros salvos; relatório de execução financeira por convênio (épico 9).
- **Indicadores:** resumo no topo e, ao clicar num número, a lista que o gerou (a página passa de 4.000 px).
- **Usuários:** papéis e alçadas; desligamento bloqueia a conta sem apagar.
- **Chamados:** "falar em vez de digitar" no passo 2 do chamado, com a transcrição de voz que já existe.

## Pesquisa de apoio

- `docs/pesquisa/2026-10-27-ux-area-interna.md`: layout e UX de sistemas internos (épicos 4 e 10).
- `docs/pesquisa/2026-10-27-prestacao-de-contas.md`: prestação de contas, comprovantes, controle e integrações (épicos 6 e 9).

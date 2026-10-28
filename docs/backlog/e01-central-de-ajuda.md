# Épico 1: Central de Ajuda (chamados)

Situação: em desenho (brainstorm de 27/10/2026). Seções 1 e 2 aprovadas; faltam as seções 3 em diante.

## Objetivo

Quem usa a área interna (FAPERON e, depois, os sindicatos, que têm dificuldade com tecnologia segundo o Tiago Martins) consegue pedir ajuda em linguagem simples e acompanhar a resposta dentro do sistema. A DATA-RO atende numa fila própria.

## Decisões já tomadas

- Todo chamado vai **direto para a DATA-RO**.
- Fila dentro do sistema + aviso no WhatsApp do suporte (Twilio já integrado).
- Quem não consegue entrar abre chamado pelo `/login` ("Não consigo entrar"), com limite por IP e armadilha anti-robô.
- O chamado guarda o contexto sozinho (tela, navegador, aparelho, último erro) e aceita até 3 fotos ou PDFs de 5 MB cada.
- Caminho A: app Django `chamados` com `organizacao_id` desde o início; o Zétele é uma das portas de entrada ("Falar com o suporte").
- Prazo prometido na tela: "até 1 dia útil".
- "Falar em vez de digitar" fica fora deste épico (épico 10).
- O botão "Ajuda" é um componente próprio: entra na barra atual e muda para o menu lateral no épico 4 sem retrabalho.

## Tickets

| Ticket | Descrição | Situação |
|---|---|---|
| 1.1 | Desenho completo (spec) e ADR do módulo de chamados | Em andamento |
| 1.2 | Backend: modelos, estados (Recebido, Em atendimento, Aguardando você, Resolvido, Fechado), anexos, trilha de auditoria, papel `suporte_dataro` | A fazer |
| 1.3 | Botão "Ajuda" com menu (Abrir chamado, Meus chamados, Tour guiado, Perguntas frequentes quando o épico 2 existir) | A fazer |
| 1.4 | Assistente "Abrir chamado" em 3 passos, com contexto automático e anexos | A fazer |
| 1.5 | Meus chamados: conversa, selo de novidade, "Isso resolveu?", fechamento em 7 dias | A fazer |
| 1.6 | Fila da DATA-RO (`/sistema/chamados/fila`): filtros, assumir, nota interna, respostas prontas, selo de atrasado | A fazer |
| 1.7 | "Não consigo entrar" no `/login` | A fazer |
| 1.8 | Avisos no WhatsApp (DATA-RO e quem abriu), sem o texto do chamado, com fila de reenvio; tarefa de hora em hora para atrasos | A fazer (depende do épico 0) |
| 1.9 | Zétele oferece "Falar com o suporte" e preenche o chamado | A fazer |

- O administrador da FAPERON **vê os chamados da própria organização, só em leitura** (decidido em 27/10/2026). As notas internas da DATA-RO continuam só para a DATA-RO.

## Próximo passo

Retomar o brainstorm na seção 3. Ver `docs/continuidade/2026-10-27-area-interna-e-chamados.md`.

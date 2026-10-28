# Épico 4: casca nova da área interna

Situação: a fazer. Levantado no brainstorm de 27/10/2026, com as telas atuais capturadas no computador e no celular.

## Problema (telas de 27/10/2026)

- Os módulos ficam no cabeçalho do site público. A barra de baixo mistura quem está logado com ações de administração (tags, usuários, restaurar) e tem dois "Sair". No celular, as ações viram ícones sem nome.
- Toda tela termina no rodapé público. As ilustrações laterais e o Zétele grande cobrem conteúdo: "Editar" na frota, conflitos em espaços, "Baixar CSV" em relatórios e o valor da despesa no celular.
- O Início não mostra o que espera a pessoa: aprovações e devoluções só aparecem dentro de cada módulo.
- O verde de "aprovado" é o mesmo verde dos botões e da marca.

## Tickets

| Ticket | Descrição |
|---|---|
| 4.1 | Layout próprio de `/sistema`: menu lateral fixo no computador (ícone e nome, recolhível sem perder o nome), com contadores de pendência; sem o rodapé público e sem as ilustrações laterais |
| 4.2 | Barra inferior no celular: Início, Agenda, + Registrar, Pendências, Mais |
| 4.3 | Topo do menu com a organização em uso (prepara o multitenant) e menu do usuário com tags, usuários, tour, restaurar e um só "Sair" |
| 4.4 | Início com "Precisa de você": aprovações, devoluções, prazos, reserva de hoje, revisão vencida, cada item com ação direta |
| 4.5 | Cores de situação fixas, sempre com texto, separadas do verde da marca (tokens) |
| 4.6 | Zétele compacto dentro do sistema, sem cobrir conteúdo nem o foco (WCAG 2.4.11) |
| 4.7 | Padrões de lista: filtros em etiquetas guardados na URL, visões prontas, cartões no celular, estados vazios com ação |
| 4.8 | Painel lateral para ver e aprovar sem sair da lista; histórico do item; "Desfazer" em ações reversíveis |
| 4.9 | Busca e comandos com Ctrl/Cmd+K (módulos, ações, registros recentes, Zétele) |

## Critérios de aceite gerais

- Nenhum elemento fixo cobre botão, valor ou campo em foco, no computador e no celular (390 px).
- Contraste de 4,5:1 em texto e 3:1 no resto; vidro só em molduras (menu, barras), nunca atrás de tabela ou formulário.
- O tour guiado e os testes e2e continuam passando com as novas posições.

## Fonte

`docs/pesquisa/2026-10-27-ux-area-interna.md`.

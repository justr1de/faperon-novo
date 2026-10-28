# Pesquisa: layout e UX da área interna (27/10/2026)

Pesquisa feita por agente, com WebSearch e WebFetch. Os itens marcados "(via busca)" vieram só de resumos de busca, porque a página original não abriu, e merecem conferência.

**Como li as fontes.** A maioria das fontes eu abri e li direto: NN/g, Baymard, GOV.UK, Primer, Carbon, WCAG 2.2, MDN, web.dev, Linear, Slack, Vercel, GitHub e Android/Material. Quatro pontos vieram só de resumos de busca: Polaris, Apple HIG, a home do Stripe e o DSGov. As páginas do DSGov (gov.br/ds) carregam por JavaScript e não consegui ler as regras de Menu e Header. Os números citados vêm das próprias fontes.

---

## 1. Navegação

1. **Trocar a navegação do cabeçalho do site público por uma barra lateral à esquerda, sempre visível no computador.** A NN/g diz que a navegação vertical comporta menus largos ou que vão crescer e é mais fácil de percorrer com os olhos que a horizontal. As regras dela são três:
   - não repetir o menu ao mesmo tempo no topo e na lateral;
   - não esconder a navegação atrás de ícones sem nome;
   - em menus longos, deixar os itens menos usados no fim.

   A versão recolhida da barra deve mostrar ícone com nome curto, nunca só o ícone. Isso vale para 8 a 12 módulos. Fonte: https://www.nngroup.com/articles/vertical-nav/
   *Exemplo:* Linear e Vercel usam barra lateral fixa com seções.

2. **Não esconder a navegação num menu "hambúrguer".** Num estudo da NN/g, menus escondidos fizeram a capacidade de achar o conteúdo cair mais de 20%. No computador, as tarefas ficaram pelo menos 39% mais lentas; no celular, 15% mais lentas que o formato misto. Fonte: https://www.nngroup.com/articles/hamburger-menus/

3. **No celular, usar uma barra inferior com 4 ou 5 destinos e um "Mais".** O Android/Material 3 recomenda a barra para 3 a 5 destinos de mesma importância (https://developer.android.com/develop/ui/compose/components/navigation-bar). A Apple sugere 3 a 5 abas, sempre visíveis, só para navegar, nunca para ações (via busca: https://developer.apple.com/design/human-interface-guidelines/tab-bars). A NN/g diz que barras de abas funcionam com poucas opções e ficam apertadas acima de 5 (https://www.nngroup.com/articles/mobile-navigation-patterns/).
   *Sugestão:* Início · Agenda · Registrar (atividade ou despesa) · Pendências · Mais.

4. **Usar a troca de organização (FAPERON ou sindicato) como no Slack e na Vercel.**
   - Fica no canto superior esquerdo, com logotipo e nome da entidade ativa. Clicando, abre a lista das organizações da pessoa.
   - A Vercel deixa escolher qual organização abre no login (https://vercel.com/docs/accounts/create-a-team).
   - O Slack tem atalho de teclado, Ctrl/Cmd+Shift+S (https://slack.com/help/articles/1500002200741-Switch-between-workspaces).
   - Recomendação minha, sem fonte: a entidade ativa deve aparecer sempre (nome e cor de destaque), para ninguém lançar despesa no sindicato errado.

5. **Criar uma paleta de comandos (Ctrl/Cmd+K) que também serve de busca geral, e não depender de breadcrumbs.**
   - A Superhuman recomenda o mesmo atalho em qualquer tela, abrindo e fechando a paleta, e cita Cmd+K no Superhuman, no Linear e no Slack (https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/).
   - O GitHub ajusta o que a paleta procura conforme a tela onde a pessoa está (https://docs.github.com/en/get-started/accessibility/github-command-palette).
   - Para usuários não técnicos, também precisa de um campo de busca visível; o atalho é um acelerador para quem já conhece (https://www.nngroup.com/articles/flexibility-efficiency-heuristic/).
   - A NN/g diz que breadcrumbs são dispensáveis em sistemas com 1 ou 2 níveis (https://www.nngroup.com/articles/breadcrumbs/). Basta destacar o módulo ativo e, no detalhe, ter "← Voltar para Reservas".
   - Favoritos e recentes podem ficar no topo da barra lateral ou na paleta. Isso aplica a mesma ideia de atalhos para quem usa muito; não achei estudo específico sobre esse recurso.

## 2. Página inicial: "o que precisa da minha ação"

1. **Pôr no Início uma caixa de pendências única, acima de qualquer gráfico.** Juntar o que espera a pessoa: aprovações de espaço e de despesa, despesas devolvidas para corrigir, reservas que começam hoje, prazos da prestação de contas. Cada item leva direto à ação.
   *Exemplo:* o Inbox do Linear permite marcar como lido (U), adiar (H) e apagar (Backspace) (https://linear.app/docs/inbox). Em setembro de 2026 o Linear separou o que precisa de atenção do resto numa aba "Priority" (https://linear.app/changelog/2026-09-03-priority-inbox). A home do Stripe mostra avisos de itens que precisam de atenção junto com os gráficos (via busca: https://docs.stripe.com/dashboard).

2. **Separar painel de trabalho de painel de análise.** A NN/g distingue os dois: o operacional apoia decisões imediatas e precisa ser lido sem esforço; o analítico serve a decisões sem urgência (https://www.nngroup.com/articles/dashboards-preattentive/).
   - Os gráficos ficam em "Indicadores".
   - O Início mostra só números que levam a uma ação ("3 despesas aguardando você"), nunca números só para enfeitar.

3. **Mostrar avisos dentro do sistema: um sino com contagem e a contagem também ao lado do item da barra lateral** (ex.: "Espaços 2"). A NN/g distingue três coisas: indicador (status no lugar), validação (resposta a um campo) e notificação (evento do sistema). Cada um tem um formato (https://www.nngroup.com/articles/indicators-validations-notifications/).
   - O Carbon recomenda não pôr indicador onde não há ação a fazer (https://carbondesignsystem.com/patterns/status-indicator-pattern).

4. **Manter "Próximos 7 dias" e os atalhos, mas abaixo das pendências.** A atividade recente pode ficar no fim, em formato compacto.

## 3. Listas e tabelas

1. **Deixar os filtros visíveis como etiquetas removíveis e guardá-los no endereço da página (URL).** A NN/g mostra que a forma de aplicar filtros depende da intenção do usuário (https://www.nngroup.com/articles/applying-filters/). O Polaris junta filtros, busca, ordenação e "visões salvas" num só componente; trocar um filtro tira a pessoa da visão salva (via busca: https://polaris-react.shopify.com/components/selection-and-input/index-filters).
   *Visões prontas sugeridas:* "Minhas", "Aguardando aprovação", "Este mês".

2. **Ações em lote com caixas de seleção e barra contextual.** Só para tarefas repetidas, como aprovar várias despesas ou aplicar uma etiqueta. O Polaris recomenda caixas de seleção, ações da linha aparecendo ao passar o mouse e paginação em listas grandes (via busca: https://shopify.dev/docs/api/app-home/patterns/templates/resource-index.md). A NN/g lista quatro tarefas de uma tabela: achar registros, comparar, ver ou editar uma linha, agir sobre registros (https://www.nngroup.com/articles/data-tables/).

3. **No celular, transformar cada linha em cartão** (título, status, valor, data). Se a tabela continuar como tabela, a NN/g pede cabeçalho e primeira coluna fixos, aviso visível de rolagem horizontal e escolha das colunas exibidas. Girar o celular é o último recurso (https://www.nngroup.com/articles/mobile-tables/).

4. **Estados vazios que explicam e oferecem a próxima ação.** A NN/g dá três regras: comunicar o status, ensinar e oferecer caminho direto para a tarefa principal (https://www.nngroup.com/articles/empty-state-interface-design/). O Primer usa ação principal e um link secundário de ajuda (https://primer.style/product/ui-patterns/empty-states/).
   *Exemplo:* "Nenhuma despesa neste mês · [Lançar despesa]".

5. **Paginação ou rolagem, e densidade.** O Polaris sugere paginar acima de 50 itens (via busca). Para 20 a 60 usuários, paginação com contagem total ("1–50 de 312") é mais previsível que rolagem infinita, principalmente para quem volta a uma lista. A densidade compacta ou confortável é opcional; o padrão deve ser confortável no celular.

## 4. Formulários e fluxos

1. **Painel lateral para ver e editar sem perder a lista; página inteira para formulários longos; modal só para decisões curtas.** A NN/g recomenda modal apenas para informação essencial e curta, e janelas não modais quando a pessoa precisa consultar o contexto (https://www.nngroup.com/articles/modal-nonmodal-dialog/).
   *Exemplo:* aprovar um pedido de espaço num painel lateral que mostra o conflito de horário ao lado.

2. **Desfazer em vez de confirmar, e confirmar só o que é grave.** A NN/g pede confirmação só em ações sérias ou irreversíveis, nunca em ações de rotina, sempre com texto específico. Os botões devem dizer o que acontece ("Excluir reserva" ou "Manter"), não "Sim/Não" (https://www.nngroup.com/articles/confirmation-dialog/).
   *Exemplo:* "Reserva cancelada · Desfazer" num aviso de 5 a 8 segundos, como o "desfazer envio" do Gmail.

3. **Validação no próprio campo, sem antecipar o erro.** A Baymard constatou que 31% dos sites não têm validação no campo e 4% erram ao fazê-la. As regras são:
   - não acusar erro enquanto a pessoa ainda digita;
   - tirar o erro assim que o campo for corrigido;
   - confirmar quando o campo estiver certo.

   Fonte: https://baymard.com/blog/inline-form-validation. Ao enviar, um resumo de erros no topo com links para cada campo, como no GOV.UK (https://design-system.service.gov.uk/components/error-summary/ e https://design-system.service.gov.uk/patterns/validation/).

4. **Rascunho automático em formulários longos, e salvamento explícito no resto.** O Primer reserva o salvamento automático para quando a pessoa espera efeito imediato. Nos formulários com botão, avisa antes de sair da página com alterações não salvas (https://primer.style/product/ui-patterns/saving/).
   *Aplicação:* a despesa com comprovante vira rascunho local enquanto a pessoa preenche.

5. **Status e linha do tempo de cada item.** No detalhe, mostrar campos em pares rótulo/valor com link "Alterar" (https://design-system.service.gov.uk/components/summary-list/). Embaixo, o histórico: "Criado por Ana · Devolvido por João: falta nota fiscal · Reenviado". A linha do tempo de issues do GitHub é o exemplo de referência.

6. **Atalhos de teclado como extra, nunca como único caminho.** Ex.: N para nova atividade, ? para listar os atalhos, como no Stripe (https://docs.stripe.com/dashboard/basics; https://www.nngroup.com/articles/flexibility-efficiency-heuristic/).

## 5. Celular e trabalho de campo

1. **Funcionar com internet ruim, com fila de envio.** O web.dev recomenda:
   - avisar o estado da conexão e o que ainda dá para fazer ("Sem conexão. A despesa será enviada quando a rede voltar");
   - não travar a tela com carregamento bloqueante;
   - pôr as tarefas numa fila.

   Fonte: https://web.dev/articles/offline-ux-design-guidelines. O módulo Background Sync do Workbox guarda as requisições que falharam (no armazenamento do navegador, IndexedDB) e as reenvia depois (https://developer.chrome.com/docs/workbox/modules/workbox-background-sync).
   *Aplicação:* registrar atividade, lançar despesa e informar quilometragem devem funcionar offline.

2. **Abrir a câmera direto para o comprovante.** O atributo `capture="environment"` no campo de arquivo abre a câmera traseira. O MDN avisa que ele não funciona em todos os navegadores, então é preciso manter a opção de escolher da galeria (https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/capture).

3. **Áreas de toque grandes.** O mínimo da WCAG 2.2 (critério 2.5.8, nível AA) é 24×24 px ou espaçamento equivalente (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Para uso na estrada, mirar bem acima disso e pôr a ação principal na parte de baixo da tela.

4. **Botão de ação principal flutuante ou central na barra inferior** ("+ Registrar"), sem cobrir campos. Cabeçalhos e rodapés fixos não podem esconder o elemento em foco: isso é uma falha catalogada da WCAG 2.2 (critério 2.4.11, falha F110) (https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html). O Zétele flutuante e o "agendar por voz" precisam respeitar isso.

## 6. Visual

1. **Cor de status com significado fixo, sempre com ícone e texto.** O Carbon define vermelho para erro, laranja e amarelo para alerta, verde para sucesso, azul para informação e cinza para rascunho. Pede ícone com rótulo e contraste mínimo de 3:1 em elementos que não são texto (https://carbondesignsystem.com/patterns/status-indicator-pattern; https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
   - Atenção: o verde institucional não pode ser o mesmo verde de "aprovado". Usar tons diferentes, ou reservar o verde da marca para navegação e botões.

2. **Números alinhados em tabelas e totais.** Use `font-variant-numeric: tabular-nums` (no Tailwind, a classe `tabular-nums`) em km, R$ e contagens, com alinhamento à direita (https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric).

3. **Vidro só em superfícies "de moldura", nunca atrás de texto denso.** A NN/g pede checar o contraste em todos os pontos do fundo e, se possível, deixar o usuário reduzir a transparência (https://www.nngroup.com/articles/glassmorphism/).
   - Use em cabeçalho, barra lateral e barra inferior.
   - Não use em tabelas, formulários e cartões de leitura.
   - Contraste mínimo de texto: 4,5:1 (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
   - Respeitar `prefers-reduced-transparency` e `prefers-contrast` quando o navegador suportar.

4. **Modo escuro só depois do resto.** O Material 3 trocou a sombra por tons de "surface container" (https://material.io/blog/tone-based-surface-color-m3). Se for fazer, partir de cores definidas como variáveis (tokens) desde já.

5. **Microinterações com propósito.** A resposta visual a um clique deve vir em até 0,1 s; até 1 s o fluxo de pensamento se mantém; 10 s é o limite da atenção (https://www.nngroup.com/articles/response-times-3-important-limits/).

## 7. Confiabilidade percebida

1. **Esqueleto da página só em carregamento de página inteira; spinner para esperas de 2 a 10 s; barra com porcentagem acima de 10 s.** Nada de animação abaixo de 1 s (https://www.nngroup.com/articles/skeleton-screens/; https://www.nngroup.com/articles/progress-indicators/). O Primer recomenda mostrar cada item assim que chega (https://primer.style/product/ui-patterns/loading/). *Aplicação:* gerar o PDF de Relatórios precisa de progresso real.

2. **Mensagens de erro com solução.** Linguagem humana, problema exato, conselho construtivo e o que a pessoa digitou preservado (https://www.nngroup.com/articles/error-message-guidelines/).
   *Exemplo:* "Não conseguimos enviar o comprovante (sem internet). Ele foi guardado e será reenviado. [Tentar agora]".

3. **Avisar que salvou e mostrar "atualizado há X min"** nas listas, nos indicadores e nos relatórios. Mostrar também o histórico de quem alterou o quê (ver 4.5). O Primer pede que a mudança apareça na tela com precisão, rapidez e clareza (https://primer.style/product/ui-patterns/saving/).

4. **Evitar telas de carregamento que travam tudo**, com a mesma lógica do item 5.1 (https://web.dev/articles/offline-ux-design-guidelines).

---

## As 10 mudanças de maior impacto, em ordem

1. **Estrutura própria da área interna.** Barra lateral fixa à esquerda (recolhível, mas sempre com nomes) no computador e barra inferior de 4 ou 5 destinos no celular. Sair do cabeçalho do site público.
2. **Troca de organização no topo da barra lateral**, com nome e logotipo da entidade ativa sempre visíveis. Pré-requisito do multitenant.
3. **Caixa "Precisa de você" no Início**: aprovações, devoluções e prazos com ação direta, mais contadores na barra lateral e um sino.
4. **Fila de envio offline** para registrar atividade, lançar despesa e informar km, com aviso claro de "pendente de envio" e o comprovante pela câmera.
5. **Status de cor fixa** (ícone e texto, separado do verde da marca) e **linha do tempo** em cada despesa, reserva ou pedido.
6. **Listas com filtros em etiquetas guardados no endereço, visões prontas e cartões no celular** em Frotas, Espaços, Atividades e Prestação de contas.
7. **Painel lateral para ver e aprovar sem sair da lista**, com "Desfazer" no lugar de "Tem certeza?" em ações reversíveis.
8. **Validação no campo segundo a Baymard, resumo de erros no topo e rascunho automático** em formulários longos.
9. **Busca geral e paleta Ctrl/Cmd+K** com módulos, ações ("Nova reserva") e registros recentes, sem conflitar com o Zétele: o Zétele pode ser uma das ações da paleta.
10. **Revisão visual de acessibilidade**:
    - vidro só nas molduras;
    - contraste de 4,5:1 no texto e 3:1 no resto;
    - números alinhados (`tabular-nums`);
    - toque de 24 px ou mais (de preferência bem mais);
    - nada fixo cobrindo o foco;
    - carregamento e "atualizado há X" coerentes.

**O que não consegui ler direto:** as regras de Menu e Header do gov.br DS, o Polaris (ficou só pela busca), o Atlassian (a página veio vazia), a página oficial do Material 3 (usei a documentação do Android) e a da Apple (só pela busca). Os exemplos de produto sem link (Gmail, Linear e Vercel na barra lateral, GitHub na linha do tempo) são observações minhas, não afirmações de fonte.

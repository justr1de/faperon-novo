# Dificuldades da elaboração do projeto

Registro cronológico por área, atualizado em 24/09/2026. Cada entrada tem sintoma, causa, solução ou contorno e status. Os itens ainda pendentes também aparecem em [em-aberto.md](em-aberto.md).

## Ambiente de desenvolvimento

### Não há Python no computador de desenvolvimento

- **Sintoma:** `python` abre a Microsoft Store; `pytest`, `ruff` e `mypy` não rodam no host.
- **Causa:** o Windows do notebook não tem Python instalado, e o backend não deve depender disso (ADR 0010).
- **Solução:** todo o backend roda em Docker. Para testar sem subir o compose inteiro: `docker compose run --rm --no-deps -v "$(pwd -W)/apps/api:/app" api-dev pytest`. O volume monta o código atual por cima da imagem.
- **Status:** contornado.

### `make` não existe no Windows

- **Sintoma:** `make up` falha com comando não encontrado.
- **Causa:** o Windows não traz `make`.
- **Solução:** o `Makefile` serve de referência; copie os comandos dele ou instale o `make`.
- **Status:** contornado.

### Quebra de linha do Windows quebra o container

- **Sintoma:** risco de o `entrypoint.sh` receber CRLF num clone no Windows e falhar ao rodar no container Linux.
- **Causa:** o Git no Windows converte LF em CRLF por padrão (`core.autocrlf`); o Git avisa "LF will be replaced by CRLF".
- **Solução:** `.gitattributes` fixa `eol=lf` para todos os arquivos e para `*.sh`, e `crlf` para `*.ps1`.
- **Status:** resolvido.

### O Git Bash altera argumentos que começam com `/`

- **Sintoma:** em scripts com `curl`, os rótulos impressos saem como `C:/Program Files/Git/api/v1/...`.
- **Causa:** o Git Bash converte argumentos que parecem caminhos Unix em caminhos do Windows.
- **Solução:** imprimir com `printf '%s %s\n' "$rota" "$resultado"` ou definir `MSYS_NO_PATHCONV=1` antes do comando. Só o rótulo era afetado, não a requisição.
- **Status:** contornado.

### `curl` interpreta colchetes da API do IBGE

- **Sintoma:** a consulta `localidades=N6[N3[11]]` volta vazia.
- **Causa:** o `curl` trata `[]` como padrão de expansão (globbing).
- **Solução:** usar `curl -g` (ou `--globoff`). A API de agregados usa `|` para separar períodos.
- **Status:** resolvido.

### Portas do E2E ficam ocupadas depois de uma interrupção

- **Sintoma:** `npm run test:e2e` falha com `http://localhost:8001/api/v1/saude is already used`.
- **Causa:** um processo do mock (8001) ou do Next (3100) ficou vivo depois de um teste interrompido.
- **Solução:** encerrar o processo que escuta na porta. No PowerShell: `Get-NetTCPConnection -LocalPort 8001 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`.
- **Status:** contornado.

### Teste E2E de comparação intermitente

- **Sintoma:** o teste "comparação: municípios, produtos e bloqueio de unidades diferentes" falhava de vez em quando: o item removido reaparecia.
- **Causa:** corrida entre o clique em remover e a seleção seguinte, que usavam o estado da URL antes de ela atualizar.
- **Solução:** o teste espera o botão de remoção sumir antes de selecionar o próximo produto.
- **Status:** resolvido.

### Extensão do Chrome não conectada

- **Sintoma:** as ferramentas do navegador respondem "Browser extension is not connected".
- **Causa:** a extensão não estava conectada à conta usada na sessão.
- **Solução:** a verificação visual passou a ser feita com o Playwright do próprio projeto (capturas de tela lidas e comparadas).
- **Status:** contornado.

### Git sem nome de autor configurado

- **Sintoma:** o `git config user.name` está vazio; só o e-mail está definido.
- **Causa:** a identidade global do Git não foi configurada no notebook.
- **Solução:** os commits usaram `git -c user.name=ViniciusP0 -c user.email=...` sem alterar a configuração. Quem for commitar deve configurar o próprio nome.
- **Status:** em aberto.

### Edição em paralelo de arquivos compartilhados

- **Sintoma:** risco de dois agentes editarem o mesmo arquivo (compose, contrato da API, README) ao mesmo tempo.
- **Causa:** o trabalho de backend e frontend foi feito em paralelo.
- **Solução:** cada frente só toca o próprio diretório (`apps/api` ou `apps/web`); compose, docs e infra ficam com uma pessoa só. O contrato `docs/api-contract.md` é o ponto de integração.
- **Status:** contornado.

## Dados do IBGE (SIDRA)

### Catálogo menor que o esperado

- **Sintoma:** o plano falava em 89 produtos; o painel mostra 52 culturas e 16 itens de pecuária.
- **Causa:** o IBGE publica cerca de 52 culturas com dado para Rondônia na tabela 5457.
- **Solução:** o catálogo é o que o IBGE publica (ADR 0016), sem lista mantida à mão.
- **Status:** resolvido.

### Valores sigilosos e ausentes

- **Sintoma:** a API do IBGE devolve `"X"`, `"-"` e `"..."` no lugar de números.
- **Causa:** sigilo estatístico e dado inexistente.
- **Solução:** viram estado explícito (`sigiloso` e `inexistente`), nunca zero. Só o `X` é gravado como linha; `-` e `...` não geram linha. O ranking mostra "X" no fim.
- **Status:** resolvido.

### Valor da produção em moedas antigas

- **Sintoma:** a série de "valor da produção" mistura cruzeiros, cruzados e reais.
- **Causa:** o IBGE publica a unidade que valia em cada época.
- **Solução:** só entram os anos de 1994 em diante, em Mil Reais.
- **Status:** resolvido.

### Unidade do leite varia e não bate com a exibição

- **Sintoma:** a produção de origem animal muda de unidade por produto (mil litros, mil dúzias, quilogramas); "619.456" parecia pouco para o leite.
- **Causa:** o IBGE publica o leite em mil litros.
- **Solução:** a unidade fica no vínculo produto e indicador. Na home, o leite é convertido para litros (`normalizarDestaque`); no painel continua em mil litros, como o IBGE publica.
- **Status:** resolvido.

### Anos de referência diferentes entre pesquisas

- **Sintoma:** a soja tem dado de 2025, e o leite e o rebanho, de 2024.
- **Causa:** a PAM e a PPM são publicadas em datas diferentes.
- **Solução:** a manchete mostra o ano entre parênteses quando difere do da soja. Como a ingestão roda a cada 3 dias, o "último ano" mudou de 2024 para 2025 durante o desenvolvimento; por isso nada usa ano fixo e os "números de ouro" dos testes vêm de respostas gravadas.
- **Status:** resolvido.

### Ingestão lenta

- **Sintoma:** a primeira carga completa das três tabelas leva alguns minutos.
- **Causa:** a API limita valores por consulta, então a ingestão consulta um produto por vez.
- **Solução:** a demo carrega o snapshot `data/seed/faperon-seed.json.gz` com `make seed`, sem depender do IBGE na hora.
- **Status:** contornado.

## Frontend

### Reescritas do Next fixadas no build

- **Sintoma:** no container, o site respondia `ECONNREFUSED` para `localhost:8000`, mesmo com `API_INTERNAL_URL` definida.
- **Causa:** os `rewrites` do `next.config` são resolvidos na hora do build.
- **Solução:** o proxy virou um route handler (`src/lib/proxy.ts`) que lê `API_INTERNAL_URL` em tempo de execução.
- **Status:** resolvido.

### Páginas estáticas congelavam o erro da API

- **Sintoma:** risco de o build do Docker (sem API no ar) gravar a versão de erro do Início e servi-la por minutos.
- **Causa:** ISR em páginas que buscam dados da API.
- **Solução:** Início e Central usam `dynamic = "force-dynamic"`, com cache de dados de 60 segundos.
- **Status:** resolvido.

### Opacidade do Tailwind não funciona com tokens em variável CSS

- **Sintoma:** o degradê de leitura sobre a foto do hero não aparecia e o texto ficava ilegível.
- **Causa:** as cores do tema são variáveis CSS (`var(--brand-dark)`); o Tailwind não gera modificadores de opacidade como `from-brand-dark/95` para elas.
- **Solução:** os degradês usam `rgba(...)` em `style`. Regra: para transparência sobre imagens, use rgba explícito.
- **Status:** resolvido.

### Slides com alturas diferentes no carrossel

- **Sintoma:** em celular e tablet, a foto do slide 1 não preenchia a altura e sobrava uma faixa branca.
- **Causa:** os slides ficam empilhados numa grade e a altura é a do mais alto; o slide com foto não esticava.
- **Solução:** `[&>*]:h-full` nos slides.
- **Status:** resolvido.

### Menu quebrava em duas linhas perto de 1024 px

- **Sintoma:** itens do menu como "Central de Inteligência" ocupavam duas linhas.
- **Causa:** o menu horizontal não cabe ao lado da marca em larguras médias.
- **Solução:** o menu horizontal só aparece a partir de 1280 px; abaixo disso é o botão de menu.
- **Status:** resolvido.

### Setas do carrossel sobre o texto

- **Sintoma:** em larguras médias, as setas laterais cobriam o começo do texto do slide.
- **Causa:** o texto começa perto da borda da tela.
- **Solução:** abaixo de 1280 px as setas ficam nos cantos inferiores; a partir dessa largura ficam nas laterais, fora da coluna de texto.
- **Status:** resolvido.

### Acessibilidade do carrossel automático

- **Sintoma:** conteúdo que troca sozinho atrapalha leitores de tela e quem precisa de mais tempo (WCAG 2.2.2).
- **Causa:** rotação automática a cada 6 segundos.
- **Solução:** botão de pausar, pausa com mouse, foco e toque, nenhuma rotação para quem pede menos movimento, slides inativos fora da árvore de acessibilidade e região com `aria-live` só quando parado.
- **Status:** resolvido.

### Espaço fino nos números da manchete

- **Sintoma:** os testes não encontravam "2,6 mi de toneladas" mesmo com o texto na tela.
- **Causa:** a formatação compacta do `Intl` e a manchete usam espaço sem quebra (NBSP) entre o número e "de".
- **Solução:** os testes normalizam o NBSP ou usam expressões que não dependem do espaço.
- **Status:** resolvido.

### Concordância no texto da tendência

- **Sintoma:** o texto dizia "queda médio de".
- **Causa:** o adjetivo era fixo no masculino.
- **Solução:** "crescimento médio" e "queda média", no front e no PDF, com teste.
- **Status:** resolvido.

## Demo pelo Tailscale

### A porta 443 do Funnel já estava em uso

- **Sintoma:** `tailscale funnel --bg 3000` substituiria um app que já estava publicado (porta 3001).
- **Causa:** o Funnel só aceita as portas 443, 8443 e 10000, e a 443 já servia outro projeto.
- **Solução:** a demo usa a porta 8443: `tailscale funnel --bg --https=8443 3000`. O endereço termina em `:8443`.
- **Status:** contornado.

### O Funnel parava de aceitar acessos de fora, e o teste local não mostrava

- **Sintoma:** o site abria no notebook, mas não no celular fora da rede: `ERR_CONNECTION_CLOSED`. Isso valia para as duas portas do Funnel (443 e 8443).
- **Causa:** o Funnel do notebook deixou de receber conexões dos nós de entrada do Tailscale (nenhum pacote chegava, e `tailscale funnel status` seguia dizendo "Funnel on"). O reparo foi religar o Funnel. A causa exata não foi identificada. Além disso, os testes feitos no próprio notebook enganavam: o nome `*.ts.net` resolve para o IP da tailnet (`100.x`), então o acesso nunca passava pela entrada pública.
- **Solução:** para testar de verdade, conectar direto ao IP público de entrada (`nslookup` mostra os IPs `209.177.145.x`): `curl --resolve vinicin.tail3fe9ce.ts.net:8443:209.177.145.97 https://vinicin.tail3fe9ce.ts.net:8443/`, ou abrir o link no celular com dados móveis. Para reparar: `tailscale funnel --https=8443 off` e depois `tailscale funnel --bg --https=8443 3000`.
- **Status:** contornado. Se voltar a acontecer, repetir o reparo. Em 26/09/2026, logo depois de o notebook acordar, o teste pela entrada pública respondeu 200 nas duas portas sem precisar do reparo. Ou seja, este problema não acontece em toda retomada, e a hipótese de ligação com a suspensão (ver "A demo depende do notebook") não foi provada. Os logs do serviço Tailscale (`C:\ProgramData\Tailscale`) exigem administrador e não foram lidos.

### Webhook do GitHub não conectava numa porta de Funnel inválida

- **Sintoma:** o webhook do deploy automático respondia 401/200 em teste local (`curl` no próprio `dt-server`), mas o GitHub reportava "Falha de conexão com o host" em toda entrega.
- **Causa:** o Funnel do Tailscale só aceita as portas 443, 8443 e 10000; o webhook foi publicado na 8444, que o CLI aceita sem erro (`tailscale funnel status` mostrava "Funnel on") mas a infraestrutura pública de entrada não roteia. Testar do próprio `dt-server` enganava porque o nome resolve para o IP da tailnet, não passando pela entrada pública (mesmo problema da seção acima).
- **Solução:** publicar em `:10000` (`tailscale funnel --bg --https=10000 9001`), já que 443 é o site e 8443 já está em uso por outro serviço. Testar com `curl --resolve <nome>:<porta>:<IP público>` antes de cadastrar no GitHub.
- **Status:** resolvido. Confirmado com um `push` real em 28/09/2026 (este commit): webhook entregue, assinatura validada (202) e `deploy.sh` executado.

### O link público expunha a documentação da API

- **Sintoma:** `/api/schema/` e `/api/docs/` abriam pelo endereço público.
- **Causa:** o proxy do Next repassava qualquer caminho `/api/*` ao Django.
- **Solução:** o proxy só encaminha `/api/v1/`; o resto responde 404, com teste.
- **Status:** resolvido.

### A demo depende do notebook

- **Sintoma:** o link cai quando o notebook dorme, reinicia ou perde a rede.
- **Causa:** a demo roda no notebook de um desenvolvedor (decisão 15 do plano). Investigado em 26/09/2026 pelo log de eventos do Windows: nos 7 dias anteriores o notebook entrou em suspensão 22 vezes, cerca de 93 h fora do ar. Não é o Tailscale que desliga, é o notebook que suspende, e o Tailscale, o Docker e o Next.js param junto. Motivos registrados: `Application API` (suspender pelo menu Iniciar), `Button or Lid` (tampa ou botão), `System Idle` e `Battery`, além da hibernação após 3 h suspenso (`Hibernate from Sleep - Fixed Timeout`). O esquema de energia "Acer" suspende após 10 min na bateria e hiberna após 3 h, e o notebook alterna entre tomada e bateria quase todo dia. Houve suspensão por inatividade mesmo na tomada (22/09, 23/09 e 25/09); não foi confirmado se a configuração mudou depois. Ao conferir, o serviço Tailscale estava ativo (início automático), a rede sem problemas (UDP ok, relay de São Paulo) e os 4 containers `healthy`, então depois de acordar tudo volta sozinho.
- **Solução:** `restart: unless-stopped` (depois `always`, ver commit `163d028`), Docker e Tailscale iniciando com o sistema e o checklist em `infra/demo-checklist.md`. Isso só recupera o serviço depois de acordar, não evita a queda. Para evitá-la durante a demo: notebook na tomada, sem suspensão nem hibernação e sem ação ao fechar a tampa (comandos em `infra/demo-checklist.md`, terminal como administrador). Para ser avisado das quedas: monitor de disponibilidade externo apontando para a URL `:8443`. Solução definitiva: rodar `docker compose` e o Funnel num servidor sempre ligado; o `dt-server` (Linux, já na tailnet) é candidato.
- **Status:** resolvido em 28/09/2026 pela solução definitiva prevista acima: `docker compose` e o Funnel passaram a rodar no `dt-server` (sempre ligado), não mais no notebook. O deploy também passou a ser automático via webhook (ADR 0021), sem precisar acessar a máquina manualmente a cada mudança.

## Migração de conteúdo do Wix

### Endereços do Wix não seguem o nome da página

- **Sintoma:** os links "Sobre", "Informativos Técnicos", "Fale Conosco", "Transparência" e "Ver todas as notícias" davam 404.
- **Causa:** os endereços foram deduzidos (`/sobre`, `/fale-conosco`...), mas o Wix usa nomes como `/blank-6` e `/news`.
- **Solução:** `WIX_PAGINAS` em `src/lib/site.ts` guarda os endereços reais, conferidos em 24/09/2026, com teste que impede voltar aos deduzidos.
- **Status:** resolvido. Em 25/09/2026, por decisão do cliente, Sobre, Informativos Técnicos e Fale Conosco deixaram de ser links externos e passaram a ser rotas internas (`/sobre`, `/informativos-tecnicos`, `/fale-conosco`) com conteúdo real copiado do Wix; o teste de `site.ts` agora cobre a existência do `page.tsx` de cada rota em vez de proibi-las.

### O painel do site atual não tem API

- **Sintoma:** não há um serviço para reaproveitar na migração.
- **Causa:** o painel original é uma página HTML embutida (`filesusr.com`) com Chart.js que consulta o IBGE direto no navegador.
- **Solução:** o painel foi reescrito (Django e Next). A regra da linha de tendência foi lida no código original e reproduzida sem o defeito de tratar anos sem dado como zero.
- **Status:** resolvido.

### Notícias sem API de conteúdo

- **Sintoma:** não há como buscar as notícias do Wix por API.
- **Causa:** o site Wix não expõe uma API pública de conteúdo.
- **Solução:** `npm run importar:noticias` lê o feed RSS do blog e grava `src/content/noticias.json` e as imagens. São 20 notícias; uma não tem imagem por ser um vídeo do YouTube. Mudanças no HTML do Wix podem exigir ajuste (ADR 0018).
- **Status:** contornado.

### Banners do SENAR são imagens com texto embutido

- **Sintoma:** o texto dos banners não é editável e fica pequeno no celular.
- **Causa:** o Wix guarda cada banner como uma imagem pronta.
- **Solução:** o texto do banner vai no atributo `alt`, o formato da imagem não é cortado e as imagens ficam em `public/senar/`.
- **Status:** contornado.

### Mudança de rumo: sem Wagtail

- **Sintoma:** o CMS já estava implementado (Wagtail 7.4) quando o cliente decidiu não usá-lo.
- **Causa:** decisão do cliente durante o projeto.
- **Solução:** o app de conteúdo e o admin saíram do Django; o conteúdo editorial passou para `apps/web/src/content` (ADR 0020, que substitui a 0004). As tabelas antigas do Wagtail continuam no banco já existente, sem efeito.
- **Status:** resolvido.

## Zétele (17/10/2026)

### Testes do backend com o código montado falham no entrypoint
- **Sintoma:** `docker compose run --rm -v "$PWD/apps/api:/app" api-dev pytest` falha com `exec /app/entrypoint.sh: permission denied`.
- **Causa:** o `entrypoint.sh` está no git sem bit de execução (100644); a imagem faz `chmod +x`, mas o volume montado esconde a cópia da imagem.
- **Solução ou contorno:** `docker compose run --rm --entrypoint "" -v "$PWD/apps/api:/app" api-dev <comando>` (o entrypoint só faz `exec "$@"` para comandos avulsos).
- **Status:** contornado.

### `src/lib/tema.test.ts` falha no Node 26
- **Sintoma:** 3 testes falham com `localStorage` indefinido ao rodar `npm test` no Node 26.8.1 local.
- **Causa:** mudança de ambiente do Node 26 com o jsdom; não é do Zétele (falha também sem as mudanças).
- **Solução ou contorno:** `apps/web/vitest.config.ts` passa `--no-experimental-webstorage` aos workers do Vitest; o `localStorage` do Node deixava de esconder o do jsdom.
- **Status:** resolvido.

### Remoção de fundo da arte do Zétele
- **Sintoma:** o modelo padrão do `rembg` 2.0.85 (`bria-rmbg`) deixava o branco dos olhos transparente; o `u2net` deixava o vão entre braço e tronco e a sombra.
- **Causa:** modelos de segmentação erram em arte de contorno e cores chapadas; o `bria-rmbg` tem ainda licença não comercial.
- **Solução ou contorno:** `apps/web/scripts/recortar-zetele.py` fixa `u2net` e limpa a máscara (maior componente, buracos pequenos, vão do braço).
- **Status:** resolvido.


### Chapéu bege furado no recorte da arte nova do Zétele (camisa FAPERON)
- **Sintoma:** com a arte nova, o chapéu claro saiu com furos e manchas translúcidas; a regra antiga só fechava buracos com menos de 2.000 px.
- **Causa:** o `u2net` dá máscara parcial em áreas claras grandes dentro da figura; a regra do "vão do braço" (pixel com mínimo ≥ 225) também não distinguia fundo de bege claro.
- **Solução ou contorno:** `recortar()` agora deixa opaco tudo dentro da silhueta preenchida, menos manchas grandes de branco puro (mínimo do canal ≥ 250), que são o fundo visível entre braço e tronco. Conferir sempre o recorte sobre fundo magenta e escuro antes de publicar.
- **Status:** resolvido.

## Voz do Zétele do sistema (18/10/2026, ADR 0034)

### `Permissions-Policy: microphone=()` bloqueava o microfone no próprio site
- **Sintoma:** risco de o `getUserMedia` falhar com `NotAllowedError` em todas as páginas, mesmo com a pessoa permitindo.
- **Causa:** o `next.config.mjs` mandava `microphone=()`, que proíbe o microfone também para o próprio site. Como a navegação do Next é feita no cliente, a política vale para o documento em que a pessoa entrou, não só para `/sistema`.
- **Solução ou contorno:** `microphone=(self)` no site inteiro. Sites embutidos continuam sem microfone, e o navegador ainda pede permissão.
- **Status:** resolvido.

### O proxy do Next decodificava o corpo como texto
- **Sintoma:** risco de o áudio enviado ao `/ouvir` chegar corrompido ao Django (bytes que não são UTF-8 viram U+FFFD) ou levar `413` (limite de 16 KB).
- **Causa:** `src/lib/proxy.ts` lia o POST e fazia `TextDecoder().decode()`, com o limite pensado para o JSON do Zétele.
- **Solução ou contorno:** só a rota `/api/v1/sistema/zetele/ouvir` com `multipart/form-data` passa os bytes intactos, com limite de 3 MB + 64 KB. O resto continua como texto e com 16 KB. Há testes em `proxy.test.ts`.
- **Status:** resolvido.

### `ruff format .` reformata arquivos que não são do Zétele
- **Sintoma:** `ruff format .` (ou `--check .`) mexe em cerca de 21 arquivos de `analise/`, `observatorio/`, `ingestao/`, `indicadores/` e testes.
- **Causa:** o CI roda só `ruff check`, não `ruff format --check`. O formato do repositório nunca foi aplicado por inteiro.
- **Solução ou contorno:** formatar só os arquivos alterados (`ruff format zetele tests/test_zetele_audio.py`). Se o formato for aplicado ao repositório inteiro um dia, isso deve sair num commit separado.
- **Status:** contornado.

### Testes de voz no Vitest (jsdom)
- **Sintoma:** `Not implemented: HTMLMediaElement.prototype.pause` no fim dos testes, e o corpo de um `Request` montado com `FormData` vira o texto `[object FormData]`.
- **Causa:** o jsdom não implementa áudio. Além disso, o `afterEach` do teste devolvia o `pause` original antes do `cleanup` do `vitest.setup.ts` desmontar o componente. O `FormData` do jsdom também não é o do Node, que monta o `Request`.
- **Solução ou contorno:** simular `play` e `pause` com `vi.spyOn`, chamar `cleanup()` antes do `vi.restoreAllMocks()` e montar o multipart à mão nos testes do proxy. O limite de 60 s é testado no hook, com um limite de 1 s (os temporizadores falsos travam o `findBy`).
- **Status:** contornado.

### Worktree sem `.env` não roda o `docker compose`
- **Sintoma:** `docker compose run ... api-dev` falha com `env file .../.env not found`.
- **Causa:** o `.env` fica fora do git (o compose exige o arquivo), e um worktree novo não o tem.
- **Solução ou contorno:** `cp .env.example .env` no worktree. É suficiente para os testes, que criam o próprio banco `test_*`.
- **Status:** contornado.

## Indicadores do sistema (18/10/2026)

### Legenda do ECharts com a cor errada
- **Sintoma:** nas barras empilhadas, os quadradinhos da legenda saíam na paleta padrão do ECharts (azul, verde-claro) e não batiam com as barras.
- **Causa:** a cor estava só em cada barra (`data[].itemStyle.color`); a legenda usa a cor da série.
- **Solução ou contorno:** `components/sistema/indicadores/graficos.ts` põe a cor também em `series.itemStyle.color`.
- **Status:** resolvido.

### Rótulo do eixo cortado na borda esquerda
- **Sintoma:** "Evento institucional", "Comunicação" e "Sala da presidência" perdiam a primeira letra nas barras deitadas.
- **Causa:** o `containLabel` mede o rótulo com a fonte do eixo; sem `fontFamily` no `axisLabel`, mediu com a fonte padrão, mais estreita que a Poppins.
- **Solução ou contorno:** fonte explícita no `axisLabel` e `grid.left` de 10 px.
- **Status:** resolvido.

### Captura de página inteira pega os gráficos se redesenhando
- **Sintoma:** no `page.screenshot({ fullPage: true })` a 390 px, barras saíam deslocadas e rótulos sumiam; na tela real estava certo.
- **Causa:** a captura de página inteira muda a janela no meio, e o `ResizeObserver` do `Grafico` redesenha.
- **Solução ou contorno:** abrir a janela na altura da página, esperar e capturar sem `fullPage`.
- **Status:** contornado.

### Medida do cabeçalho logo depois de abrir a página
- **Sintoma:** a 1024 px a primeira medida deu folga de 16 px e 18 px de rolagem horizontal; repetida, deu 40 px e zero.
- **Causa:** a medida saiu antes de a Poppins carregar, com a fonte de reserva, mais larga.
- **Solução ou contorno:** o e2e espera `document.fonts.ready` antes de medir.
- **Status:** resolvido.
## Login de verdade (18/10/2026, ADR 0035)

### Com sessão, o `ScopedRateThrottle` do DRF passa a contar por usuário
- **Sintoma:** risco de os limites do Zétele do sistema deixarem de ser por IP depois de exigir login (o teste "outro IP passa" quebraria).
- **Causa:** o `ScopedRateThrottle` usa `request.user.pk` quando há usuário autenticado e só cai no IP para anônimos.
- **Solução ou contorno:** `usuarios/throttles.py` tem o `ScopedPorIPThrottle`, que sempre usa o IP (último X-Forwarded-For, ADR 0023). O Zétele e o login usam esse.
- **Status:** resolvido.

### O `APIClient` não confere o CSRF
- **Sintoma:** testes de POST com sessão passam mesmo sem o cabeçalho `X-CSRFToken`.
- **Causa:** o cliente de teste marca o pedido para pular o CSRF.
- **Solução ou contorno:** os testes que provam o CSRF usam `APIClient(enforce_csrf_checks=True)` (fixture `navegador` em `tests/test_usuarios_conta.py`).
- **Status:** contornado.

### `Set-Cookie` no proxy do Next
- **Sintoma:** com `headers.get("set-cookie")`, os dois cookies do login (sessão e CSRF) viriam juntos numa linha, separados por vírgula, e o navegador leria errado.
- **Causa:** o `Headers` do fetch junta valores repetidos.
- **Solução ou contorno:** `res.headers.getSetCookie()` e um `append` por cookie (teste em `proxy.test.ts`).
- **Status:** resolvido.

### `userEvent.setup()` troca a área de transferência
- **Sintoma:** o espião em `navigator.clipboard.writeText` definido antes do `setup()` nunca era chamado no teste do "Copiar".
- **Causa:** o user-event instala uma área de transferência própria no `setup()`.
- **Solução ou contorno:** criar o espião depois: `const user = userEvent.setup(); vi.spyOn(navigator.clipboard, "writeText")`.
- **Status:** contornado.

### Worktree e o compose dividem o projeto `faperon`
- **Sintoma:** `docker compose build api-dev` numa worktree regrava a imagem `faperon-api-dev` do checkout principal, e o `pytest` de dois agentes usaria o mesmo banco `test_faperon`.
- **Causa:** o `docker-compose.yml` fixa `name: faperon`, então toda worktree usa o mesmo projeto, as mesmas imagens e o mesmo Postgres.
- **Solução ou contorno:** para dependência nova, construir uma imagem com nome próprio (`docker build --target dev -t faperon-api-dev-<tarefa> apps/api`) e rodar com `docker run --network faperon_default --env-file .env -e POSTGRES_HOST=db -e POSTGRES_DB=faperon_<tarefa>`. O banco de teste vira `test_faperon_<tarefa>`.
### O compose de um worktree usa o banco da pasta principal
- **Sintoma:** risco de `migrate`, `seed` ou uma carga rodados num worktree gravarem no Postgres que atende o site em 3000/8000.
- **Causa:** o `docker-compose.yml` fixa `name: faperon`; de qualquer pasta, o `docker compose run api-dev` sobe no mesmo projeto e usa o `faperon-db-1`.
- **Solução ou contorno:** no worktree, sempre `docker compose -p <outro-nome> run ...` (ex.: `-p faperon-credito`), que cria banco e volume próprios.
- **Status:** contornado.

## Crédito rural, SICOR do Banco Central (18/10/2026, ADR 0036)

### O OData do SICOR não aceita `$skip`
- **Sintoma:** `$top=2&$skip=10` (com ou sem `$orderby`) responde `500 {"codigo": 500, "mensagem": "Erro desconhecido"}`.
- **Causa:** limitação do serviço Olinda do BCB.
- **Solução ou contorno:** paginação por período em `credito/sicor.py`: o ano inteiro com `$top` de 20.000 e, se a resposta enche, mês a mês; um mês que ainda enche é erro (não soma pela metade).
- **Status:** contornado.

### Espaço como `+` no `$filter` dá 400
- **Sintoma:** a primeira carga real falhou em todos os anos com `HTTP 400: The types 'Edm.Boolean' and 'Edm.String' are not compatible.`; com `curl` e `%20` a mesma consulta funcionava.
- **Causa:** o `requests` codifica o espaço dos `params` como `+`, e o Olinda não o lê como espaço.
- **Solução ou contorno:** a URL é montada com `urlencode(..., quote_via=quote)`; há um teste que exige `%20` e nenhum `+`.
- **Status:** resolvido.

### Chamadas simultâneas ao SICOR recebem 500
- **Sintoma:** seis consultas em paralelo: três voltaram 500; repetidas uma a uma, todas deram 200.
- **Causa:** o serviço não aguenta concorrência (cada chamada já leva de 5 a 20 s).
- **Solução ou contorno:** o cliente faz uma chamada por vez, com 4 tentativas e espera crescente.
- **Status:** contornado.

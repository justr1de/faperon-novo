# ADRs

Decisões de arquitetura no formato MADR (Contexto, Opções, Decisão, Consequências). Decisão aceita não é editada: uma nova ADR a substitui e a antiga recebe o status "Substituída por ADR NNNN".

- [0001](0001-registrar-decisoes-em-adrs-madr-no-repositorio.md) — Registrar decisões em ADRs (MADR) no repositório
- [0002](0002-sair-do-wix-para-plataforma-propria.md) — Sair do Wix para plataforma própria
- [0003](0003-monorepo-com-apps-web-next-js-e-apps-api-django.md) — Monorepo com `apps/web` (Next.js) e `apps/api` (Django)
- [0004](0004-wagtail-como-cms-headless.md) — Wagtail como CMS headless (substituída pela 0020)
- [0005](0005-postgresql-com-star-schema-e-views-materializadas.md) — PostgreSQL com star schema e views materializadas
- [0006](0006-ingestao-via-api-sidra-a-cada-3-dias-com-staging-hash-e-carg.md) — Ingestão via API SIDRA a cada 3 dias, com staging, hash e cargas versionadas
- [0007](0007-analise-estrategica-por-regras-deterministicas.md) — Análise estratégica por regras determinísticas
- [0008](0008-pdf-no-servidor-com-weasyprint.md) — PDF no servidor com WeasyPrint
- [0009](0009-echarts-para-graficos.md) — ECharts para gráficos
- [0010](0010-tudo-em-docker-compose-prototipo-local-producao-na-infra-da-.md) — Tudo em Docker Compose; protótipo local, produção na infra da FAPERON
- [0011](0011-tipos-ts-gerados-do-openapi-do-django.md) — Tipos TS gerados do OpenAPI do Django
- [0012](0012-redirects-301-de-todas-as-urls-do-wix-fase-de-producao.md) — Redirects 301 de todas as URLs do Wix (fase de produção)
- [0013](0013-prototipo-evolutivo-com-operacao-enxuta-sem-celery-redis-age.md) — Protótipo evolutivo com operação enxuta: sem Celery/Redis, agendamento por container `scheduler`, PDF síncrono
- [0014](0014-acesso-externo-por-tailscale-funnel-aberto-so-o-next-js-expo.md) — Acesso externo por Tailscale Funnel aberto; só o Next.js exposto; admin via tailnet
- [0015](0015-ranking-pelo-ano-final-do-periodo.md) — Ranking pelo ano final do período
- [0016](0016-catalogo-de-produtos-o-publicado-pelo-ibge-para-ro.md) — Catálogo de produtos = o publicado pelo IBGE para RO
- [0017](0017-snapshot-do-banco-versionado-em-data-seed.md) — Snapshot do banco versionado em `data/seed/`
- [0018](0018-noticias-importadas-do-wix-por-script-pontual-manage-py-impo.md) — Notícias importadas do Wix por script pontual (`manage.py import_wix_news`)
- [0019](0019-inicio-com-faixa-de-indicadores-rondonia-em-numeros.md) — Início com faixa de indicadores "Rondônia em números"
- [0020](0020-conteudo-editorial-no-codigo-sem-cms.md) — Conteúdo editorial no código, sem CMS
- [0021](0021-deploy-automatico-via-webhook-do-github.md) — Deploy automático via webhook do GitHub (vinicin; antes dt-server)
- [0022](0022-painel-em-pagina-narrativa-em-vez-de-abas.md) — Painel em página narrativa em vez de abas
- [0023](0023-ip-do-cliente-pelo-ultimo-x-forwarded-for-e-teto-global-de-pdf.md) — IP do cliente pelo último X-Forwarded-For e teto global de PDF
- [0024](0024-imagem-da-api-em-dois-estagios-producao-sem-root-e-sem-ferramentas-.md) — Imagem da API em dois estágios; produção sem root e sem ferramentas de dev
- [0025](0025-gunicorn-com-threads-e-renderizacao-de-pdf-serializada-com-espera-.md) — Gunicorn com threads e renderização de PDF serializada com espera limitada
- [0026](0026-animacoes-sutis-com-css-e-intersectionobserver.md) — Animações sutis com CSS e IntersectionObserver
- [0027](0027-pagina-de-noticias-como-listagem-que-aponta-para-o-wix.md) — Página de notícias como listagem que aponta para o Wix
- [0028](0028-observatorio-como-contexto-de-leitura-com-valores-deflacionados-pelo-ipca.md) — Observatório como contexto de leitura, com valores deflacionados pelo IPCA
- [0029](0029-zetele-assistente-com-llm-restrito-ao-site-e-numeros-conferidos-em-codigo.md) — Zétele, assistente com LLM restrito ao site e números conferidos em código
- [0030](0030-registro-anonimo-das-perguntas-do-zetele-por-90-dias.md) — Registro anônimo das perguntas do Zétele por 90 dias
- [0031](0031-prototipo-do-sistema-interno-so-no-front-com-dados-no-navegador.md) — Protótipo do sistema interno só no front, com dados fictícios no navegador
- [0032](0032-zetele-em-dois-canais-com-rag-proprio.md) — Zétele em dois canais (site público e sistema), cada um com RAG, banco e limites próprios
- [0033](0033-servidor-de-teste-no-brasil-preparado-para-o-whatsapp.md) — Servidor de teste próprio no Brasil (AWS São Paulo), preparado para a integração com o WhatsApp
- [0034](0034-zetele-do-sistema-ouve-e-fala.md) — Zétele do sistema ouve e fala: Groq para ouvir, Gemini para falar, fornecedor plugável
- [0035](0035-usuarios-reais-e-login-de-verdade.md) — Usuários reais no banco e login de verdade na área do sistema
- [0036](0036-painel-de-credito-rural-e-pronaf.md) — Painel de crédito rural e Pronaf com a matriz SICOR do Banco Central

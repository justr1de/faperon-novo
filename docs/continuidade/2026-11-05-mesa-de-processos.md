# Continuidade: mesa de processos (05/11/2026)

Ponto salvo a pedido do usuário, que ia reiniciar o computador. O usuário e o Weslley (encarregado de dados) acompanham juntos e vão ajustar o desenho durante a implementação.

## Onde estamos

- **Branch:** `feat/mesa-de-processos` (criado a partir do `feat/whatsapp-canal`), com backup no remoto `fork`.
- **Feito hoje:**
  - brainstorm completo;
  - desenho (`docs/superpowers/specs/2026-11-05-mesa-de-processos-design.md`);
  - épico 11 com os tickets e a **ordem de construção** (`docs/backlog/e11-mesa-de-processos.md`);
  - as três pesquisas de 28/10 versionadas;
  - o usuário mandou seguir ("pode escrever").
- **Em andamento:** ticket 11.0.2, o plano da entrega 1, **parte 1A (backend)**, a ser gravado em `docs/superpowers/plans/2026-11-05-mesa-entrega-1a-backend.md` com a skill `superpowers:writing-plans`. O arquivo ainda **não foi criado**. Os detalhes já decididos estão abaixo; ao retomar, é só escrever o plano a partir deles.
- **Depois do plano:** executar com `superpowers:subagent-driven-development`. Pela regra global, o Sonnet implementa e o Opus revisa e testa. Ao fim de cada tarefa: suíte verde, commit, atualizar a situação do ticket em `e11` e registrar os erros em `docs/erros-conhecidos/dificuldades.md`. Backup no `fork` depois das tarefas 5, 10 e 14.

## Ambiente conferido em 05/11

- O Docker funciona. Os testes do backend rodam assim (contorno do entrypoint, ver `dificuldades.md`):
  `docker compose run --rm --entrypoint "" -v "$PWD/apps/api:/app" api-dev pytest tests/<arquivo> -q`
- O Pillow 13.0.0 já está na imagem (vem com o WeasyPrint).
- Versões para fixar no `requirements.txt`: `pypdf==6.21.4`, `django-storages[s3]==1.14.6`, `boto3==1.43.124`. Para a entrega 3: `pyotp==2.10.0` e `pyhanko==0.38.1`.
- O projeto não usa o admin do Django. Cadastros são feitos por API e tela, e um comando carrega os dados de demonstração.
- As views seguem o padrão de `usuarios/views.py`: `ComSessao` com `SessaoAutenticacao` e `EstaLogado`, e os erros como `{"erro": ..., "campos": {}}`. Os testes usam as fixtures `criar_conta`, `api` e `api_logado` de `tests/conftest.py`, com a senha `SENHA_DE_TESTE`.
- O PDF sai do `analise.pdf.renderizar(html)`, que é serializado por trava (ADR 0025). É preciso acrescentar o parâmetro opcional `base_url`.

## Decisões técnicas do plano 1A (ainda não escritas no plano)

1. **Tarefas, na ordem da seção "Ordem de construção" do e11:**
   1. Organização e armazenamento.
   2. Cadastros e permissões básicas.
   3. Número da Ping.
   4. Numerador.
   5. Processo, presença nas mesas e andamentos.
   6. Abrir, enviar, ver, concluir, reabrir e as permissões.
   7. Atribuir, prazo, sobrestar, retomar, ciência e comentário.
   8. Documentos externos.
   9. Organização da mesa e consultas.
   10. Relacionamentos, exportação e "Remeter à Ping".
   11. API, parte 1.
   12. API, parte 2.
   13. API, parte 3.
   14. Fechamento: suíte, ruff, mypy, ADR 0038, erros, backlog e backup.
2. **Organização:** app `organizacoes` com `Organizacao(nome, sigla única, codigo_processo de 2 dígitos e único, sequencial_inicial, ativo)`. Uma migração de dados cria a FAPERON ("Federação da Agricultura e Pecuária do Estado de Rondônia", código `14`, inicial 5000). `organizacao_atual()` devolve a organização da `settings.ORGANIZACAO_PADRAO="FAPERON"` até a Etapa A.
3. **Armazenamento:** um storage nomeado `STORAGES["processos"]`. Com a variável `ARQUIVOS_S3_BUCKET`, usa o `storages.backends.s3.S3Storage` (`sa-east-1`, `location="processos"`, `file_overwrite=False`); sem ela, usa o `FileSystemStorage` em `ARQUIVOS_PASTA` (padrão `data/arquivos`).
   - **Não usar `FileField`.** O storage passado como callable é avaliado uma vez, quando o model carrega, e isso quebra a troca de storage nos testes. Guardar o nome do arquivo em `CharField` e acessar sempre por `armazenamento()` (`storages["processos"]`).
   - Nos testes, uma fixture autouse troca o `settings.STORAGES["processos"]` por uma pasta do `tmp_path`. O Django limpa o cache de storages no sinal `setting_changed`.
4. **Models do `processos` em pacote** (`models/cadastros.py`, `numeracao.py`, `processo.py`, `documento.py`, `mesa.py`). A `Unidade` tem os campos `dias_alerta_amarelo=7` e `dias_alerta_vermelho=15`. A lotação é única por (usuário, unidade) enquanto `fim` for nulo.
5. **Número:** módulo puro `processos/numero.py` com `montar(tipo, seq, org, data)`, `formatar(digitos)`, `so_digitos(texto)` e `ler(texto)` (NumeroProcesso).
   - A leitura vai do fim para o começo: os 2 últimos dígitos são o dia, os 4 anteriores o ano e os 2 antes deles o código da organização. O que sobra no meio é o sequencial, com no mínimo 4 dígitos. O regex de exibição é `^(\d{4})(\d+)(\d{4})(\d{2})$`.
   - O dia é o `timezone.localdate()` (Porto Velho).
   - Testes com `0181.205014/2026-29`, com o atípico `0399.001396/2024-23` e com propriedade (hypothesis) de ida e volta.
6. **Numerador:** **usar `ano=0` para "sem ano", nunca NULL.** O Postgres trata NULLs como diferentes no `UNIQUE`, e isso deixaria duplicar a linha do contador.
   - `proximo(org, escopo, ano=0, inicial=1)` exige estar dentro de `transaction.atomic` e faz `bulk_create(..., ignore_conflicts=True)` seguido de `UPDATE processos_numerador SET ultimo = ultimo + 1 ... RETURNING ultimo`.
   - O teste de concorrência usa 20 threads com `django_db(transaction=True)` e `connection.close()` em cada thread. Os testes de rollback e de "fora do atomic" também precisam de `transaction=True`, porque o `db` do pytest-django já roda dentro de um atomic.
7. **Andamentos:**
   - A cadeia é ordenada pelo `id` (sob a trava do processo), não pela hora.
   - O hash é o SHA-256 do JSON canônico (`sort_keys`, `separators=(",",":")`, `ensure_ascii=False`) com a hora em ISO UTC. Os `dados` não podem ter float.
   - Gatilho `BEFORE UPDATE OR DELETE`, **sem gatilho de TRUNCATE**, porque o flush dos testes `transaction=True` usa TRUNCATE.
   - Teste de adulteração: `ALTER TABLE ... DISABLE TRIGGER`, alterar, `ENABLE`, e conferir que a verificação acusa.
   - Ver o processo (`recebido_visualizado`) e dar ciência não atualizam o `ultimo_andamento_em`.
   - Toda operação que muda o processo trava a linha com `select_for_update` antes.
8. **Presença nas mesas (`ProcessoNaUnidade`):** tem `retorno_para`, a mesa que espera a volta. Quando o destino devolve o processo a ela, os campos de retorno são limpos. O sobrestamento vale para o processo inteiro e só é permitido se ele estiver aberto apenas naquela mesa; o processo sobrestado sai das abas, mas aparece no filtro "sobrestados".
9. **Erros de domínio** em `processos/erros.py`: `ErroDeRegra` vira 409, `SemPermissao` vira 403 e `NaoEncontrado` vira 404, todos no formato `{"erro","campos"}`.
10. **Idempotência ao abrir:** campo `chave_idempotencia` (UUID, único por organização quando preenchido). Se a mesma chave chegar de novo, o sistema devolve o processo que já existe e trata o `IntegrityError` de corrida.
11. **Upload:**
    - Conferido pelo conteúdo: `%PDF-` nos primeiros 1024 bytes, `\x89PNG\r\n\x1a\n` ou `\xff\xd8\xff`.
    - O PDF precisa abrir no pypdf, ter páginas e não ter senha. A imagem precisa passar no `Image.verify()` do Pillow. Limite de 30 MB.
    - O arquivo é guardado em `{org}/{processo}/{sha256}.{ext}` e nunca é sobrescrito.
    - O código de verificação tem 12 dígitos: 8 aleatórios mais 4 de conferência (`sha256(corpo) % 10000`).
12. **Exportação do PDF do processo:**
    - A capa e os andamentos saem de um template HTML renderizado pelo WeasyPrint. A descrição de cada andamento vem de `processos/descricao.py:descrever()`, usado também pela API.
    - Os documentos não cancelados são juntados com o pypdf; as imagens viram página PDF pelo Pillow.
    - A marca "Processo nº X · Folha i de N" vem de **uma única renderização** com uma página nomeada por tamanho (`@page pK {size: W H}`), sobreposta com `transfer_rotation_to_content()` e `merge_page`.
13. **API:** em `/api/v1/processos/...`, com a mesa que age informada pela `sigla` (`unidade`) e o processo pelo número em dígitos.
    - O detalhe do processo traz `acoes_permitidas` para a mesa informada.
    - A visualização é um POST explícito (`/visualizar`), não efeito colateral do GET.
    - O lote processa cada item na própria transação e devolve o resultado por número.
    - O upload tem limite `processos_arquivo` (60/min, por usuário).
    - O proxy do Next precisa aceitar corpos de 30 MB na rota de upload. Isso fica para o plano 1B.
14. **Dados de demonstração** (comando `carregar_mesas_demo`):
    - **Mesas:** COMINST, CONT, FIN, DP, COMPRAS e PRES.
    - **Tipos de processo:** 0181 "No País - Prestação de Contas", 0396 "Institucional", 0399 "Solicitação de Diárias" e 0397 "Processo de Compras".
    - **Tipos de documento:** Ofício, Memorando, Despacho, Documento externo, Nota fiscal e Comprovante.
    - **Lotações dos usuários de demonstração:** Marcos é gestor do COMINST, Carla é membro do COMINST e Ana é membro do FIN.
15. **S3 nos servidores:** a variável `ARQUIVOS_S3_BUCKET` e a política IAM do prefixo `processos/` entram quando a entrega for para o servidor de teste. Isso fica fora do plano 1A.

## Pendências com o usuário

As oito da seção 11 do desenho. As mais urgentes são os modelos de documento da Ping, os tipos com os códigos (inclusive o `0417`), os departamentos e as pessoas do COMINST.

## Como retomar

1. Ler este arquivo, o desenho e o `e11`.
2. Escrever `docs/superpowers/plans/2026-11-05-mesa-entrega-1a-backend.md` (skill writing-plans), uma tarefa por item da decisão 1, com o código completo e os testes.
3. Perguntar ao usuário o modo de execução (subagentes, recomendado) e começar pela tarefa 1.

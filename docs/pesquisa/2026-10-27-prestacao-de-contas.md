# Pesquisa: prestação de contas e gestão de despesas (27/10/2026)

Pesquisa feita por agente com WebSearch/WebFetch; os itens marcados "não confirmei" precisam do contador, do jurídico e do SENAR-RO.

A maioria das fontes sobre produtos é material do próprio fornecedor ou páginas de comparação. As fontes de lei foram lidas no Planalto. Quando não confirmei algo, digo isso no item.

**De quem são as exigências.** A FAPERON é uma entidade sindical, não faz parte do Sistema S, então a exigência legal muda conforme a origem do dinheiro:
- **Contribuição sindical compulsória:** o STF considerou que é recurso público e cabe ao TCU fiscalizar (MS 28465): https://www.dizerodireito.com.br/2014/05/os-tribunais-de-contas-podem-fiscalizar.html
- **Depois da Lei 13.467/2017:** a contribuição virou facultativa e a discussão continua (https://www.migalhas.com.br/depeso/281395/contribuicao-sindical--a-lei-13-467-17-e-o-dever-de-prestar-contas). **Não confirmei** se o TCU tem hoje jurisdição sobre o dinheiro próprio da FAPERON.
- **SENAR (Administração Regional):** ele sim presta contas ao TCU (https://www.sistemafaep.org.br/wp-content/uploads/2015/07/RelatorioGestao2014.pdf) e segue as normas do SENAR Central. O presidente da federação é presidente nato do conselho (https://sistemafaeg.com.br/storage/arquivos/3716294adb6c2b8ca1d64214d225dddb.pdf).
- **Termo de fomento ou de colaboração (Lei 13.019, o MROSC):** aí as regras do MROSC são lei.
- **Consequência para o sistema:** cada despesa precisa registrar a **fonte do recurso**, porque é ela que define as regras aplicáveis.

---

## 1. Fluxos e conceitos dos sistemas de referência

**Adiantamento e reembolso**
- No adiantamento o dinheiro sai antes da despesa; no reembolso, depois, com comprovantes. Se o gasto foi menor que o adiantado, o funcionário devolve a diferença por transferência ou desconto em folha. A política deve ter prazo de prestação de contas e prever o bloqueio de novo adiantamento para quem tem pendência (https://flashapp.com.br/blog/gerenciar-adiantamentos-reembolsos-prestacoes-contas).
- O adiantamento é pago antes e depois "aplicado" ao relatório de despesas (https://www-p04.intacct.com/ia/docs/en_US/help_action/Expenses/expense-report-process-overview.htm).
- Para recusar um adiantamento, o motivo é obrigatório. Depois de aprovado, ele fica "Aguardando Pagamento" (https://copasturhelpdesk.freshservice.com/support/solutions/articles/15000071706).
- Prazos de acerto que encontrei: 45 dias em Michigan, com desconto em folha se não houver acerto (https://finance.umich.edu/sites/default/files/2019-07/Employee-Travel-and-Expense-Concur.pdf); 60 dias em Penn State, ou 30 para recursos de projeto (https://procurement.psu.edu/travel-reimbursements); um fórum de contabilidade sugere o dia seguinte ao retorno (https://www.contabeis.com.br/forum/contabilidade/156828/prazo-de-reembolso-de-despesas-com-viagens/).
- **Desconto em folha:** o art. 462 da CLT permite descontar adiantamentos (https://modeloinicial.com.br/lei/CLT/array-0x55e12e79b758/art-462). **Não confirmei** se isso vale para o saldo de adiantamento de viagem. Precisa de parecer trabalhista.

**Relatório por viagem ou missão.** No Concur, a solicitação aprovada vira o relatório que acerta o adiantamento, e o relatório pode ser rateado entre vários centros de custo (https://training.finance.columbia.edu/content/reconciling-pre-trip-and-travelcash-advance-requests-concur).

**Alçadas de aprovação**
- No Expensify (modo "Advanced Approval"), aprovações em vários níveis podem depender do valor ("se o total passar de X, também aprova Y") (https://community.expensify.com/discussion/5591/deep-dive-setting-approval-limits-when-using-an-advanced-approval-workflow).
- Há uma trava que impede o funcionário de pular o fluxo (https://help.expensify.com/articles/expensify-classic/reports/Report-Approvals).
- Na Flash, o pedido vai ao responsável conforme o valor ou o centro de custo (link da Flash acima).
- Em uma universidade, entra uma etapa extra de contador do projeto quando o recurso é de convênio (https://pubweb2-prod.washburn.edu/faculty-staff/finance-office/Files/concur-approvals-workflows.pdf). É o modelo para a FAPERON tratar despesas de convênio.

**Segregação de funções.** O fluxo padrão de adiantamento do Concur tem supervisor e um administrador de adiantamentos separados (https://learning.sap.com/courses/working-with-primary-configuration-in-concur-expense-professional-edition/understanding-workflows). As regras "quem lança não aprova" e "quem aprova não paga" são boa prática; não achei norma que as exija da FAPERON.

**Diárias**
- Não integram a remuneração nem geram encargos (art. 457, §2º da CLT, após a reforma): https://cofen.gov.br/wp-content/uploads/2023/05/Parecer-Juridico-15-2021.pdf
- O TCU exige, na administração federal, ligação entre a viagem e a função do servidor e proíbe conceder a diária depois que a viagem começou (Acórdão 1151/2007): https://files.ufgd.edu.br/arquivos/arquivos/78/PROAP/Coletãnea%20ACÓRDÃOS%20TCU%20e%20DESPACHOS%20MP%20-%20DIÁRIAS%20E%20PASSAGENS.pdf
- Isso é boa prática para a FAPERON. **Não encontrei** a norma de diárias do SENAR.

**Quilometragem com veículo próprio**
- Tem natureza indenizatória quando é comprovada e não habitual (TRF1/STJ): https://www.cjf.jus.br/cjf/outras-noticias/2013/marco/contribuicao-social-previdenciaria-nao-incide-sobre-valores-pagos-a-titulo-de-reembolso-quilometragem
- Se for paga sempre e sem comprovação, pode virar salário: https://www.guiatrabalhista.com.br/guia/quilometragem.htm
- **Não existe valor oficial por km no Brasil**; a FAPERON tem de definir o seu.

**Cartão corporativo e conciliação.** O Expensify junta automaticamente a foto do recibo com a transação do cartão quando valor e data batem e há uma única candidata (https://help.expensify.com/articles/expensify-classic/expenses/How-to-prevent-duplicate-expenses).

**Política de despesas.** O Ramp bloqueia categorias e estabelecimentos e aplica limites antes do gasto. Um agente automático revisa e mostra só as exceções (https://ramp.com/expense-management).

**Por fase**
- **Essencial agora:** adiantamento separado do reembolso; relatório por viagem; devolução de saldo; alçada por valor e centro de custo; quem lança não aprova; diária e km por tabela interna.
- **Segunda fase:** cartão corporativo com conciliação da fatura; rateio entre centros de custo.
- **Exagero para o porte:** política diferente por cargo em matriz complexa; agente de política com IA.

---

## 2. Captura de comprovantes no Brasil

**NFC-e de Rondônia**
- A SEFIN/RO permite consultar a NFC-e pela chave ou pelo QR Code. O QR Code tem um código de segurança do fisco que autentica a nota (https://www.sefin.ro.gov.br/portalsefin/anexos/IN14-003-Estab.proced.-rel.-adesao-a-NFC-e.pdf).
- URL de consulta: `www.sefin.ro.gov.br/nfce/consulta`, mas a lista que a traz é de **2019**. Confirmar antes de usar (https://blog.tecnospeed.com.br/urls-de-consulta-da-chave-da-nfc-e-lista-completa-e-atualizada/).
- Um estudo da UFGD diz que a maioria dos apps que leem o QR Code aproveita só a data e o valor (https://repositorio.ufgd.edu.br/jspui/bitstream/prefix/4644/1/EricHenriqueHellerLopes.pdf).

**NF-e (chave de 44 dígitos)**
- O serviço NFeDistribuicaoDFe entrega, com certificado digital, as notas em que o CNPJ da FAPERON é o destinatário. O XML completo só vem depois da manifestação do destinatário; antes disso, só um resumo (https://portalspedbrasil.com.br/forum/nf-e-regra-de-distribuicao-via-download-do-xml-nt-2014-002-versao-1-02c-agosto-2020/).
- A versão 1.40 da norma técnica passou a aceitar CNPJ alfanumérico, com produção em 08/07/2026 (https://blog.tecnospeed.com.br/nota-tecnica-2014-002-versao-1-10-da-nf-e/).
- **Não confirmei** no manual oficial os detalhes do NFeConsultaProtocolo.
- A NFE.io consulta pela chave e devolve JSON, XML, DANFE e o status (autorizada ou cancelada). A página não fala em certificado nem em NFC-e (https://nfe.io/docs/documentacao/consultas/notas-fiscais/consulta-sefaz/).
- **Não confirmei** funcionalidades nem preços de Arquivei/Qive, Focus NFe e SIEG.

**Leitura de cupom ou recibo (OCR com IA)**
- A API do Claude aceita PDF de até 32 MB e 600 páginas (100 quando a janela de contexto é menor que 1M) (https://platform.claude.com/docs/en/docs/build-with-claude/pdf-support).
- O padrão recomendado é extrair para JSON com esquema e conferir as somas (https://invoicedataextraction.com/blog/vision-llm-invoice-extraction-python).
- O SmartScan do Expensify falha sem data e total legíveis e então pede preenchimento manual (https://help.expensify.com/articles/new-expensify/reports-and-expenses/Troubleshoot-SmartScan-Issues).
- A Flash extrai data, local, valor, CNPJ, itens e número da nota (https://flashapp.com.br/novidades-de-produto/leitura-automatica-ocr).
- O Espresso diz que 30% das despesas tiveram alerta de possível duplicidade e 15% tinham valor do cupom diferente do pedido de reembolso. É dado do próprio fornecedor (https://startups.com.br/fintech/espresso-recebe-aporte-da-saasholic-e-lanca-ia-para-otimizar-gestao-de-despesas/).

**Consulta de CNPJ do fornecedor**
- BrasilAPI: endpoint `/api/cnpj/v1`, sem chave. A descrição é de terceiros (https://apify.com/crawlerbros/brasil-api-cnpj-scraper).
- ReceitaWS gratuita: cerca de 3 consultas por minuto, segundo fontes secundárias (https://bubble.io/plugin/receitaws-free-plan-1579426636037x605773075952959500).
- CNPJá pública: 5 por minuto por IP (https://www.projetoacbr.com.br/forum/profile/103387-cnpj%C3%A1/content/).
- CNPJ.ws: 3 por minuto por IP, e quem passa do limite fica uma hora bloqueado (https://docs.cnpj.ws/referencia-de-api/api-publica/limitacoes).
- Por causa dos limites, convém guardar em cache o resultado de cada CNPJ.

**Comprovante duplicado**
- O Expensify marca como duplicadas despesas com mesma data, valor e moeda. O aviso aparece para quem lançou e para quem aprova (https://use.expensify.com/blog/duplicate-detection-will-make-your-expense-reports-even-better).
- Bloquear a mesma chave de acesso no banco e comparar o hash do arquivo é prática de engenharia; não há norma sobre isso.

**O que vale como comprovante idôneo no MROSC**
- A nota ou recibo precisa ter data, valor, nome e CNPJ da organização, além do CNPJ ou CPF do fornecedor (Decreto 8.726, art. 37): https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2016/decreto/d8726.htm
- Consequência: em despesa de convênio, a nota precisa sair no CNPJ da FAPERON, não no CPF do funcionário.
- O RPA (recibo de pagamento a autônomo) é o documento para prestador pessoa física sem CNPJ. Tem retenção de INSS e IRRF, e de ISS conforme o município, e o uso contínuo com a mesma pessoa traz risco de vínculo (https://www.contabilizei.com.br/contabilidade-online/rpa-recibo-de-pagamento-autonomo/).
- **Não confirmei** regra legal para "recibo simples" fora do MROSC.

**Por fase**
- **Essencial agora:** leitura do QR Code ou da chave com guarda da chave; leitura por IA com revisão humana; consulta de CNPJ com cache; bloqueio de duplicidade (chave, hash e data+valor+fornecedor); aviso quando faltar o CNPJ da FAPERON em despesa de convênio.
- **Segunda fase:** validar o status na SEFAZ por API paga; buscar no DistribuicaoDFe as NF-e emitidas contra o CNPJ.
- **Exagero para o porte:** certificado A1 e integração SOAP própria com cada SEFAZ.

---

## 3. Controle e auditoria para órgãos de controle

**O que é lei (vale para recurso de termo de fomento ou colaboração, pelo MROSC)**

Lei 13.019 (https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l13019.htm):
- Art. 53: toda movimentação por transferência eletrônica. Pagamento em espécie só se a transferência for fisicamente impossível.
- Art. 46, II: diárias permitidas quando a execução do objeto exigir.
- Art. 66: relatório de execução do objeto e relatório de execução financeira.
- Art. 68, parágrafo único: guardar os originais por **10 anos** a partir do dia útil seguinte à prestação de contas.

Decreto 8.726 (link acima):
- Art. 38: pagamento pelo Transferegov (Ordem de Pagamento de Parceria), com identificação do beneficiário final. Pagamento em espécie limitado a R$ 5.000 por beneficiário em toda a vigência (§5º).
- Art. 56, §1º: o relatório de execução financeira traz receitas e despesas, comprovante de devolução do saldo, extrato da conta específica, memória de cálculo de rateio e cópias das notas.
- Art. 57, II: relação de pagamentos e conciliação bancária.
- Art. 58: 10 anos de guarda.

Uma minuta do Ministério da Justiça dá 150 dias, prorrogáveis por mais 150, para a análise da prestação de contas final (https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/Edital_52.pdf). **Não encontrei** fonte detalhada sobre o cálculo de glosas.

**Prazo tributário.** A regra geral de guarda é de 5 anos, contados conforme os arts. 173 e 195 do CTN, não a partir da data do documento. As fontes são secundárias (https://blog.econeteditora.com.br/padronizado-prazo-de-guarda/).

**Boa prática, não lei para a FAPERON**
- Trilha de auditoria imutável, só de inclusão.
- Registro de ciência do aprovador.
- Vínculo de cada despesa a projeto, convênio e fonte.
- Conciliação com o extrato.

**Por fase**
- **Essencial agora:** campo de fonte de recurso e projeto/convênio; trilha imutável; guarda pela regra mais longa (10 anos quando houver MROSC); relatório de execução financeira exportável.
- **Segunda fase:** conciliação com extrato; registro de glosa e de devolução.
- **Exagero para o porte:** integração direta com o Transferegov.

---

## 4. Integrações

**Pix.** O E2E ID (identificador da transação) só existe depois da liquidação; o txid nasce antes, quando a cobrança é gerada. A fonte é secundária (https://transfeera.com/blog/comprovante-do-pix/). Guardar o E2E ID junto do reembolso. **Não pesquisei** as APIs Pix de cada banco.

**Extrato bancário**
- OFX é exportado à mão no internet banking. CNAB 240 é um arquivo de posição fixa gerado pelo banco, no padrão Febraban (https://agilize.com.br/artigos/conciliacao-bancaria-para-devs).
- O Domínio importa OFX, OFC e Febraban 240 (https://suporte.dominioatendimento.com/central/faces/solucao.html?codigo=238).
- Os layouts variam por banco (exemplo do Itaú): https://download.itau.com.br/bankline/conciliacao_bancaria_%20240.pdf

**Open Finance para empresa (PJ).** Depende do consentimento da conta PJ e hoje traz o extrato da conta corrente (https://ajuda.omie.com.br/pt-BR/articles/15459744-configurando-o-open-finance).

**Contabilidade**
- O Domínio tem layout de lançamentos com separador "|" e importação em lote. O plano de contas precisa ter os mesmos códigos, e há risco de duplicar lançamentos (https://suporte.dominioatendimento.com/central/faces/solucao.html?codigo=672).
- O Omie documenta exportação para Domínio, Contmatic, Prosoft e Questor (https://ajuda.omie.com.br/pt-BR/articles/9010782-importando-os-lancamentos-contabeis-no-sistema-contmatic).
- Alterdata: https://ajuda.alterdata.com.br/alterdatapackup/eescriture-242505414.html

**Assinatura eletrônica**
- A Lei 14.063 define os níveis simples, avançada e qualificada (ICP-Brasil) (https://www.ufrgs.br/propur/assinatura-digital-govbr/).
- O ITI oferece a API de assinatura gov.br "para aplicações públicas" (https://www.gov.br/iti/pt-br/assuntos/assinatura-eletronica-avancada). **Não confirmei** se uma entidade privada como a FAPERON pode aderir.

**WhatsApp.** Fora da janela de 24h só sai mensagem por template aprovado; o de categoria "utility" serve para aviso de pendência (https://www.twilio.com/docs/whatsapp/key-concepts). A FAPERON já tem o Twilio integrado.

**Por fase**
- **Essencial agora:** exportar para contabilidade em planilha ou TXT no layout do escritório contábil; avisos por e-mail.
- **Segunda fase:** importar OFX; avisos por WhatsApp via template; registrar o comprovante Pix com o E2E ID.
- **Exagero para o porte:** Open Finance; CNAB por banco; pagamento Pix pela API do banco; assinatura ICP em cada despesa.

---

## 5. LGPD aplicada a comprovantes

Artigos da LGPD (https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm):
- **Bases legais:** cumprimento de obrigação legal (art. 7º, II) e exercício regular de direitos em processo (art. 7º, VI).
- **Necessidade:** tratar o mínimo necessário (art. 6º, III).
- **Conservação:** os dados podem ser mantidos depois do fim do tratamento para cumprir obrigação legal (art. 16, I).
- **Registro e segurança:** registro das operações (art. 37), medidas de segurança (art. 46) e comunicação de incidente à ANPD e ao titular (art. 48).

Na prática:
- NFC-e com CPF do funcionário, chave Pix e dados bancários: acesso por papel (o funcionário vê os seus; gestor e financeiro veem o centro de custo).
- Mascarar número de cartão.
- Prazo de retenção por tipo de documento, com descarte registrado (tabela de exemplo: https://confidata.com.br/blog/prazo-guarda-documentos-empresa-tabela-lgpd).

**Por fase**
- **Essencial agora:** controle de acesso por papel; registro de quem viu ou baixou um comprovante; retenção configurável.
- **Segunda fase:** descarte automático ao fim do prazo, com relatório.
- **Exagero para o porte:** classificação automática de dados sensíveis.

---

## 6. UX do módulo

**O que fazem os melhores**
- O Ramp diz que a despesa é concluída em menos de 15 segundos, sem explicar a metodologia. Recibos chegam por e-mail, SMS ou Slack, e o app aprende com o histórico para pré-preencher a descrição (https://ramp.com/blog/how-ramp-users-finish-expenses-in-15-seconds).
- O Ramp aceita envio pelo WhatsApp em algumas regiões (https://ramp.com/en-gb/expense-management) e sugere "aprovar" ou "recusar" com base na política (https://ramp.com/en-ca/expense-management).
- **Aprovação em lote:** marcar várias despesas e confirmar, mas revisar uma a uma antes (https://www.fylehq.com/help/en/articles/1205141-approving-expense-reports).
- Lembrete antes do prazo do adiantamento (Flash, link do item 1).

**O que frustra os usuários.** No Concur: interface pouco intuitiva, passos demais, curva de aprendizado, configuração pesada para o administrador e custo alto para empresa pequena (https://www.g2.com/survey_responses/sap-concur-review-4115664 ; https://capterra.com/p/380/Concur-Expense/reviews/). No Paytrack, suporte fraco no módulo de viagens (https://www.capterra.com/p/215234/Paytrack/reviews/).

**Painel do gestor e prazos (SLA).** Orçamento versus realizado, despesas paradas e prazo visível em cada estado: não achei fonte específica, é boa prática.

**Por fase**
- **Essencial agora:** foto que preenche os campos, revisáveis; estados claros (rascunho → enviada → em análise → devolvida/aprovada → paga), com prazo; devolução com motivo obrigatório vinculado ao campo; aprovação em lote; caixa "parado há X dias".
- **Segunda fase:** lançamento pelo WhatsApp com o Zétele; orçamento versus realizado.
- **Exagero para o porte:** aprovação por Slack ou Teams.

---

## Funcionalidades recomendadas, em ordem de prioridade

1. **Campo de fonte de recurso, projeto ou convênio em cada despesa.** Define qual regra se aplica (MROSC ou recurso próprio). Fonte: Decreto 8.726, art. 37 e art. 56.
2. **Trilha de auditoria imutável e ciência do aprovador.** Sustenta 10 anos de guarda e a defesa em processo. Fonte: Lei 13.019, art. 68, e LGPD, art. 7º, VI.
3. **Relatório por viagem ou missão, com adiantamento, acerto e devolução de saldo.** É o centro do fluxo nos sistemas de referência. Fonte: Columbia/Concur e Flash.
4. **Leitura do QR Code da NFC-e e da chave da NF-e, com guarda da chave.** É o dado autenticado pelo fisco. Fonte: IN SEFIN/RO 14/003.
5. **Leitura do comprovante por IA (Claude), com revisão humana obrigatória.** Lançamento rápido pelo celular. Fonte: documentação de PDF do Claude e Expensify SmartScan.
6. **Bloqueio de duplicidade (chave, hash do arquivo, data+valor+fornecedor).** Duplicidade é frequente segundo os fornecedores. Fonte: Expensify e Espresso.
7. **Consulta e cache do CNPJ do fornecedor; aviso quando faltar o CNPJ da FAPERON em convênio.** Atende o requisito do comprovante. Fonte: Decreto 8.726, art. 37, e BrasilAPI.
8. **Alçadas por valor e centro de custo, com etapa extra para convênio, e "quem lança não aprova".** Controle mínimo sem virar ERP. Fonte: Expensify Advanced Approval e Washburn.
9. **Diária e km por tabela interna, com comprovação.** Mantém a natureza indenizatória. Fonte: CLT, art. 457, §2º, e TRF1/CJF.
10. **Prazos visíveis e lembretes por e-mail, depois WhatsApp por template.** Evita adiantamento em aberto. Fonte: Flash e Twilio.
11. **Devolução com motivo obrigatório e aprovação em lote.** Acelera o gestor. Fonte: Argo e Fyle.
12. **Exportação contábil (planilha ou TXT no layout do escritório contábil).** Evita digitar tudo de novo. Fonte: suporte Domínio e Omie.
13. **Relatório de execução financeira exportável por convênio.** Exigido no MROSC. Fonte: Decreto 8.726, art. 56.
14. **Segunda fase: importação de OFX e conciliação com o extrato.** Atende a conciliação exigida no art. 57 do Decreto 8.726. Fonte: Agilize e Domínio.
15. **Segunda fase: retenção configurável por tipo de documento e descarte registrado.** Fonte: LGPD, arts. 16 e 37.

**Pendências que não consegui confirmar:**
- Se o TCU tem jurisdição sobre o dinheiro próprio da FAPERON depois de 2017.
- A norma de diárias do SENAR.
- A URL atual da NFC-e de Rondônia (a lista é de 2019).
- Preços e funcionalidades de Arquivei/Qive, Focus NFe e SIEG.
- Se uma entidade privada pode usar a API de assinatura gov.br.
- O cálculo de glosas.
- Se o saldo de adiantamento de viagem pode ser descontado em folha.

Precisam de validação com o contador, o jurídico e o SENAR-RO.

# Épico 6: Viagem + Prestação de contas v2

Situação: a fazer, depois da etapa A do multitenant (épico 5), porque precisa do Postgres. Levantado no brainstorm de 27/10/2026.

## Escopo confirmado pelo usuário (27/10/2026)

Os quatro tipos de prestação de contas: reembolso de funcionário, adiantamento e diárias, sindicatos à FAPERON (conferência no épico 9) e convênios ou projetos (relatório de execução no épico 9).

## Ideia central: a Viagem

Uma viagem junta o pedido de adiantamento ou de diárias, a reserva do veículo (com km), as despesas e as atividades realizadas. No retorno, a prestação de contas da viagem sai praticamente montada (modelo do "relatório por viagem" do Concur e da Flash).

## Tickets (ainda sem ordem interna)

| Ticket | Descrição |
|---|---|
| 6.1 | Fonte do recurso em cada despesa (próprio, repasse, convênio, projeto), que define as regras aplicáveis |
| 6.2 | Viagem: adiantamento → gastos → acerto → devolução do saldo, com prazo visível; quem tem acerto pendente não recebe novo adiantamento |
| 6.3 | Diária e km por tabela interna, com comprovação |
| 6.4 | Comprovante pelo celular: QR Code da NFC-e ou chave de 44 dígitos (guardada), foto lida por IA com conferência obrigatória da pessoa, consulta de CNPJ com cache |
| 6.5 | Bloqueio de comprovante repetido: mesma chave, mesmo arquivo (hash), ou mesmo valor, data e fornecedor |
| 6.6 | Aprovação: alçadas por valor e centro de custo, etapa extra para convênio, quem lança não aprova, aprovação em lote, devolução com motivo ligado ao campo |
| 6.7 | Estados rascunho → enviada → em análise → devolvida/aprovada → paga, com histórico que não pode ser alterado |
| 6.8 | Aviso de nota fora do CNPJ da FAPERON em despesa de convênio |
| 6.9 | Exportação para a contabilidade no layout do escritório contábil |
| 6.10 | Acesso por papel aos comprovantes (LGPD), registro de quem viu ou baixou, retenção pela regra mais longa (10 anos quando houver MROSC) |

## A confirmar com contador, jurídico e SENAR-RO

- Se o TCU fiscaliza hoje o dinheiro próprio da FAPERON.
- A norma de diárias do SENAR.
- Se o saldo de adiantamento de viagem pode ser descontado em folha.
- A URL atual de consulta da NFC-e de Rondônia.
- O layout de importação do escritório contábil da FAPERON.

## Fonte

`docs/pesquisa/2026-10-27-prestacao-de-contas.md`.

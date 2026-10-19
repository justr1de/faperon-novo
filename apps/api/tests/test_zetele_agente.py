from collections.abc import Iterator

import pytest

from analise.regras import formatar_numero
from indicadores.models import Produto
from tests.zetele_falso import Bloco, ClienteLLMFalso, RespostaFalsa, ferramenta, final
from zetele.agente import TEXTO_DEMORA, TEXTO_RECUSA, TEXTO_SEM_CONFIRMACAO, responder
from zetele.canais import SISTEMA
from zetele.cliente import ProvedorIndisponivel, TempoEsgotado
from zetele.prompt import PERSONA_SISTEMA

SOJA = {"produto": "soja-em-grao", "indicador": "quantidade-produzida"}
URL_SOJA = (
    "/painel?segmento=agricultura&produto=soja-em-grao&indicador=quantidade-produzida&fim=2024"
)
pytestmark = pytest.mark.django_db


def test_resposta_institucional_direta(dados_soja: Produto) -> None:
    cli = ClienteLLMFalso(
        [
            final(
                "resposta",
                "O ranking fica no [Painel Agro Analítico](/painel).",
                ("Como gero o PDF?",),
            )
        ]
    )
    r = responder(cli, "onde vejo o ranking?", [], "/")
    assert r.status == "respondida"
    assert r.texto == "O ranking fica no [Painel Agro Analítico](/painel)."
    assert r.sugestoes == ["Como gero o PDF?"]
    assert r.fontes == []
    assert "O visitante está em /." in cli.pedidos[0]["messages"][-1]["content"]


def test_numero_vindo_da_ferramenta_passa_e_traz_fonte(dados_soja: Produto) -> None:
    texto = f"Em 2024, Ariquemes liderou com {formatar_numero(450)} toneladas. Veja [o ranking]({URL_SOJA})."
    cli = ClienteLLMFalso([ferramenta("ranking_municipios", SOJA), final("resposta", texto)])
    r = responder(cli, "qual município mais produz soja?", [], "/painel")
    assert r.status == "respondida"
    assert r.texto == texto
    assert r.fontes[0]["url_interna"] == URL_SOJA
    resultado = cli.pedidos[1]["messages"][-1]["content"][0]
    assert resultado["type"] == "tool_result" and "Ariquemes" in resultado["content"]


def test_numero_inventado_cai_na_reserva_deterministica(dados_soja: Produto) -> None:
    cli = ClienteLLMFalso(
        [
            ferramenta("ranking_municipios", SOJA),
            final("resposta", "Ariquemes produziu 999.999 toneladas."),
        ]
    )
    r = responder(cli, "qual município mais produz soja?", [], "/painel")
    assert r.status == "verificacao_falhou"
    assert "Ariquemes" in r.texto and formatar_numero(450) in r.texto
    assert "999.999" not in r.texto
    assert r.fontes[0]["url_interna"] == URL_SOJA


def test_numero_sem_ferramenta_cai_no_texto_padrao(dados_soja: Produto) -> None:
    cli = ClienteLLMFalso([final("resposta", "Rondônia produz 2.000.000 de toneladas de soja.")])
    r = responder(cli, "quanto de soja?", [], "/")
    assert (r.status, r.texto) == ("verificacao_falhou", TEXTO_SEM_CONFIRMACAO)


def test_recusa_do_modelo(dados_soja: Produto) -> None:
    cli = ClienteLLMFalso(
        [final("recusa", "Isso eu não sei responder. Posso ajudar com o Painel.")]
    )
    r = responder(cli, "qual a previsão do preço da soja?", [], "/")
    assert r.status == "recusada"
    assert r.texto.startswith("Isso eu não sei responder")


def test_stop_reason_refusal(dados_soja: Produto) -> None:
    r = responder(ClienteLLMFalso([RespostaFalsa("refusal", [])]), "x", [], "/")
    assert (r.status, r.texto) == ("recusada", TEXTO_RECUSA)


def test_corta_em_tres_rodadas_e_a_ultima_proibe_ferramentas(dados_soja: Produto) -> None:
    cli = ClienteLLMFalso([ferramenta("ranking_municipios", SOJA, id=f"t{i}") for i in range(3)])
    r = responder(cli, "soja?", [], "/painel")
    assert len(cli.pedidos) == 3
    assert [p["ultima_rodada"] for p in cli.pedidos] == [False, False, True]
    assert r.status == "verificacao_falhou"
    assert "Ariquemes" in r.texto


def test_timeout_do_provedor_vira_erro(dados_soja: Produto) -> None:
    r = responder(ClienteLLMFalso([TempoEsgotado()]), "x", [], "/")
    assert (r.status, r.texto) == ("erro", TEXTO_DEMORA)


def test_orcamento_de_tempo(dados_soja: Produto) -> None:
    tempos: Iterator[float] = iter([0.0, 0.0, 41.0])
    cli = ClienteLLMFalso([ferramenta("ranking_municipios", SOJA), final("resposta", "ok")])
    r = responder(cli, "soja?", [], "/painel", relogio=lambda: next(tempos))
    assert r.status == "erro"
    assert len(cli.pedidos) == 1
    assert "Ariquemes" in r.texto  # aproveita o que já foi consultado


def test_provedor_fora_propaga(dados_soja: Produto) -> None:
    with pytest.raises(ProvedorIndisponivel):
        responder(ClienteLLMFalso([ProvedorIndisponivel("HTTP 529")]), "x", [], "/")


def test_historico_comeca_sempre_pelo_visitante_e_alterna(dados_soja: Produto) -> None:
    cli = ClienteLLMFalso([final("resposta", "ok")])
    historico = [
        {"papel": "zetele", "texto": "Oi!"},
        {"papel": "visitante", "texto": "a"},
        {"papel": "visitante", "texto": "b"},
        {"papel": "zetele", "texto": "c"},
    ]
    responder(cli, "d", historico, "/")
    papeis = [m["role"] for m in cli.pedidos[0]["messages"]]
    assert papeis == ["user", "assistant", "user"]


def test_erro_de_dominio_volta_ao_modelo_como_is_error(dados_soja: Produto) -> None:
    cli = ClienteLLMFalso(
        [
            ferramenta(
                "ranking_municipios", {"produto": "nao-existe", "indicador": "quantidade-produzida"}
            ),
            final("sem_informacao", "Não achei esse produto. Veja o [Painel](/painel)."),
        ]
    )
    r = responder(cli, "x", [], "/")
    resultado = cli.pedidos[1]["messages"][-1]["content"][0]
    assert resultado["is_error"] is True
    assert r.status == "respondida"


def test_link_fora_da_lista_e_removido(dados_soja: Produto) -> None:
    cli = ClienteLLMFalso(
        [final("resposta", "Veja [aqui](https://exemplo.com) e [o Painel](/painel).")]
    )
    r = responder(cli, "x", [], "/")
    assert r.texto == "Veja aqui e [o Painel](/painel)."


def test_texto_sem_json_e_aceito_e_rotulo_de_recusa_reconhecido(dados_soja: Produto) -> None:
    cli = ClienteLLMFalso(
        [RespostaFalsa("end_turn", [Bloco("text", text="[RECUSA] Não posso ajudar com isso.")])]
    )
    assert responder(cli, "x", [], "/").status == "recusada"


def test_na_pagina_inicial_nao_ha_ferramentas_e_ele_so_orienta(dados_soja: Produto) -> None:
    cli = ClienteLLMFalso(
        [
            final(
                "resposta",
                "Os números ficam na [Central de Inteligência](/central-de-inteligencia).",
            )
        ]
    )
    r = responder(cli, "quanto Rondônia produz de soja?", [], "/")
    assert r.status == "respondida"
    assert cli.pedidos[0]["tools"] == []
    assert "só orienta" in cli.pedidos[0]["messages"][-1]["content"]


def test_na_central_as_ferramentas_estao_disponiveis(dados_soja: Produto) -> None:
    cli = ClienteLLMFalso([final("resposta", "ok")])
    responder(cli, "x", [], "/painel")
    assert len(cli.pedidos[0]["tools"]) == 4
    assert "só orienta" not in cli.pedidos[0]["messages"][-1]["content"]


def test_na_area_logada_explica_o_uso_com_as_ferramentas_disponiveis(dados_soja: Produto) -> None:
    cli = ClienteLLMFalso(
        [final("resposta", "Em [Frotas](/sistema/frotas), aba Reservas, clique em Nova reserva.")]
    )
    r = responder(cli, "como reservo um carro?", [], "/sistema/frotas", canal=SISTEMA)
    assert r.status == "respondida"
    assert r.texto == "Em [Frotas](/sistema/frotas), aba Reservas, clique em Nova reserva."
    pedido = cli.pedidos[0]
    assert len(pedido["tools"]) == 4
    assert pedido["system"][0]["text"] == PERSONA_SISTEMA
    # o RAG do sistema manda o trecho da página e não mistura a base do site público
    mensagem = pedido["messages"][-1]["content"]
    assert "<base_de_conhecimento>" in mensagem and "Gestão de frotas" in mensagem
    assert "Painel Agro Analítico" not in mensagem


def test_no_sistema_responde_numero_do_agro_pela_ferramenta(dados_soja: Produto) -> None:
    # pedido de 18/10/2026: o Zétele interno também responde números do agro, pelas ferramentas
    texto = f"Em 2024, Ariquemes liderou com {formatar_numero(450)} toneladas. Veja [o ranking]({URL_SOJA})."
    cli = ClienteLLMFalso([ferramenta("ranking_municipios", SOJA), final("resposta", texto)])
    r = responder(cli, "qual município mais produz soja?", [], "/sistema", canal=SISTEMA)
    assert r.status == "respondida"
    assert r.texto == texto and formatar_numero(450) in r.texto
    assert r.fontes[0]["url_interna"] == URL_SOJA
    resultado = cli.pedidos[1]["messages"][-1]["content"][0]
    assert resultado["type"] == "tool_result" and "Ariquemes" in resultado["content"]
    assert len(cli.pedidos[0]["tools"]) == 4
    assert "Catálogo de dados" in cli.pedidos[0]["system"][-1]["text"]


def test_no_site_publico_os_trechos_vem_da_base_publica(dados_soja: Produto) -> None:
    cli = ClienteLLMFalso([final("resposta", "Fica no [Painel Agro Analítico](/painel).")])
    responder(cli, "onde vejo o ranking de municípios?", [], "/painel")
    mensagem = cli.pedidos[0]["messages"][-1]["content"]
    assert "Painel Agro Analítico (/painel)" in mensagem
    assert "/sistema" not in mensagem

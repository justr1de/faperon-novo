"""Regras das contas, fora das views: usadas pela API, pelos comandos de gestão e pelos testes."""

import secrets
from datetime import timedelta
from typing import Any

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from usuarios.models import PAPEIS, Perfil, RegistroDeConta

# Bloqueio de entrada (ADR 0035): 5 falhas do mesmo e-mail em 15 min bloqueiam aquele e-mail por 15 min.
# O IP tem um teto maior, porque a equipe pode sair pela mesma rede: pega quem testa muitos e-mails.
JANELA_DE_FALHAS = timedelta(minutes=15)
DURACAO_DO_BLOQUEIO = timedelta(minutes=15)
FALHAS_POR_EMAIL = 5
FALHAS_POR_IP = 20

# sem letras e números que se confundem ao ditar ou copiar (0/O, 1/l/I)
_ALFABETO_DA_SENHA = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
# códigos que viram rota em /api/v1/usuarios/<codigo>
_CODIGOS_RESERVADOS = frozenset({"equipe"})


def normalizar_email(email: str) -> str:
    return email.strip().lower()


def gerar_senha_temporaria() -> str:
    """Quatro blocos de 4 caracteres (ex.: `k7Pm-x2Qa-9Ztd-RfW3`), ~93 bits de acaso do `secrets`."""
    blocos = ["".join(secrets.choice(_ALFABETO_DA_SENHA) for _ in range(4)) for _ in range(4)]
    return "-".join(blocos)


def gerar_codigo(nome: str) -> str:
    base = slugify(nome)[:36].strip("-") or "pessoa"
    codigo, n = base, 1
    while codigo in _CODIGOS_RESERVADOS or Perfil.objects.filter(codigo=codigo).exists():
        n += 1
        codigo = f"{base}-{n}"
    return codigo


def email_em_uso(email: str, exceto: User | None = None) -> bool:
    contas = User.objects.filter(email__iexact=normalizar_email(email))
    if exceto is not None:
        contas = contas.exclude(pk=exceto.pk)
    return contas.exists()


def registrar(
    acao: str,
    *,
    ator: User | None = None,
    alvo: User | None = None,
    email: str = "",
    ip: str | None = None,
    detalhe: str = "",
) -> RegistroDeConta:
    return RegistroDeConta.objects.create(
        acao=acao, ator=ator, alvo=alvo, email=email[:254], ip=ip, detalhe=detalhe[:200]
    )


@transaction.atomic
def criar_usuario(
    *,
    email: str,
    nome: str,
    area: str,
    codigo: str | None = None,
    telefone: str = "",
    senha: str | None = None,
    papeis: dict[str, bool] | None = None,
    demonstracao: bool = False,
    ator: User | None = None,
    detalhe: str = "",
) -> tuple[User, str | None]:
    """Cria o User (login = e-mail) e o Perfil. Sem `senha`, gera uma temporária e a devolve uma vez."""
    email = normalizar_email(email)
    temporaria = gerar_senha_temporaria() if senha is None else None
    usuario = User.objects.create_user(username=email, email=email)
    usuario.set_password(senha if senha is not None else temporaria)
    usuario.save(update_fields=["password"])
    Perfil.objects.create(
        usuario=usuario,
        codigo=codigo or gerar_codigo(nome),
        nome=nome.strip(),
        area=area,
        telefone=telefone,
        demonstracao=demonstracao,
        precisa_trocar_senha=temporaria is not None,
        **{p: bool((papeis or {}).get(p, False)) for p in PAPEIS},
    )
    registrar(RegistroDeConta.Acao.CRIOU, ator=ator, alvo=usuario, detalhe=detalhe)
    return usuario, temporaria


def definir_senha_temporaria(usuario: User, *, ator: User | None = None, detalhe: str = "") -> str:
    senha = gerar_senha_temporaria()
    usuario.set_password(senha)
    usuario.save(update_fields=["password"])
    Perfil.objects.filter(usuario=usuario).update(precisa_trocar_senha=True)
    registrar(RegistroDeConta.Acao.GEROU_SENHA, ator=ator, alvo=usuario, detalhe=detalhe)
    return senha


def administradores_ativos() -> int:
    return Perfil.objects.filter(administrador=True, usuario__is_active=True).count()


def atualizar_perfil(perfil: Perfil, dados: dict[str, Any], *, ator: User) -> list[str]:
    """Aplica a edição (e-mail muda também o login) e devolve os nomes dos campos alterados."""
    usuario = perfil.usuario
    mudou: list[str] = []
    if "email" in dados:
        email = normalizar_email(dados.pop("email"))
        if email != usuario.email:
            usuario.email = usuario.username = email
            usuario.save(update_fields=["email", "username"])
            mudou.append("email")
    for campo, valor in dados.items():
        if getattr(perfil, campo) != valor:
            setattr(perfil, campo, valor)
            mudou.append(campo)
    if mudou:
        perfil.save()
        # o registro guarda só os nomes dos campos, nunca os valores
        registrar(RegistroDeConta.Acao.EDITOU, ator=ator, alvo=usuario, detalhe=", ".join(mudou))
    return mudou


# ---------- bloqueio de entrada ----------


def bloqueado(email: str, ip: str | None) -> bool:
    """Há um bloqueio de menos de 15 min para este e-mail ou este IP?"""
    desde = timezone.now() - DURACAO_DO_BLOQUEIO
    bloqueios = RegistroDeConta.objects.filter(
        acao=RegistroDeConta.Acao.BLOQUEOU, quando__gte=desde
    )
    if bloqueios.filter(email=email).exclude(email="").exists():
        return True
    return ip is not None and bloqueios.filter(ip=ip, email="").exists()


def anotar_falha(email: str, ip: str | None, detalhe: str = "") -> None:
    """Grava a falha e, ao chegar no limite da janela, abre o bloqueio do e-mail ou do IP."""
    registrar(RegistroDeConta.Acao.FALHOU_ENTRAR, email=email, ip=ip, detalhe=detalhe)
    desde = timezone.now() - JANELA_DE_FALHAS
    falhas = RegistroDeConta.objects.filter(
        acao=RegistroDeConta.Acao.FALHOU_ENTRAR, quando__gte=desde
    )
    if email and falhas.filter(email=email).count() >= FALHAS_POR_EMAIL:
        registrar(RegistroDeConta.Acao.BLOQUEOU, email=email, ip=ip, detalhe="e-mail")
    elif ip and falhas.filter(ip=ip).count() >= FALHAS_POR_IP:
        # bloqueio do IP: sem e-mail, para não confundir com o bloqueio de uma conta
        registrar(RegistroDeConta.Acao.BLOQUEOU, ip=ip, detalhe="ip")

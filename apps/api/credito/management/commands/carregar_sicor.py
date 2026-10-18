from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from credito.agendador import ANO_INICIAL
from credito.carga import CargaCreditoFalhou, executar_carga_ano
from credito.sicor import SicorCliente


class Command(BaseCommand):
    help = "Carrega o crédito rural de RO (SICOR, Banco Central) desde 2018 ou só um ano."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--ano", type=int, help="carrega só este ano de emissão")
        parser.add_argument(
            "--desde", type=int, default=ANO_INICIAL, help=f"primeiro ano (padrão: {ANO_INICIAL})"
        )
        parser.add_argument("--ate", type=int, help="último ano (padrão: o ano atual)")

    def handle(self, *args: Any, **opts: Any) -> None:
        if opts["ano"]:
            anos = [opts["ano"]]
        else:
            ate = opts["ate"] or timezone.localtime().year
            if opts["desde"] > ate:
                raise CommandError("--desde maior que --ate")
            anos = list(range(opts["desde"], ate + 1))
        cliente = SicorCliente()
        falhas = 0
        for ano in anos:
            try:
                carga = executar_carga_ano(ano, cliente)
                self.stdout.write(
                    self.style.SUCCESS(
                        f"{ano}: {carga.linhas} linhas, {carga.linhas_produtos} de produtos"
                    )
                )
            except CargaCreditoFalhou as exc:
                falhas += 1
                self.stderr.write(self.style.ERROR(f"{ano}: falhou: {exc}"))
        if falhas:
            raise CommandError(f"{falhas} ano(s) falharam")

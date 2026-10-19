from django.db import migrations, models
from django.db.models import Count


def conferir_repetidos(apps, schema_editor):
    # falha com recado claro em vez de um IntegrityError genérico no meio do deploy
    Perfil = apps.get_model("usuarios", "Perfil")
    repetidos = (
        Perfil.objects.exclude(telefone="")
        .values("telefone")
        .annotate(n=Count("id"))
        .filter(n__gt=1)
        .count()
    )
    if repetidos:
        raise RuntimeError(
            f"{repetidos} telefone(s) aparecem em mais de um usuário; corrija na tela Usuários "
            "antes de migrar."
        )


class Migration(migrations.Migration):
    dependencies = [("usuarios", "0002_email_unico")]

    operations = [
        migrations.RunPython(conferir_repetidos, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="perfil",
            constraint=models.UniqueConstraint(
                condition=~models.Q(telefone=""),
                fields=("telefone",),
                name="perfil_telefone_unico",
            ),
        ),
    ]

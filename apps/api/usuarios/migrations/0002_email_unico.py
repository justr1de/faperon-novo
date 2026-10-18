from django.db import migrations

# O auth.User do Django não tem e-mail único. O login é pelo e-mail (ADR 0035): o banco garante
# um só por pessoa, sem diferenciar maiúsculas. Contas sem e-mail (createsuperuser antigo) ficam de fora.
CRIAR = (
    "CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_unico "
    "ON auth_user (lower(email)) WHERE email <> ''"
)
DESFAZER = "DROP INDEX IF EXISTS usuarios_email_unico"


class Migration(migrations.Migration):
    dependencies = [
        ("usuarios", "0001_initial"),
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [migrations.RunSQL(CRIAR, DESFAZER)]

from django.urls import path

from usuarios import views

urlpatterns = [
    # login de verdade (ADR 0035)
    path("auth/csrf", views.CsrfView.as_view()),
    path("auth/entrar", views.EntrarView.as_view()),
    path("auth/google", views.GoogleView.as_view()),
    path("auth/sair", views.SairView.as_view()),
    path("auth/eu", views.EuView.as_view()),
    path("auth/trocar-senha", views.TrocarSenhaView.as_view()),
    # equipe (qualquer pessoa logada) e tela Usuários (só administrador)
    path("usuarios/equipe", views.EquipeView.as_view()),
    path("usuarios", views.UsuariosView.as_view()),
    path("usuarios/<slug:codigo>", views.UsuarioView.as_view()),
    path("usuarios/<slug:codigo>/desativar", views.DesativarView.as_view()),
    path("usuarios/<slug:codigo>/reativar", views.ReativarView.as_view()),
    path("usuarios/<slug:codigo>/senha-temporaria", views.SenhaTemporariaView.as_view()),
]

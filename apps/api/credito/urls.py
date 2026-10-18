from django.urls import path

from credito.api import views

urlpatterns = [
    path("credito/resumo", views.ResumoView.as_view()),
    path("credito/serie", views.SerieView.as_view()),
    path("credito/ranking", views.RankingView.as_view()),
    path("credito/por-produto", views.PorProdutoView.as_view()),
]

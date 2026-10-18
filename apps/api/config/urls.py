from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    path("api/v1/", include("indicadores.api.urls")),
    path("api/v1/", include("analise.urls")),
    path("api/v1/", include("observatorio.urls")),
    path("api/v1/", include("credito.urls")),
    path("api/v1/", include("zetele.urls")),
    path("api/v1/", include("usuarios.urls")),
]

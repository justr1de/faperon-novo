from typing import Any

from rest_framework.throttling import ScopedRateThrottle


class ScopedPorIPThrottle(ScopedRateThrottle):
    """Limite do escopo da view sempre por IP, mesmo com login.

    O `ScopedRateThrottle` do DRF passa a contar por usuário quando há sessão; os limites do Zétele
    (ADR 0023 e 0032) e do login são por IP e continuam assim.
    """

    def get_cache_key(self, request: Any, view: Any) -> str:
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}

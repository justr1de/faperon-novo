# ADR 0035: Usuários reais no banco e login de verdade na área do sistema

Status: Aceita (18/10/2026)

## Contexto

A área logada nasceu como protótipo só no front (ADR 0031). O `/login` conferia no navegador o acesso de demonstração (`user@faperon.br`), e depois a pessoa escolhia um entre 5 funcionários fictícios. Isso trava a demonstração, mas não é segurança: o código do front é público. Também não permite saber quem é quem, nem dar papéis de verdade.

O usuário aprovou a etapa A em 18/10/2026: contas no banco, login de verdade e uma tela para o administrador gerir a equipe. A etapa B, de perguntas frequentes no RAG com curadoria, usa o papel de administrador criado aqui e fica para depois.

## Opções

- **Escolhida:** sessão do Django (cookie `sessionid` HttpOnly) com CSRF, contas no Postgres e "Entrar com Google" só para quem já tem conta.
- **Descartadas:**
  - **JWT no navegador.** Exigiria guardar o token onde o JavaScript alcança, ou montar o refresh à mão. A sessão do Django já resolve isso, e o Next é o mesmo domínio.
  - **Login só pelo Google.** Nem toda a equipe usa Gmail, e a demonstração precisa funcionar sem o Google configurado.
  - **Google criando conta sozinho.** Qualquer Gmail entraria. Aqui, só o administrador cria contas.
  - **Levar já agora os dados dos módulos para o banco.** Fica para depois, para a etapa caber num ciclo de revisão.

## Decisão

- **App `usuarios`** (Django):
  - `Perfil` em OneToOne com o `User`. Guarda `codigo` (é o `Funcionario.id` do front; a demonstração usa `carla`, `marcos`, `ana`, `joao` e `luiza`), `nome`, `area`, `telefone` (opcional, E.164, para o WhatsApp da ADR 0033), os papéis (`administrador`, `coordenador`, `gestor_frota`, `gestor_espacos`, `gestor_contas`), `demonstracao` e `precisa_trocar_senha`.
  - O login é o e-mail. O `username` é o próprio e-mail em minúsculas, e um índice único em `lower(email)` (migração `0002`) impede o mesmo e-mail em duas contas. O `BackendPorEmail` ignora maiúsculas e não deixa conta desativada entrar.
  - **Desativar, não apagar.** A conta fica com `is_active=False`, para manter a autoria do que a pessoa fez. A sessão aberta deixa de valer na hora, e a API não tem rota de exclusão.
  - `RegistroDeConta` audita criar, editar (só os nomes dos campos), desativar, reativar, gerar senha temporária, trocar a senha, entrar, sair, falhar ao entrar e bloquear. Cada registro guarda quem fez, a ação, quando, o alvo, o e-mail digitado e o IP. Senha e token nunca são gravados.
- **Sessão e CSRF:**
  - O cookie `sessionid` é HttpOnly e `SameSite=Lax`, com `Secure` quando `DEBUG=0`. A sessão dura 12 horas (`SESSAO_HORAS`).
  - O CSRF usa o cookie `csrftoken` (legível pelo front) e o cabeçalho `X-CSRFToken`. O login também confere o CSRF, para evitar que outro site logue a pessoa numa conta dele.
  - O DRF continua sem autenticação por padrão. As rotas novas e as do Zétele do sistema declaram na view a `SessaoAutenticacao` e a permissão (`TemPerfil`, `EstaLogado`, `EhAdministrador`). Sem login, a resposta é 401. Painel, Observatório e Zétele público continuam abertos.
- **Proxy do Next** (`src/lib/proxy.ts`): repassa à API só os cookies `sessionid` e `csrftoken`, mais o `X-CSRFToken`. Devolve cada `Set-Cookie` inteiro e aceita `PATCH`. O `Origin` não é repassado (o Django veria outro host); a proteção é o token mais o `SameSite`. Limites de corpo e regra do áudio sem mudança.
- **Bloqueio:** 5 falhas do mesmo e-mail em 15 minutos bloqueiam aquele e-mail por 15 minutos, de qualquer IP; nem a senha certa entra. O IP tem um teto de 20 falhas, porque a equipe pode sair pela mesma rede. Além disso, entrar, entrar com Google e trocar a senha têm limite de 10 por minuto por IP (`AUTH_RATE_LIMIT`). O erro é sempre "E-mail ou senha incorretos.", exista ou não a conta. A contagem fica no Postgres (`RegistroDeConta`), não no cache em arquivo.
- **Google:** o `/auth/google` recebe o ID token do Google Identity Services e o confere com `google-auth` (`verify_oauth2_token`, `aud = GOOGLE_CLIENT_ID`), exigindo `email_verified`. Só entra quem já tem conta ativa, e o Google nunca cria conta. Sem `GOOGLE_CLIENT_ID`, a rota responde 503, e sem `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (lido no build do web) o botão não aparece.
- **Senha temporária no lugar do e-mail.** Ainda não há servidor de e-mail (SMTP). O administrador gera uma senha temporária, com `secrets` no servidor, que aparece uma única vez. No primeiro acesso, o sistema exige a troca: até lá, as demais rotas respondem 403. "Esqueci a senha" diz isso com honestidade. Quando houver SMTP, entra o link de redefinição.
- **Tela Usuários** (`/sistema/usuarios`): só para administradores, com o acesso na barra do sistema (o cabeçalho está sem espaço). O administrador não desativa a própria conta nem tira o último administrador.
- **Front:**
  - Quem está logado vem do `/auth/eu`, e a equipe do `/usuarios/equipe`. A lista fixa `FUNCIONARIOS` só serve aos testes e à demonstração.
  - "Trocar de funcionário" saiu: agora é "Sair".
  - Logo depois do login, a página guarda a conta só em memória, para abrir o sistema sem outro `/auth/eu`. Ao recarregar, a conta volta a vir do servidor.
- **Comandos:**
  - `criar_admin --email --nome [--area]` cria ou promove um administrador e imprime uma senha temporária uma vez.
  - `carregar_usuarios_demo` cria os 5 usuários de demonstração (`@exemplo.faperon.br`, domínio que não recebe e-mail). A senha vem de `DEMO_SENHA`; sem ela, ou com senha fraca, o comando recusa. Marcos é administrador, coordenador e gestor de tudo.

### O que sai da ADR 0031

O acesso `user@faperon.br` conferido no navegador, a escolha entre 5 perfis e a sessão no `sessionStorage` saem. Continuam como na ADR 0031 os dados dos módulos (agenda, frota, espaços, contas, atividades, tags e histórico), que ficam no navegador, com a faixa de protótipo e o tour.

## LGPD

Nome, e-mail e telefone reais são dados pessoais, e o registro de acessos guarda e-mail e IP. Contas de pessoas reais só entram com o aval do encarregado de dados da DATA-RO, Weslley Hariel Lima e Silva Palomeque Gonçalves (`weslley.palomeque@dataro-it.com.br`). Até lá, só usuários de demonstração. A retenção do registro de acessos precisa ser definida com ele; hoje nada é apagado. A política de privacidade foi atualizada. Os registros do Zétele continuam anônimos, sem ligação com a conta de quem perguntou.

## Consequências

- O Zétele do sistema e o `/sistema/interpretar` passam a exigir login, e os limites deles continuam por IP (`ScopedPorIPThrottle`). Os testes do Zétele do sistema autenticam.
- O e2e entra com os usuários de demonstração (`e2e/entrar.ts`). O mock da API (`scripts/mock-contas.mjs`) imita o login com a senha `demonstracao-local`. Para rodar contra o compose:

  ```bash
  docker compose exec -e DEMO_SENHA=<senha> api python manage.py carregar_usuarios_demo
  cd apps/web && E2E_BASE_URL=http://localhost:3000 E2E_DEMO_SENHA=<senha> npx playwright test
  ```

- **Próximo passo:** a etapa B, de perguntas frequentes no RAG com curadoria do administrador. Depois dela, os dados dos módulos no Postgres e o envio de e-mail.

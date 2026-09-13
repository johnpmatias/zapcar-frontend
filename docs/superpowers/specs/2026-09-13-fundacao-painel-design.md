# Fundação do Painel ZapCar — Spec de Design

**Data:** 2026-09-13
**Status:** Aprovado, aguardando plano de implementação

## Contexto

O painel do lojista (front-end) do ZapCar foi originalmente construído no Lovable e foi perdido por completo (perda de acesso à plataforma, sem cópia em nenhum repositório). Este documento especifica a primeira reconstrução: a "Fundação" — o esqueleto mínimo de autenticação, roteamento protegido e deploy, sobre o qual as próximas funcionalidades (CRUD de veículos, vitrine pública, CRM, billing) serão construídas em sub-projetos separados e sequenciais.

O back-end (Supabase: schema, RLS, triggers; n8n: agente de atendimento) já existe, está homologado, e passou por uma correção de segurança de isolamento multi-tenant. Este sub-projeto não altera nada no back-end.

## Objetivo desta entrega

Ter, ao final: um usuário consegue se cadastrar, fazer login, ver uma rota protegida (painel vazio), e tudo isso já publicado numa URL real via deploy automático — sem nenhuma funcionalidade de negócio ainda. O critério de sucesso é estritamente esse: prova de que a espinha dorsal (auth + deploy) funciona ponta a ponta.

## Fora de escopo (fica pros próximos sub-projetos)

- Formulário de cadastro/edição da loja.
- CRUD de veículos.
- Vitrine pública.
- Qualquer integração com o agente de IA/n8n a partir do front-end.
- Onboarding wizard de 4 etapas (Loja, WA, IA, Vitrine) — só faz sentido reconstruir depois que as etapas que ele rastreia existirem.

## Arquitetura

- **Stack:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + React Router + `@supabase/supabase-js`.
- **Repositório:** repo Git em `zapcar-frontend/`, publicado no GitHub na conta do usuário.
- **Deploy:** Vercel, conectado ao repositório GitHub, deploy automático a cada push na branch principal.
- **Back-end:** o mesmo projeto Supabase já existente (schema, RLS e trigger `handle_new_user` inalterados). O front-end usa a `publishable key` (par moderno da antiga `anon key`) do Supabase, nunca a `secret key`.

## Componentes

- `src/lib/supabase.ts` — inicializa o cliente Supabase a partir de variáveis de ambiente (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).
- `src/contexts/AuthContext.tsx` — mantém o estado de sessão do Supabase Auth (usuário logado, loading) e expõe um hook `useAuth()`.
- `src/components/ProtectedRoute.tsx` — componente de rota que redireciona para `/login` quando não há sessão ativa.
- `src/pages/Login.tsx` — formulário de login (email/senha).
- `src/pages/Signup.tsx` — formulário de cadastro (email/senha); ao completar, o trigger `handle_new_user` do Supabase já cria a linha correspondente em `lojas` e `lojas_config_ia` automaticamente — o front-end não precisa fazer nada além do `supabase.auth.signUp()`.
- `src/pages/Dashboard.tsx` — página protegida placeholder, com uma mensagem "Painel em construção" e um botão de logout.
- `src/App.tsx` — define as rotas (`/login`, `/signup`, `/` protegida).

## Fluxo de dados

1. Usuário acessa `/signup`, preenche email/senha → `supabase.auth.signUp()`.
2. Trigger no banco cria automaticamente `lojas` + `lojas_config_ia` vinculadas ao novo `user_id`.
3. Usuário é redirecionado para `/` (painel), já autenticado.
4. Em qualquer acesso a `/`, `ProtectedRoute` verifica a sessão via `AuthContext`; sem sessão, redireciona para `/login`.
5. Logout limpa a sessão e redireciona para `/login`.

## Tratamento de erros

- Falha de login/cadastro (credenciais inválidas, email já cadastrado): mensagem inline no formulário, usando a mensagem de erro que o Supabase Auth já retorna.
- Erros inesperados de renderização: um Error Boundary genérico no topo da árvore de componentes, mostrando uma mensagem de fallback simples — sem stack trace exposto ao usuário.

## Testes

Esta entrega é majoritariamente configuração e fluxo padrão de autenticação do Supabase, sem lógica de negócio própria — por isso, verificação manual em vez de testes automatizados:

- [ ] Cadastro com email/senha novo cria sessão E cria as linhas em `lojas`/`lojas_config_ia` no Supabase.
- [ ] Login com credenciais corretas funciona; com credenciais erradas, mostra mensagem de erro.
- [ ] Acessar `/` sem sessão redireciona para `/login`.
- [ ] Logout limpa a sessão e redireciona.
- [ ] Deploy no Vercel reflete automaticamente um push na branch principal.

A partir do próximo sub-projeto (CRUD de veículos), que já tem lógica de negócio real (validação, regras de estoque), passamos a usar TDD.

## Próximos sub-projetos (fora de escopo aqui, só pra contexto)

1. Fundação (este documento).
2. CRUD de veículos.
3. Vitrine pública com CTA de WhatsApp.
4. Dashboard CRM (histórico de conversa, temperatura do lead, assumir conversa).
5. Billing (Stripe) + landing page.

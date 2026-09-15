# Landing Page — Spec de Design

**Data:** 2026-09-15
**Status:** Aprovado, aguardando plano de implementação

## Contexto

Item 5 do roteiro era "Billing (Stripe) + landing page". Dividido em dois sub-projetos independentes, seguindo o mesmo padrão já usado no item 3 (vitrine pública):

- **5a. Landing page** (este documento).
- **5b. Billing (Stripe)** — fica pra depois, sem dependência da landing page.

Hoje o domínio de produção (`https://zapcar-frontend.vercel.app`) não tem nenhuma página pública de apresentação — quem chega em `/` sem estar logado cai direto no Dashboard, que redireciona pro login. Não existe nenhum material de marketing.

## Objetivo desta entrega

Visitante não autenticado que acessa `/` vê uma landing page de apresentação do produto, com CTA principal "Criar conta grátis" levando pra `/signup` (fluxo de cadastro self-service que já existe desde a Fundação). Usuário autenticado que acessa `/` é redirecionado direto pro painel.

## Fora de escopo (fica pra sub-projetos futuros)

- **Seção de preços/planos.** Sem billing (5b) ainda não há planos reais no sistema — mostrar preço agora seria inventar informação. Entra junto com o 5b.
- **Depoimentos, logos de clientes, FAQ.** Não há clientes/depoimentos reais disponíveis ainda pra usar como conteúdo; forçar isso agora seria conteúdo fictício.
- **CMS ou conteúdo editável.** A página é código estático (JSX), como o resto do painel — sem editor de conteúdo.
- **SEO avançado** (sitemap, schema.org, blog). Só o básico de meta tags (title, description) já praticado no projeto (ver `Vitrine.tsx` pra Open Graph, se servir de referência).

## Arquitetura

- **Rota `/` muda de dono.** Hoje `/` é o `DashboardPage` protegido. Passa a ser a `LandingPage`, pública. O Dashboard muda para `/painel`.
- **`PublicHomeRoute` (novo componente)** — espelha o `ProtectedRoute` (`src/components/ProtectedRoute.tsx`) só que invertido:
  - `loading` → mesmo estado de carregamento usado pelo `ProtectedRoute` ("Carregando...").
  - `session` presente → `<Navigate to="/painel" replace />`.
  - sem sessão → renderiza `children` (a `LandingPage`).
- **`src/App.tsx`:**
  - `/` → `PublicHomeRoute` envolvendo `LandingPage`.
  - `/painel` → `ProtectedRoute` envolvendo `DashboardPage` (rota que antes era `/`).
  - Catch-all (`*` → `/`) não muda — quem cai numa URL inválida vai pra `/`, e o `PublicHomeRoute` decide landing vs. redirect pro painel.
- **`src/pages/Login.tsx` e `src/pages/Signup.tsx`:** os `navigate('/')` existentes após sucesso passam a ser `navigate('/painel')`.
- Nenhuma mudança no back-end (Supabase/n8n) — esta entrega é só front-end estático + roteamento.

## Conteúdo da página

`src/pages/Landing.tsx`, composta pelas seções abaixo (componentes em `src/components/landing/`), reaproveitando shadcn/ui (`Button`, `Card`) já usados no projeto. Tom de copy: 65% profissional/corporativo, 35% moderno/tech — confiável pra dono de revenda de veículos, mas comunicando a parte de automação/IA sem soar burocrático.

### 1. Hero (`LandingHero.tsx`)

- Headline: **"Atendimento automático no WhatsApp pra sua revenda, sem perder nenhum lead"**
- Subheadline: "O ZapCar responde seus clientes pelo WhatsApp com IA, organiza cada conversa num CRM visual e ainda gera uma vitrine pública dos seus veículos — tudo em um só lugar."
- CTA primário: **"Criar conta grátis"** → `/signup`
- Link secundário, discreto: "Já tem conta? Entrar" → `/login`

### 2. Features (`LandingFeatures.tsx`)

Três cards, refletindo o que o produto já faz hoje:

1. **Atendimento com IA no WhatsApp** — "Um agente de IA conversa com seus clientes 24 horas por dia, tira dúvidas sobre os veículos e sabe a hora certa de te chamar pra fechar a venda."
2. **CRM visual de leads** — "Todos os contatos organizados num quadro Kanban por temperatura — frio, morno, quente — com o histórico completo de cada conversa."
3. **Vitrine pública dos veículos** — "Uma página com seu estoque disponível, pronta pra compartilhar, com botão direto de WhatsApp pra cada carro."

### 3. Como funciona (`LandingComoFunciona.tsx`)

Quatro passos numerados:

1. "Cadastre sua loja e seus veículos."
2. "Ative sua vitrine pública e compartilhe o link."
3. "O agente de IA atende quem chegar pelo WhatsApp."
4. "Acompanhe e feche os leads pelo painel."

### 4. CTA final (`LandingCtaFinal.tsx`)

Faixa de destaque repetindo o convite: "Pronto pra automatizar o atendimento da sua revenda?" + botão "Criar conta grátis" → `/signup`.

### 5. Rodapé (`LandingFooter.tsx`)

Minimalista: "© 2026 ZapCar" + link "Entrar" → `/login`.

## Componentes

- `src/components/PublicHomeRoute.tsx` (novo).
- `src/pages/Landing.tsx` (novo) — orquestra as seções abaixo, em ordem.
- `src/components/landing/LandingHero.tsx` (novo).
- `src/components/landing/LandingFeatures.tsx` (novo).
- `src/components/landing/LandingComoFunciona.tsx` (novo).
- `src/components/landing/LandingCtaFinal.tsx` (novo).
- `src/components/landing/LandingFooter.tsx` (novo).
- `src/App.tsx` — rota `/` passa a ser a landing (via `PublicHomeRoute`); Dashboard muda pra `/painel`.
- `src/pages/Login.tsx`, `src/pages/Signup.tsx` — `navigate('/')` → `navigate('/painel')`.

## Testes

Seguindo a convenção do projeto (TDD onde há lógica real; verificação manual onde não há):

- **`PublicHomeRoute.test.tsx`** (TDD) — três casos: `loading` mostra o estado de carregamento; sem sessão renderiza os `children` (a landing); com sessão redireciona pra `/painel`. `ProtectedRoute` hoje não tem teste próprio — usar o mesmo padrão de mock do `useAuth` já aplicado nos testes existentes do projeto (ex.: `Leads.test.tsx`, `Dashboard.test.tsx`, o que existir).
- **Seções da `LandingPage`** (Hero, Features, Como funciona, CTA final, Rodapé) — conteúdo estático sem lógica própria, sem teste automatizado. Verificação manual (checklist visual), mesmo tratamento dado à Fundação.
- **`Login.test.tsx` / `Signup.test.tsx` existentes** — ajustar as asserções que hoje esperam `navigate('/')` após sucesso, pra esperar `navigate('/painel')`.

## Decisões e pendências

- **Sem seção de preço:** decisão explícita — entra junto com o billing (5b), quando planos reais existirem.
- **CTA único (self-service), sem CTA de "falar com vendas":** decisão explícita do usuário — o produto já tem cadastro self-service funcionando desde a Fundação, então a landing usa esse caminho em vez de gerar lead comercial manual.
- **Conteúdo é rascunho:** o copy acima foi redigido nesta sessão como ponto de partida; pode (e provavelmente vai) ser ajustado depois de ver no ar.

## Próximos sub-projetos (fora de escopo aqui, só pra contexto)

1. Fundação ✅
2. CRUD de veículos ✅
3. Vitrine pública com CTA de WhatsApp, dividido em:
   - 3a. Configurações da loja ✅
   - 3b. Reordenação manual dos veículos ✅
   - 3c. Vitrine pública (`/v/:slug`) ✅
4. Dashboard CRM ✅
5. Billing (Stripe) + landing page, dividido em:
   - 5a. Landing page (este documento).
   - 5b. Billing (Stripe).

# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the ZapCar frontend a public landing page at `/`, moving the existing Dashboard to `/painel` so authenticated and unauthenticated visitors each land on the right page.

**Architecture:** A new `PublicHomeRoute` guard component (the inverse of the existing `ProtectedRoute`) wraps a new static `LandingPage`, composed of five presentational section components. `App.tsx` is rewired so `/` serves the guard+landing, `/painel` serves the guard+dashboard (previously at `/`), and `Login`/`Signup` redirect to `/painel` on success instead of `/`.

**Tech Stack:** React 19 + TypeScript + Vite, Tailwind CSS v4, shadcn/ui (`base-nova` style over `@base-ui/react` primitives — NOT Radix), React Router v7, Supabase Auth, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-15-landing-page-design.md`

## Global Constraints

- Every commit message ends with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- A `Button` (or `DialogTrigger`) that should behave as a link or wrap another trigger MUST use the `render` prop (e.g. `<Button render={<Link to="/signup" />}>Texto</Button>`) — never `asChild`, never `onClick` + `window.open`. The `@base-ui/react` primitives this project uses don't support `asChild`, and `onClick`/`window.open` strips link semantics. See `CLAUDE.md` and commit `914bdd0` for the prior incident this caused.
- No pricing/plans section on the landing page (billing doesn't exist yet — sub-project 5b).
- Single CTA everywhere: "Criar conta grátis" → `/signup`. No "talk to sales" CTA.
- Static content sections (Hero, Features, Como funciona, CTA final, Rodapé) get manual/visual verification, not automated tests — no business logic lives in them. `PublicHomeRoute` has real branching logic (session-based redirect) and gets TDD, following the project's existing convention (see `CLAUDE.md`).
- No back-end changes. This is front-end only.

---

## Task 1: `PublicHomeRoute` guard component (TDD)

**Files:**
- Create: `src/components/PublicHomeRoute.tsx`
- Test: `src/components/PublicHomeRoute.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` from `@/hooks/useAuth`, returning `{ session: Session | null; user: User | null; loading: boolean; signOut: () => Promise<void> }` (see `src/contexts/auth-context.ts`).
- Produces: `export function PublicHomeRoute({ children }: { children: ReactNode })` — used by `App.tsx` in Task 3, wrapping `LandingPage` (from Task 2) at route `/`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/PublicHomeRoute.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { PublicHomeRoute } from '@/components/PublicHomeRoute'
import { useAuth } from '@/hooks/useAuth'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

function renderComPublicHomeRoute() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={
            <PublicHomeRoute>
              <div>Landing conteúdo</div>
            </PublicHomeRoute>
          }
        />
        <Route path="/painel" element={<div>Painel conteúdo</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.mocked(useAuth).mockReset()
})

describe('PublicHomeRoute', () => {
  it('mostra o estado de carregamento enquanto a sessão ainda não foi resolvida', () => {
    vi.mocked(useAuth).mockReturnValue({
      session: null,
      user: null,
      loading: true,
      signOut: vi.fn(),
    })

    renderComPublicHomeRoute()

    expect(screen.getByText('Carregando...')).toBeInTheDocument()
  })

  it('renderiza os children (landing) quando não há sessão', () => {
    vi.mocked(useAuth).mockReturnValue({
      session: null,
      user: null,
      loading: false,
      signOut: vi.fn(),
    })

    renderComPublicHomeRoute()

    expect(screen.getByText('Landing conteúdo')).toBeInTheDocument()
  })

  it('redireciona para /painel quando há sessão', () => {
    vi.mocked(useAuth).mockReturnValue({
      session: {} as never,
      user: { id: 'user-1' } as never,
      loading: false,
      signOut: vi.fn(),
    })

    renderComPublicHomeRoute()

    expect(screen.getByText('Painel conteúdo')).toBeInTheDocument()
    expect(screen.queryByText('Landing conteúdo')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- PublicHomeRoute.test`
Expected: FAIL — `Cannot find module '@/components/PublicHomeRoute'` (the component doesn't exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `src/components/PublicHomeRoute.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export function PublicHomeRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  if (session) {
    return <Navigate to="/painel" replace />
  }

  return <>{children}</>
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- PublicHomeRoute.test`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/PublicHomeRoute.tsx src/components/PublicHomeRoute.test.tsx
git commit -m "feat: adiciona PublicHomeRoute para landing page pública"
```

---

## Task 2: Seções de conteúdo da Landing Page

Conteúdo estático (copy rascunhada na spec), sem lógica própria — verificação manual, não TDD (ver Global Constraints). Cada seção é um componente de apresentação sem props.

**Files:**
- Create: `src/components/landing/LandingHero.tsx`
- Create: `src/components/landing/LandingFeatures.tsx`
- Create: `src/components/landing/LandingComoFunciona.tsx`
- Create: `src/components/landing/LandingCtaFinal.tsx`
- Create: `src/components/landing/LandingFooter.tsx`
- Create: `src/pages/Landing.tsx`

**Interfaces:**
- Consumes: `Button` from `@/components/ui/button`, `Card`/`CardContent`/`CardHeader`/`CardTitle` from `@/components/ui/card`, `Link` from `react-router-dom`.
- Produces: `export default function LandingPage()` from `src/pages/Landing.tsx` — used by `App.tsx` in Task 3, wrapped by `PublicHomeRoute` (Task 1) at route `/`.

- [ ] **Step 1: Create `LandingHero.tsx`**

```tsx
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function LandingHero() {
  return (
    <section className="flex flex-col items-center gap-6 px-4 py-20 text-center">
      <h1 className="max-w-2xl text-4xl font-semibold sm:text-5xl">
        Atendimento automático no WhatsApp pra sua revenda, sem perder nenhum
        lead
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        O ZapCar responde seus clientes pelo WhatsApp com IA, organiza cada
        conversa num CRM visual e ainda gera uma vitrine pública dos seus
        veículos — tudo em um só lugar.
      </p>
      <div className="flex flex-col items-center gap-2">
        <Button size="lg" render={<Link to="/signup" />}>
          Criar conta grátis
        </Button>
        <Link to="/login" className="text-sm text-muted-foreground underline">
          Já tem conta? Entrar
        </Link>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create `LandingFeatures.tsx`**

```tsx
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const features = [
  {
    titulo: 'Atendimento com IA no WhatsApp',
    descricao:
      'Um agente de IA conversa com seus clientes 24 horas por dia, tira dúvidas sobre os veículos e sabe a hora certa de te chamar pra fechar a venda.',
  },
  {
    titulo: 'CRM visual de leads',
    descricao:
      'Todos os contatos organizados num quadro Kanban por temperatura — frio, morno, quente — com o histórico completo de cada conversa.',
  },
  {
    titulo: 'Vitrine pública dos veículos',
    descricao:
      'Uma página com seu estoque disponível, pronta pra compartilhar, com botão direto de WhatsApp pra cada carro.',
  },
]

export function LandingFeatures() {
  return (
    <section className="grid gap-4 px-4 py-12 sm:grid-cols-3">
      {features.map((feature) => (
        <Card key={feature.titulo}>
          <CardHeader>
            <CardTitle>{feature.titulo}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {feature.descricao}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
```

- [ ] **Step 3: Create `LandingComoFunciona.tsx`**

```tsx
const passos = [
  'Cadastre sua loja e seus veículos.',
  'Ative sua vitrine pública e compartilhe o link.',
  'O agente de IA atende quem chegar pelo WhatsApp.',
  'Acompanhe e feche os leads pelo painel.',
]

export function LandingComoFunciona() {
  return (
    <section className="px-4 py-12">
      <h2 className="mb-6 text-center text-2xl font-semibold">
        Como funciona
      </h2>
      <ol className="mx-auto flex max-w-2xl flex-col gap-4">
        {passos.map((passo, index) => (
          <li key={passo} className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {index + 1}
            </span>
            <span>{passo}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
```

- [ ] **Step 4: Create `LandingCtaFinal.tsx`**

```tsx
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function LandingCtaFinal() {
  return (
    <section className="flex flex-col items-center gap-4 bg-muted px-4 py-16 text-center">
      <h2 className="text-2xl font-semibold">
        Pronto pra automatizar o atendimento da sua revenda?
      </h2>
      <Button size="lg" render={<Link to="/signup" />}>
        Criar conta grátis
      </Button>
    </section>
  )
}
```

- [ ] **Step 5: Create `LandingFooter.tsx`**

```tsx
import { Link } from 'react-router-dom'

export function LandingFooter() {
  return (
    <footer className="flex items-center justify-center gap-4 border-t px-4 py-6 text-sm text-muted-foreground">
      <span>© 2026 ZapCar</span>
      <Link to="/login" className="underline">
        Entrar
      </Link>
    </footer>
  )
}
```

- [ ] **Step 6: Create `src/pages/Landing.tsx` assembling the sections**

```tsx
import { LandingHero } from '@/components/landing/LandingHero'
import { LandingFeatures } from '@/components/landing/LandingFeatures'
import { LandingComoFunciona } from '@/components/landing/LandingComoFunciona'
import { LandingCtaFinal } from '@/components/landing/LandingCtaFinal'
import { LandingFooter } from '@/components/landing/LandingFooter'

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingHero />
      <LandingFeatures />
      <LandingComoFunciona />
      <LandingCtaFinal />
      <LandingFooter />
    </div>
  )
}
```

- [ ] **Step 7: Type-check the new files**

Run: `npm run build`
Expected: succeeds with no TypeScript errors. (The page isn't reachable via any route yet — that's Task 3 — so this step only confirms the new files compile cleanly, not that they render correctly in the browser.)

- [ ] **Step 8: Commit**

```bash
git add src/components/landing src/pages/Landing.tsx
git commit -m "feat: adiciona conteúdo estático da landing page"
```

---

## Task 3: Ligar as rotas — landing na "/", dashboard em "/painel"

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/Login.tsx:39`
- Modify: `src/pages/Signup.tsx:44`

**Interfaces:**
- Consumes: `PublicHomeRoute` (Task 1), `LandingPage` (Task 2), existing `ProtectedRoute`, `DashboardPage`.
- Produces: final route table used by the whole app; no later task depends on this one.

- [ ] **Step 1: Rewrite `src/App.tsx`**

```tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { PublicHomeRoute } from '@/components/PublicHomeRoute'
import LandingPage from '@/pages/Landing'
import LoginPage from '@/pages/Login'
import SignupPage from '@/pages/Signup'
import DashboardPage from '@/pages/Dashboard'
import VeiculosPage from '@/pages/Veiculos'
import VeiculoFormPage from '@/pages/VeiculoForm'
import ConfiguracoesPage from '@/pages/Configuracoes'
import VitrinePage from '@/pages/Vitrine'
import LeadsPage from '@/pages/Leads'

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicHomeRoute>
            <LandingPage />
          </PublicHomeRoute>
        }
      />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        path="/painel"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/veiculos"
        element={
          <ProtectedRoute>
            <VeiculosPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/veiculos/novo"
        element={
          <ProtectedRoute>
            <VeiculoFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/veiculos/:id/editar"
        element={
          <ProtectedRoute>
            <VeiculoFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads"
        element={
          <ProtectedRoute>
            <LeadsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/configuracoes"
        element={
          <ProtectedRoute>
            <ConfiguracoesPage />
          </ProtectedRoute>
        }
      />
      <Route path="/v/:slug" element={<VitrinePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
```

- [ ] **Step 2: Update the post-login redirect in `src/pages/Login.tsx`**

Change line 39 from:

```tsx
    navigate('/')
```

to:

```tsx
    navigate('/painel')
```

- [ ] **Step 3: Update the post-signup redirect in `src/pages/Signup.tsx`**

Change line 44 from:

```tsx
    navigate('/')
```

to:

```tsx
    navigate('/painel')
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the 3 new `PublicHomeRoute` tests from Task 1. (There are no existing `Login`/`Signup`/`Dashboard`/`App` test files today, so no other test needs updating for this route change.)

- [ ] **Step 5: Type-check and build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/pages/Login.tsx src/pages/Signup.tsx
git commit -m "feat: move dashboard para /painel e liga a landing page na raiz"
```

---

## Task 4: Verificação manual e checklist final

Sem lógica nova além da já coberta por testes automatizados (Task 1) — esta tarefa confirma visualmente o que a spec pede, seguindo a mesma convenção usada na Fundação (checklist manual pra conteúdo estático).

**Files:** nenhum (só verificação — nenhuma mudança de código esperada neste passo).

- [ ] **Step 1: Subir o servidor de desenvolvimento**

Run: `npm run dev`

- [ ] **Step 2: Verificar a landing page deslogado**

Acessar `/` num navegador sem sessão ativa (aba anônima, ou depois de um `signOut`). Checklist:
- Hero aparece com headline, subheadline e botão "Criar conta grátis".
- Botão "Criar conta grátis" (Hero e CTA final) leva pra `/signup`.
- Link "Já tem conta? Entrar" leva pra `/login`.
- As 3 features aparecem (Atendimento com IA, CRM visual, Vitrine pública).
- Seção "Como funciona" mostra os 4 passos numerados.
- Rodapé mostra o link "Entrar".
- Nenhuma seção de preço/planos aparece.

- [ ] **Step 3: Verificar o redirecionamento logado**

Fazer login (`/login`) com um usuário existente e confirmar:
- Após o login, a URL final é `/painel` (não `/`), mostrando o Dashboard.
- Acessar `/` manualmente enquanto logado redireciona automaticamente pra `/painel` (sem mostrar a landing).
- Criar uma conta nova em `/signup` (se houver ambiente de teste disponível) também termina em `/painel`.

- [ ] **Step 4: Rodar lint**

Run: `npm run lint`
Expected: sem erros novos introduzidos por este sub-projeto.

- [ ] **Step 5: Atualizar `CLAUDE.md`**

Marcar o item 5a como completo no roteiro (`- 5a. Landing page — spec pronta, aguardando plano de implementação.` → `- 5a. ~~Landing page~~ ✅ completo.`) e adicionar a referência ao plano de implementação, seguindo o mesmo padrão das entregas anteriores.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: marca Landing page (item 5a) como completo"
```

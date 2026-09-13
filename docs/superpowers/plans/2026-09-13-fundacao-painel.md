# Fundação do Painel ZapCar — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ter um painel React funcionando com cadastro, login, rota protegida e deploy automático publicado, sem nenhuma funcionalidade de negócio ainda — a base sobre a qual os próximos sub-projetos (CRUD de veículos, vitrine, CRM, billing) serão construídos.

**Architecture:** SPA React 18 + TypeScript servida pelo Vite, estilizada com Tailwind CSS v4 e componentes shadcn/ui, roteada com React Router, autenticada via Supabase Auth (projeto Supabase já existente). Deploy contínuo: GitHub → Vercel.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, react-router-dom, @supabase/supabase-js.

**Spec:** `docs/superpowers/specs/2026-09-13-fundacao-painel-design.md`

## Global Constraints

- Front-end usa exclusivamente a `publishable key` do Supabase (nunca a `secret key`) — variável `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Esta entrega não tem lógica de negócio própria — verificação é manual (checklist), não testes automatizados. TDD começa no próximo sub-projeto (CRUD de veículos).
- Todo commit termina com a linha: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- Nenhuma chave/segredo do Supabase entra em arquivo versionado — só em `.env.local` (gitignorado) e nas variáveis de ambiente do Vercel.
- Cada task só deve começar depois que a anterior estiver com o commit feito e a verificação manual confirmada — isso é o que dá o "estado salvo" pra retomar depois de uma pausa.

---

### Task 1: Scaffold do projeto (Vite + React + TS + Tailwind + shadcn/ui)

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `components.json`, `src/lib/utils.ts`, `src/components/ui/button.tsx`
- Create: `.gitignore` (gerado pelo Vite; confirmar que `node_modules/`, `.env.local` e `dist/` estão listados)

**Interfaces:**
- Produces: alias de import `@/*` apontando para `src/*` (usado por todas as tasks seguintes e pelos componentes shadcn/ui).

- [ ] **Step 1: Criar o projeto Vite numa pasta temporária e mover pro root**

```bash
npm create vite@latest tmp-scaffold -- --template react-ts
```

```bash
# mover tudo (incluindo arquivos ocultos) da pasta temporária pra raiz do projeto
robocopy tmp-scaffold . /E /MOVE
rmdir tmp-scaffold
```

(No Windows/PowerShell, `robocopy ... /E /MOVE` move todo o conteúdo, incluindo `.gitignore`. Se estiver num shell Unix/Git Bash, use `shopt -s dotglob && mv tmp-scaffold/* . && rmdir tmp-scaffold` no lugar do robocopy.)

- [ ] **Step 2: Instalar dependências base e rodar o dev server**

```bash
npm install
npm run dev
```

Expected: terminal mostra uma URL local (ex: `http://localhost:5173`); abrir no navegador mostra a página padrão do Vite+React. Pare o servidor (Ctrl+C) antes de continuar.

- [ ] **Step 3: Instalar Tailwind CSS v4**

```bash
npm install tailwindcss @tailwindcss/vite
```

Substituir o conteúdo de `vite.config.ts` por:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Substituir o conteúdo de `src/index.css` por:

```css
@import "tailwindcss";
```

- [ ] **Step 4: Configurar o alias `@/*` no TypeScript**

Em `tsconfig.json`, garantir que existe `"references"` para `tsconfig.app.json` (o Vite já gera isso). Em `tsconfig.app.json`, dentro de `compilerOptions`, adicionar:

```json
"baseUrl": ".",
"paths": {
  "@/*": ["./src/*"]
}
```

- [ ] **Step 5: Inicializar shadcn/ui**

```bash
npx shadcn@latest init
```

Se aparecerem perguntas interativas, escolha: estilo **New York**, cor base **Slate**, CSS variables **Yes**. (Versões mais novas do shadcn detectam Tailwind v4 e Vite automaticamente — se algum prompt for diferente do esperado, escolha a opção recomendada/padrão e siga em frente; o importante é o resultado do Step 6.)

- [ ] **Step 6: Adicionar o componente Button do shadcn e verificar visualmente**

```bash
npx shadcn@latest add button
```

Editar `src/App.tsx` temporariamente para:

```tsx
import { Button } from '@/components/ui/button'

function App() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Button>Teste ZapCar</Button>
    </div>
  )
}

export default App
```

Rodar `npm run dev` e abrir no navegador.

Expected: um botão escuro estilizado, centralizado na tela, com o texto "Teste ZapCar" — confirma que Tailwind e shadcn/ui estão funcionando juntos. Pare o servidor.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold do projeto (Vite+React+TS+Tailwind+shadcn/ui)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Cliente Supabase e variáveis de ambiente

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `.env.local` (gitignorado)
- Create: `.env.example` (versionado, sem valores reais)

**Interfaces:**
- Consumes: nenhuma (primeira peça de integração).
- Produces: `supabase` — instância exportada de `src/lib/supabase.ts`, tipo `SupabaseClient`, usada por todas as tasks de autenticação a seguir.

- [ ] **Step 1: Instalar o SDK do Supabase**

```bash
npm install @supabase/supabase-js
```

- [ ] **Step 2: Criar o arquivo de exemplo de variáveis de ambiente**

Criar `.env.example`:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

- [ ] **Step 3: Criar o `.env.local` com os valores reais**

Criar `.env.local` (não commitar — confirme que `.env.local` está no `.gitignore` gerado no Task 1):

```
VITE_SUPABASE_URL=https://nrzrytrzijytuzrvtgej.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<cole aqui a publishable key, aba "Publishable and secret API keys" no painel do Supabase>
```

- [ ] **Step 4: Criar o cliente Supabase**

Criar `src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Variáveis de ambiente do Supabase ausentes. Confira o arquivo .env.local (veja .env.example).'
  )
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey)
```

- [ ] **Step 5: Verificar que o cliente importa sem erro**

Editar `src/App.tsx` temporariamente, adicionando no topo:

```tsx
import { supabase } from '@/lib/supabase'
console.log('Supabase client:', supabase)
```

Rodar `npm run dev`, abrir o navegador, abrir o console do DevTools.

Expected: nenhum erro no console; a linha `Supabase client: SupabaseClient {...}` aparece. Remover o `console.log` depois de confirmar. Pare o servidor.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: cliente Supabase e variáveis de ambiente

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

(O `.env.local` não deve aparecer no `git status` antes desse commit — se aparecer, pare e corrija o `.gitignore` antes de continuar.)

---

### Task 3: AuthContext e hook `useAuth`

**Files:**
- Create: `src/contexts/AuthContext.tsx`

**Interfaces:**
- Consumes: `supabase` de `src/lib/supabase.ts`.
- Produces: `AuthProvider` (componente) e `useAuth()` (hook), retornando `{ session: Session | null, user: User | null, loading: boolean, signOut: () => Promise<void> }`. Usado pelo `ProtectedRoute` (Task 4) e pelas páginas de Login/Signup/Dashboard (Tasks 5-7).

- [ ] **Step 1: Criar o AuthContext**

Criar `src/contexts/AuthContext.tsx`:

```tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession)
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
  }

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth precisa ser usado dentro de um AuthProvider')
  }
  return context
}
```

- [ ] **Step 2: Verificar manualmente que o contexto compila e não quebra o build**

```bash
npx tsc --noEmit
```

Expected: nenhum erro de TypeScript relacionado a `AuthContext.tsx`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: AuthContext e hook useAuth

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Roteamento e ProtectedRoute

**Files:**
- Create: `src/components/ProtectedRoute.tsx`
- Modify: `src/App.tsx` (rotas)
- Modify: `src/main.tsx` (envolver com `BrowserRouter` e `AuthProvider`)

**Interfaces:**
- Consumes: `useAuth()` de `src/contexts/AuthContext.tsx`.
- Produces: `ProtectedRoute` — componente que recebe `children: ReactNode` e redireciona para `/login` se não houver sessão.

- [ ] **Step 1: Instalar o React Router**

```bash
npm install react-router-dom
```

- [ ] **Step 2: Criar o ProtectedRoute**

Criar `src/components/ProtectedRoute.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
```

- [ ] **Step 3: Criar páginas placeholder temporárias**

Criar `src/pages/Login.tsx` (versão temporária, será substituída no Task 5):

```tsx
export default function LoginPage() {
  return <div className="p-8">Página de login (placeholder)</div>
}
```

Criar `src/pages/Dashboard.tsx` (versão temporária, será substituída no Task 7):

```tsx
export default function DashboardPage() {
  return <div className="p-8">Painel (placeholder)</div>
}
```

- [ ] **Step 4: Definir as rotas em App.tsx**

Substituir `src/App.tsx` por:

```tsx
import { Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import LoginPage from '@/pages/Login'
import DashboardPage from '@/pages/Dashboard'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
```

- [ ] **Step 5: Envolver a aplicação com BrowserRouter e AuthProvider**

Substituir `src/main.tsx` por:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
```

- [ ] **Step 6: Verificar manualmente o redirecionamento**

```bash
npm run dev
```

Abrir `http://localhost:5173/` no navegador.

Expected: como não há sessão ativa, a URL muda sozinha para `/login` e mostra "Página de login (placeholder)". Pare o servidor.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: roteamento e ProtectedRoute

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Página de Signup

**Files:**
- Create: `src/pages/Signup.tsx`
- Modify: `src/App.tsx` (adicionar rota `/signup`)
- Modify: `src/pages/Login.tsx` (adicionar link para `/signup`)

**Interfaces:**
- Consumes: `supabase` de `src/lib/supabase.ts`.
- Produces: rota `/signup` navegável a partir de `/login`.

- [ ] **Step 1: Adicionar componentes shadcn/ui necessários**

```bash
npx shadcn@latest add input label card
```

- [ ] **Step 2: Criar a página de Signup**

Criar `src/pages/Signup.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function SignupPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })

    setSubmitting(false)

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    navigate('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Criar conta ZapCar</CardTitle>
          <CardDescription>Cadastre sua loja para começar.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Criando conta...' : 'Criar conta'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Já tem conta?{' '}
              <Link to="/login" className="underline">
                Entrar
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Registrar a rota**

Em `src/App.tsx`, adicionar o import `import SignupPage from '@/pages/Signup'` e a rota:

```tsx
<Route path="/signup" element={<SignupPage />} />
```

(mantendo as rotas `/login` e `/` já existentes do Task 4).

- [ ] **Step 4: Verificar manualmente o cadastro de ponta a ponta**

```bash
npm run dev
```

Abrir `http://localhost:5173/signup`, preencher um e-mail novo e uma senha, clicar em "Criar conta".

Expected:
1. A tela redireciona para `/` (mostrando o Dashboard placeholder), confirmando que a sessão foi criada.
2. No painel do Supabase (Authentication → Users), o novo usuário aparece.
3. No painel do Supabase (Table Editor → `lojas`), uma linha nova aparece vinculada a esse `user_id` (confirma que o trigger `handle_new_user` disparou). O mesmo deve valer para `lojas_config_ia`.

Pare o servidor.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: página de cadastro (signup)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Página de Login

**Files:**
- Modify: `src/pages/Login.tsx` (substituir o placeholder pela versão real)

**Interfaces:**
- Consumes: `supabase` de `src/lib/supabase.ts`.

- [ ] **Step 1: Substituir o placeholder pela página real**

Substituir `src/pages/Login.tsx` por:

```tsx
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setSubmitting(false)

    if (signInError) {
      setError(signInError.message)
      return
    }

    navigate('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Entrar no ZapCar</CardTitle>
          <CardDescription>Acesse o painel da sua loja.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Entrando...' : 'Entrar'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Não tem conta?{' '}
              <Link to="/signup" className="underline">
                Cadastre-se
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verificar manualmente o login e o erro de credencial inválida**

```bash
npm run dev
```

1. Fazer logout se ainda estiver logado (limpar cookies do site local, ou usar aba anônima).
2. Abrir `/login`, tentar entrar com uma senha errada.

Expected: mensagem de erro em vermelho aparece no formulário, sem redirecionar.

3. Tentar de novo com a senha correta (a mesma criada no Task 5).

Expected: redireciona para `/` mostrando o Dashboard placeholder. Pare o servidor.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: página de login

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Dashboard placeholder com logout e Error Boundary

**Files:**
- Modify: `src/pages/Dashboard.tsx` (substituir o placeholder)
- Create: `src/components/ErrorBoundary.tsx`
- Modify: `src/main.tsx` (envolver `<App />` com o ErrorBoundary)

**Interfaces:**
- Consumes: `useAuth()` de `src/contexts/AuthContext.tsx`.
- Produces: `ErrorBoundary` — componente de classe que recebe `children` e captura erros de renderização dos filhos.

- [ ] **Step 1: Criar o ErrorBoundary**

Criar `src/components/ErrorBoundary.tsx`:

```tsx
import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Erro capturado pelo ErrorBoundary:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <p className="text-center text-muted-foreground">
            Algo deu errado. Tente recarregar a página.
          </p>
        </div>
      )
    }

    return this.props.children
  }
}
```

- [ ] **Step 2: Substituir o Dashboard placeholder**

Substituir `src/pages/Dashboard.tsx` por:

```tsx
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const { user, signOut } = useAuth()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-2xl font-semibold">Painel em construção</h1>
      <p className="text-muted-foreground">Logado como {user?.email}</p>
      <Button variant="outline" onClick={() => signOut()}>
        Sair
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Envolver a aplicação com o ErrorBoundary**

Em `src/main.tsx`, importar `import { ErrorBoundary } from '@/components/ErrorBoundary'` e envolver `<App />`:

```tsx
<BrowserRouter>
  <AuthProvider>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </AuthProvider>
</BrowserRouter>
```

- [ ] **Step 4: Verificar manualmente logout e o ErrorBoundary**

```bash
npm run dev
```

1. Logado no painel (`/`), clicar em "Sair".

Expected: redireciona para `/login` (via `ProtectedRoute`, já que a sessão foi limpa).

2. Pra testar o ErrorBoundary, edite temporariamente `src/pages/Dashboard.tsx` adicionando `throw new Error('teste')` logo no início da função `DashboardPage`, logue novamente e acesse `/`.

Expected: em vez de tela branca, aparece a mensagem "Algo deu errado. Tente recarregar a página." Remova a linha `throw new Error('teste')` depois de confirmar. Pare o servidor.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: dashboard placeholder, logout e ErrorBoundary

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: GitHub e deploy no Vercel

**Files:**
- Create: `.env.example` (já existe do Task 2 — conferir que está atualizado)
- Nenhum outro arquivo de código novo — esta task é só configuração de infraestrutura.

- [ ] **Step 1: Criar o repositório no GitHub e conectar**

No GitHub, criar um repositório novo chamado `zapcar-frontend` (privado, sem inicializar com README/gitignore — já temos os nossos).

```bash
git remote add origin https://github.com/<seu-usuario>/zapcar-frontend.git
git push -u origin main
```

- [ ] **Step 2: Criar o projeto no Vercel**

No painel do Vercel: **Add New → Project**, selecionar o repositório `zapcar-frontend` recém-criado no GitHub. O Vercel detecta Vite automaticamente (framework preset "Vite").

- [ ] **Step 3: Configurar as variáveis de ambiente no Vercel**

Na tela de configuração do projeto (ou depois, em Settings → Environment Variables), adicionar, para o ambiente "Production" (e "Preview"):

```
VITE_SUPABASE_URL=https://nrzrytrzijytuzrvtgej.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<a mesma publishable key do .env.local>
```

Clicar em **Deploy**.

- [ ] **Step 4: Verificar o deploy de ponta a ponta**

Aguardar o build terminar e abrir a URL gerada pelo Vercel (ex: `https://zapcar-frontend.vercel.app`).

Expected: a página `/login` carrega estilizada (Tailwind/shadcn funcionando em produção). Repita ali o fluxo de cadastro/login/logout do navegador (Tasks 5-7) — tudo deve funcionar igual ao ambiente local, contra o mesmo Supabase.

- [ ] **Step 5: Confirmar deploy automático**

Fazer qualquer alteração pequena e sem risco (ex: mudar o texto "Painel em construção" para "Painel em construção 🚗" em `src/pages/Dashboard.tsx`), commitar e dar push:

```bash
git add -A
git commit -m "chore: verifica deploy automático

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push
```

Expected: um novo deploy começa sozinho no painel do Vercel, e a URL de produção reflete a mudança de texto em 1-2 minutos, sem nenhuma ação manual no Vercel.

- [ ] **Step 6: Commit final (se houver qualquer ajuste pendente)**

Se tudo já estiver commitado no Step 5, esta task termina aqui. A Fundação está completa: cadastro, login, rota protegida e deploy automático funcionando de ponta a ponta.

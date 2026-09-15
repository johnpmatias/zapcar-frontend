# Billing (Asaas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every loja a 7-day free trial that degrades to a read-only mode when it expires, and let the lojista pay R$ 97/month via Asaas (Pix, boleto or card) from a new `/assinatura` page to regain full access.

**Architecture:** Two new columns-driven states live on the existing `lojas` row (`subscription_status`, `trial_ends_at`, plus Asaas identifiers), computed into a single `loja_tem_acesso_completo(loja_id)` SQL function that backs both a Postgres RLS restrictive-policy layer (real enforcement) and a `useAssinatura()` React hook (UI reflection). Three small Supabase Edge Functions (Deno) talk to the Asaas API using a service-role key that never reaches the browser: one creates the subscription and returns a hosted payment link, one receives Asaas's payment webhook and flips `subscription_status`, one lists the loja's billing history for the new `/assinatura` page.

**Tech Stack:** React 19 + TypeScript + Vite, Tailwind CSS v4, shadcn/ui (`base-nova` over `@base-ui/react`), React Router v7, `@supabase/supabase-js` v2, React Hook Form + Zod, Vitest + React Testing Library (frontend); Deno + Supabase Edge Functions + Asaas REST API v3 (backend, deployed manually).

**Spec:** `docs/superpowers/specs/2026-09-15-billing-asaas-design.md`

## Global Constraints

- Every commit message ends with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- A `Button`/`DialogTrigger` that behaves as a link or wraps another trigger uses the `render` prop (e.g. `<Button render={<Link to="/assinatura" />}>`) — never `asChild`, never `onClick` + `window.open`. Exception: redirecting to the external Asaas payment page in Task 11 is an actual page navigation away from the SPA, so it uses `window.location.href` directly, not a router `Link`/`Button`.
- Plano único: R$ 97,00/mês, trial de 7 dias. No pricing tiers.
- The Edge Functions' source lives inside this repository under `supabase/functions/` (new convention for this project — earlier back-end SQL was delivered inline in plan documents because it changed pre-existing, undocumented infrastructure; Edge Function code is brand new, benefits from version control, and Task 7 needs it to share a unit-tested pure function with `src/lib/`). Deploying it (`supabase functions deploy ...`) stays a manual step outside any CI in this repo, same spirit as the SQL tasks.
- `loja_tem_acesso_completo(loja_id)` is the single source of truth for "this loja can create/edit" — every guard, banner and RLS policy in this plan calls it (directly or via the `useAssinatura` hook), nothing re-derives the rule independently.
- TDD for all new business logic (hooks, guards, the webhook event mapper), per this project's existing convention. Static/manual-only pieces (the SQL task, the two non-webhook Edge Functions, end-to-end sandbox verification) are called out explicitly where automated tests don't apply.

---

## Task 1: Schema, access function and RLS (Supabase SQL, manual)

**Files:** none in this repo — SQL run by hand in the Supabase SQL Editor of the project this front-end already talks to.

**Interfaces:**
- Produces: columns `lojas.subscription_status` (`'trial' | 'active' | 'overdue' | 'canceled'`), `lojas.trial_ends_at`, `lojas.asaas_customer_id`, `lojas.asaas_subscription_id`; SQL function `public.loja_tem_acesso_completo(p_loja_id uuid) returns boolean`. Task 2 (`useAssinatura`) and every later frontend task assume these exact names and the four status strings. Tasks 8/9/10 (Edge Functions) write/read the same four columns via the service role.

- [ ] **Step 1: Confirm the tenant column name on the two config tables**

Run in the Supabase SQL Editor:

```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('lojas_config_whatsapp', 'lojas_config_ia')
  and column_name = 'loja_id';
```

Expected: two rows (one per table). If either table has no `loja_id` row here, find its actual tenant column with `select column_name from information_schema.columns where table_schema = 'public' and table_name = '<tabela>'` and substitute that name for `loja_id` everywhere Step 3 references that specific table.

- [ ] **Step 2: Add the billing columns**

```sql
alter table public.lojas
  add column subscription_status text not null default 'trial'
    check (subscription_status in ('trial', 'active', 'overdue', 'canceled')),
  add column trial_ends_at timestamptz not null default (now() + interval '7 days'),
  add column asaas_customer_id text,
  add column asaas_subscription_id text;
```

This also gives every already-existing loja row (there is no real customer data yet — confirmed test-only in `zapcar_hardening.sql`) a fresh 7-day trial the moment this runs, since a `default` on a new `not null` column back-fills existing rows. The existing `handle_new_user` trigger does not need to change: it inserts into `lojas` without naming these columns, so every new signup gets the same defaults automatically.

- [ ] **Step 3: Create the access function and lock down the billing columns**

```sql
create or replace function public.loja_tem_acesso_completo(p_loja_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select subscription_status = 'active'
        or (subscription_status = 'trial' and trial_ends_at > now())
      from public.lojas
      where id = p_loja_id
    ),
    false
  );
$$;

grant execute on function public.loja_tem_acesso_completo(uuid) to anon, authenticated;

-- A column-level `revoke` here would NOT work: Supabase already grants
-- `authenticated`/`anon` a blanket table-level privilege on every public
-- table (RLS is the real gate), and in Postgres a table-level grant is not
-- narrowed by a later column-level revoke — the role would keep full
-- column access regardless. A BEFORE UPDATE trigger is the correct
-- mechanism: only `service_role` (used by the Edge Functions in Tasks
-- 7-9, which bypasses RLS entirely) may ever change these four columns,
-- regardless of what the RLS policy in Step 4 allows on the rest of the
-- row. Without this, a lojista mid-trial (where `loja_tem_acesso_completo`
-- is already true) could PATCH their own row and set
-- `subscription_status = 'active'` forever, for free.
create or replace function public.proteger_colunas_billing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.subscription_status is distinct from old.subscription_status
    or new.trial_ends_at is distinct from old.trial_ends_at
    or new.asaas_customer_id is distinct from old.asaas_customer_id
    or new.asaas_subscription_id is distinct from old.asaas_subscription_id
  ) and auth.role() <> 'service_role' then
    raise exception 'Alteração de campos de billing só é permitida pelo back-end (service_role).';
  end if;
  return new;
end;
$$;

create trigger bloqueia_edicao_billing
  before update on public.lojas
  for each row
  execute function public.proteger_colunas_billing();
```

This closes the write side. The read side (`anon` selecting these four columns directly from `lojas` via a raw REST call, instead of through the `loja_tem_acesso_completo` RPC) has the same table-vs-column-grant limitation and is knowingly left open here: what it exposes is only a status enum and a date, not sensitive data, and closing it properly means revoking `anon`'s table-level SELECT entirely and re-granting it column-by-column for the ~30 columns the public vitrine actually needs (matching `COLUNAS_LOJA_PUBLICA` in `src/lib/vitrine.ts`) — a bigger, riskier change than this task's scope justifies, since getting that column list wrong would break the public vitrine outright. Treat as a low-priority future hardening, not a launch blocker.

- [ ] **Step 4: Add restrictive write policies**

These `restrictive` policies AND together with whatever permissive insert/update/delete policies already exist for `authenticated` on these tables (which must already exist today, since CRUD veículos and Configurações da loja are live in production) — they narrow existing access without needing to know or touch those policies' exact definitions.

```sql
create policy "Bloqueio sem assinatura ativa (lojas update)" on public.lojas
  as restrictive for update to authenticated
  using (loja_tem_acesso_completo(id))
  with check (loja_tem_acesso_completo(id));

create policy "Bloqueio sem assinatura ativa (veiculos insert)" on public.veiculos
  as restrictive for insert to authenticated
  with check (loja_tem_acesso_completo(loja_id));
create policy "Bloqueio sem assinatura ativa (veiculos update)" on public.veiculos
  as restrictive for update to authenticated
  using (loja_tem_acesso_completo(loja_id))
  with check (loja_tem_acesso_completo(loja_id));
create policy "Bloqueio sem assinatura ativa (veiculos delete)" on public.veiculos
  as restrictive for delete to authenticated
  using (loja_tem_acesso_completo(loja_id));

create policy "Bloqueio sem assinatura ativa (whatsapp insert)" on public.lojas_config_whatsapp
  as restrictive for insert to authenticated
  with check (loja_tem_acesso_completo(loja_id));
create policy "Bloqueio sem assinatura ativa (whatsapp update)" on public.lojas_config_whatsapp
  as restrictive for update to authenticated
  using (loja_tem_acesso_completo(loja_id))
  with check (loja_tem_acesso_completo(loja_id));
create policy "Bloqueio sem assinatura ativa (whatsapp delete)" on public.lojas_config_whatsapp
  as restrictive for delete to authenticated
  using (loja_tem_acesso_completo(loja_id));

create policy "Bloqueio sem assinatura ativa (ia insert)" on public.lojas_config_ia
  as restrictive for insert to authenticated
  with check (loja_tem_acesso_completo(loja_id));
create policy "Bloqueio sem assinatura ativa (ia update)" on public.lojas_config_ia
  as restrictive for update to authenticated
  using (loja_tem_acesso_completo(loja_id))
  with check (loja_tem_acesso_completo(loja_id));
create policy "Bloqueio sem assinatura ativa (ia delete)" on public.lojas_config_ia
  as restrictive for delete to authenticated
  using (loja_tem_acesso_completo(loja_id));
```

If Step 1 found a different column name on `lojas_config_whatsapp` or `lojas_config_ia`, replace `loja_id` in that table's three policies above with the real column name before running them.

- [ ] **Step 5: Verify**

```sql
select policyname, permissive, cmd, roles
from pg_policies
where schemaname = 'public'
  and policyname like 'Bloqueio sem assinatura ativa%'
order by tablename, policyname;
```

Expected: 10 rows, all with `permissive = 'RESTRICTIVE'`. Then, in the app (still on `main` before any frontend change), confirm nothing broke: log in as an existing test lojista and edit a veículo — it should still save normally, since that loja is inside its fresh 7-day trial from Step 2.

- [ ] **Step 6: Commit the plan's own checkbox state**

No repo files changed in this task — nothing to commit. Proceed to Task 2.

---

## Task 2: `Loja` type + `useAssinatura` hook (TDD)

**Files:**
- Modify: `src/lib/loja.ts`
- Create: `src/hooks/useAssinatura.ts`
- Test: `src/hooks/useAssinatura.test.ts`

**Interfaces:**
- Consumes: `useAuth()` (`{ user }`), `useLoja(userId)` (`{ loja, carregando, erro, recarregar }` from `src/hooks/useLoja.ts`), the new `Loja.subscription_status`/`trial_ends_at` fields.
- Produces: `export type StatusAssinatura = 'trial' | 'active' | 'overdue' | 'canceled'` and `export function useAssinatura(): { status: StatusAssinatura | null; diasRestantesTrial: number | null; temAcessoCompleto: boolean; carregando: boolean; erro: string | null; recarregar: () => void }`. Every later frontend task (banner, guard, page gates) consumes exactly this shape.

- [ ] **Step 1: Add the billing fields to `Loja` and exclude them from `LojaPayload`**

In `src/lib/loja.ts`, add four fields to the `Loja` interface (right before `created_at`) and update `LojaPayload`:

```typescript
export interface Loja {
  id: string
  user_id: string
  nome_loja: string | null
  descricao: string | null
  telefone_contato: string | null
  email_contato: string | null
  logradouro: string | null
  numero: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
  google_maps_link: string | null
  horario_semana_abertura: string | null
  horario_semana_fechamento: string | null
  horario_sabado_abertura: string | null
  horario_sabado_fechamento: string | null
  horario_domingo_abertura: string | null
  horario_domingo_fechamento: string | null
  logo_url: string | null
  banner_url: string | null
  cor_primaria: string | null
  cor_secundaria: string | null
  slug: string | null
  vitrine_publica: boolean | null
  vitrine_headline: string | null
  vitrine_subheadline: string | null
  vitrine_cta_texto: string | null
  vitrine_cta_destino: string | null
  vitrine_destaque_url: string | null
  vitrine_destaque_tipo: string | null
  meta_titulo: string | null
  meta_descricao: string | null
  og_image_url: string | null
  instagram_url: string | null
  facebook_url: string | null
  tiktok_url: string | null
  youtube_url: string | null
  meta_pixel_id: string | null
  google_tag_id: string | null
  subscription_status: 'trial' | 'active' | 'overdue' | 'canceled'
  trial_ends_at: string
  asaas_customer_id: string | null
  asaas_subscription_id: string | null
  created_at: string
}

export type LojaPayload = Omit<
  Loja,
  | 'id'
  | 'user_id'
  | 'created_at'
  | 'subscription_status'
  | 'trial_ends_at'
  | 'asaas_customer_id'
  | 'asaas_subscription_id'
>
```

`getLoja`/`updateLoja` bodies don't change — `select('*')` already returns the new columns, and `LojaPayload` now correctly excludes them so `Configuracoes.tsx`'s existing payload (built explicitly field-by-field) keeps compiling untouched.

- [ ] **Step 2: Run the existing `loja` tests to confirm nothing broke**

Run: `npm test -- loja.test`
Expected: PASS, same test count as before (the payload fixture in that test file never included the new fields, and now they're excluded from the type, so nothing there needs updating).

- [ ] **Step 3: Update the one test fixture that builds a full `Loja` object**

`tsconfig.app.json` includes all of `src` (test files too), so `npm run build` type-checks every `.test.tsx` file. `src/pages/Configuracoes.test.tsx` has a `lojaExemplo` object matching the full `Loja` shape (passed to `getLoja`'s mock, whose return type is `Promise<Loja | null>`) — it needs the four new fields or the build breaks later. (`src/lib/loja.test.ts` uses `LojaPayload`, which now excludes these fields — nothing to change there. `src/pages/Vitrine.test.tsx` uses the `LojaPublica` shape, which never included them either — nothing to change there.)

In `src/pages/Configuracoes.test.tsx`, add to the `lojaExemplo` object, right before `created_at`:

```typescript
  subscription_status: 'active' as const,
  trial_ends_at: '2026-01-08T00:00:00Z',
  asaas_customer_id: null,
  asaas_subscription_id: null,
```

Using `'active'` here means every pre-existing test in this file keeps exercising the page with full access, matching their current behavior before Task 5 introduces the read-only variant.

- [ ] **Step 4: Run `Configuracoes.test.tsx` and `npm run build` to confirm the fixture fix is enough**

Run: `npm test -- Configuracoes.test` — expected PASS, same test count as before.
Run: `npm run build` — expected: succeeds (this is the first full type-check since the `Loja` interface changed).

- [ ] **Step 5: Write the failing tests for `useAssinatura`**

Create `src/hooks/useAssinatura.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAssinatura } from './useAssinatura'
import { useAuth } from '@/hooks/useAuth'
import { getLoja, type Loja } from '@/lib/loja'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/lib/loja', () => ({
  getLoja: vi.fn(),
}))

function lojaComStatus(overrides: Partial<Loja>): Loja {
  return {
    id: 'loja-1',
    user_id: 'user-1',
    nome_loja: 'Auto Center Silva',
    descricao: null,
    telefone_contato: null,
    email_contato: null,
    logradouro: null,
    numero: null,
    bairro: null,
    cidade: null,
    estado: null,
    cep: null,
    google_maps_link: null,
    horario_semana_abertura: null,
    horario_semana_fechamento: null,
    horario_sabado_abertura: null,
    horario_sabado_fechamento: null,
    horario_domingo_abertura: null,
    horario_domingo_fechamento: null,
    logo_url: null,
    banner_url: null,
    cor_primaria: null,
    cor_secundaria: null,
    slug: null,
    vitrine_publica: false,
    vitrine_headline: null,
    vitrine_subheadline: null,
    vitrine_cta_texto: null,
    vitrine_cta_destino: null,
    vitrine_destaque_url: null,
    vitrine_destaque_tipo: null,
    meta_titulo: null,
    meta_descricao: null,
    og_image_url: null,
    instagram_url: null,
    facebook_url: null,
    tiktok_url: null,
    youtube_url: null,
    meta_pixel_id: null,
    google_tag_id: null,
    subscription_status: 'trial',
    trial_ends_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    asaas_customer_id: null,
    asaas_subscription_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'user-1' } as never,
    session: {} as never,
    loading: false,
    signOut: vi.fn(),
  })
  vi.mocked(getLoja).mockReset()
})

describe('useAssinatura', () => {
  it('dá acesso completo e sem contagem quando a assinatura está ativa', async () => {
    vi.mocked(getLoja).mockResolvedValue(lojaComStatus({ subscription_status: 'active' }))

    const { result } = renderHook(() => useAssinatura())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.status).toBe('active')
    expect(result.current.temAcessoCompleto).toBe(true)
    expect(result.current.diasRestantesTrial).toBeNull()
  })

  it('dá acesso completo e conta os dias restantes durante o trial', async () => {
    vi.mocked(getLoja).mockResolvedValue(
      lojaComStatus({
        subscription_status: 'trial',
        trial_ends_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      })
    )

    const { result } = renderHook(() => useAssinatura())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.temAcessoCompleto).toBe(true)
    expect(result.current.diasRestantesTrial).toBeGreaterThanOrEqual(2)
    expect(result.current.diasRestantesTrial).toBeLessThanOrEqual(3)
  })

  it('bloqueia o acesso quando o trial já venceu', async () => {
    vi.mocked(getLoja).mockResolvedValue(
      lojaComStatus({
        subscription_status: 'trial',
        trial_ends_at: new Date(Date.now() - 86_400_000).toISOString(),
      })
    )

    const { result } = renderHook(() => useAssinatura())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.temAcessoCompleto).toBe(false)
    expect(result.current.diasRestantesTrial).toBeNull()
  })

  it('bloqueia o acesso quando a assinatura está em atraso ou cancelada', async () => {
    vi.mocked(getLoja).mockResolvedValue(lojaComStatus({ subscription_status: 'overdue' }))
    const { result: overdue } = renderHook(() => useAssinatura())
    await waitFor(() => expect(overdue.current.carregando).toBe(false))
    expect(overdue.current.temAcessoCompleto).toBe(false)

    vi.mocked(getLoja).mockResolvedValue(lojaComStatus({ subscription_status: 'canceled' }))
    const { result: canceled } = renderHook(() => useAssinatura())
    await waitFor(() => expect(canceled.current.carregando).toBe(false))
    expect(canceled.current.temAcessoCompleto).toBe(false)
  })

  it('não dá acesso completo enquanto a loja ainda não carregou', () => {
    vi.mocked(getLoja).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useAssinatura())

    expect(result.current.carregando).toBe(true)
    expect(result.current.temAcessoCompleto).toBe(false)
    expect(result.current.status).toBeNull()
  })
})
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npm test -- useAssinatura.test`
Expected: FAIL — `Cannot find module './useAssinatura'`.

- [ ] **Step 7: Implement `useAssinatura`**

Create `src/hooks/useAssinatura.ts`:

```typescript
import { useAuth } from '@/hooks/useAuth'
import { useLoja } from '@/hooks/useLoja'

export type StatusAssinatura = 'trial' | 'active' | 'overdue' | 'canceled'

export interface EstadoAssinatura {
  status: StatusAssinatura | null
  diasRestantesTrial: number | null
  temAcessoCompleto: boolean
  carregando: boolean
  erro: string | null
}

const UM_DIA_MS = 24 * 60 * 60 * 1000

export function useAssinatura(): EstadoAssinatura & { recarregar: () => void } {
  const { user } = useAuth()
  const { loja, carregando, erro, recarregar } = useLoja(user?.id)

  if (!loja) {
    return { status: null, diasRestantesTrial: null, temAcessoCompleto: false, carregando, erro, recarregar }
  }

  const status = loja.subscription_status
  const trialValido = status === 'trial' && new Date(loja.trial_ends_at).getTime() > Date.now()
  const temAcessoCompleto = status === 'active' || trialValido
  const diasRestantesTrial = trialValido
    ? Math.max(0, Math.ceil((new Date(loja.trial_ends_at).getTime() - Date.now()) / UM_DIA_MS))
    : null

  return { status, diasRestantesTrial, temAcessoCompleto, carregando, erro, recarregar }
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm test -- useAssinatura.test`
Expected: PASS, 5 tests.

- [ ] **Step 9: Commit**

```bash
git add src/lib/loja.ts src/hooks/useAssinatura.ts src/hooks/useAssinatura.test.ts src/pages/Configuracoes.test.tsx
git commit -m "feat: adiciona campos de billing em Loja e o hook useAssinatura"
```

---

## Task 3: `AssinaturaBanner` + wire into `ProtectedRoute` (TDD)

**Files:**
- Create: `src/components/AssinaturaBanner.tsx`
- Test: `src/components/AssinaturaBanner.test.tsx`
- Modify: `src/components/ProtectedRoute.tsx`
- Test: `src/components/ProtectedRoute.test.tsx` (new file — this component had no test yet)

**Interfaces:**
- Consumes: `useAssinatura()` from Task 2.
- Produces: `export function AssinaturaBanner()` — rendered inside `ProtectedRoute`, above `children`, so it appears on every authenticated page without touching each page individually.

- [ ] **Step 1: Write the failing tests for `AssinaturaBanner`**

Create `src/components/AssinaturaBanner.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AssinaturaBanner } from '@/components/AssinaturaBanner'
import { useAssinatura } from '@/hooks/useAssinatura'

vi.mock('@/hooks/useAssinatura', () => ({
  useAssinatura: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(useAssinatura).mockReset()
})

function renderBanner() {
  return render(
    <MemoryRouter>
      <AssinaturaBanner />
    </MemoryRouter>
  )
}

describe('AssinaturaBanner', () => {
  it('não mostra nada enquanto carrega', () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: null,
      diasRestantesTrial: null,
      temAcessoCompleto: false,
      carregando: true,
      erro: null,
      recarregar: vi.fn(),
    })
    const { container } = renderBanner()
    expect(container).toBeEmptyDOMElement()
  })

  it('não mostra nada quando a assinatura está ativa', () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: 'active',
      diasRestantesTrial: null,
      temAcessoCompleto: true,
      carregando: false,
      erro: null,
      recarregar: vi.fn(),
    })
    const { container } = renderBanner()
    expect(container).toBeEmptyDOMElement()
  })

  it('mostra a contagem regressiva durante o trial', () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: 'trial',
      diasRestantesTrial: 3,
      temAcessoCompleto: true,
      carregando: false,
      erro: null,
      recarregar: vi.fn(),
    })
    renderBanner()
    expect(screen.getByText(/acaba em 3 dias/i)).toBeInTheDocument()
  })

  it('mostra o aviso de modo leitura quando o acesso está bloqueado', () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: 'overdue',
      diasRestantesTrial: null,
      temAcessoCompleto: false,
      carregando: false,
      erro: null,
      recarregar: vi.fn(),
    })
    renderBanner()
    expect(screen.getByText(/modo leitura/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- AssinaturaBanner.test`
Expected: FAIL — `Cannot find module '@/components/AssinaturaBanner'`.

- [ ] **Step 3: Implement `AssinaturaBanner`**

Create `src/components/AssinaturaBanner.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { useAssinatura } from '@/hooks/useAssinatura'

export function AssinaturaBanner() {
  const { status, diasRestantesTrial, temAcessoCompleto, carregando } = useAssinatura()

  if (carregando || status === null || status === 'active') return null

  if (temAcessoCompleto) {
    return (
      <div role="status" className="bg-muted px-4 py-2 text-center text-sm">
        Seu trial acaba em {diasRestantesTrial} {diasRestantesTrial === 1 ? 'dia' : 'dias'}.{' '}
        <Link to="/assinatura" className="underline">
          Assinar agora
        </Link>
      </div>
    )
  }

  return (
    <div role="alert" className="bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
      Sua conta está em modo leitura — assine para voltar a criar e editar.{' '}
      <Link to="/assinatura" className="underline">
        Assinar agora
      </Link>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- AssinaturaBanner.test`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the failing tests for `ProtectedRoute` (wiring the banner in)**

Create `src/components/ProtectedRoute.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAuth } from '@/hooks/useAuth'
import { useAssinatura } from '@/hooks/useAssinatura'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/hooks/useAssinatura', () => ({
  useAssinatura: vi.fn(),
}))

function renderComProtectedRoute() {
  return render(
    <MemoryRouter initialEntries={['/painel']}>
      <Routes>
        <Route
          path="/painel"
          element={
            <ProtectedRoute>
              <div>Painel conteúdo</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>Login conteúdo</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.mocked(useAuth).mockReset()
  vi.mocked(useAssinatura).mockReturnValue({
    status: 'active',
    diasRestantesTrial: null,
    temAcessoCompleto: true,
    carregando: false,
    erro: null,
    recarregar: vi.fn(),
  })
})

describe('ProtectedRoute', () => {
  it('mostra o estado de carregamento enquanto a sessão ainda não foi resolvida', () => {
    vi.mocked(useAuth).mockReturnValue({ session: null, user: null, loading: true, signOut: vi.fn() })
    renderComProtectedRoute()
    expect(screen.getByText('Carregando...')).toBeInTheDocument()
  })

  it('redireciona para /login quando não há sessão', () => {
    vi.mocked(useAuth).mockReturnValue({ session: null, user: null, loading: false, signOut: vi.fn() })
    renderComProtectedRoute()
    expect(screen.getByText('Login conteúdo')).toBeInTheDocument()
  })

  it('renderiza os children e o banner de assinatura quando há sessão', () => {
    vi.mocked(useAuth).mockReturnValue({
      session: {} as never,
      user: { id: 'user-1' } as never,
      loading: false,
      signOut: vi.fn(),
    })
    vi.mocked(useAssinatura).mockReturnValue({
      status: 'trial',
      diasRestantesTrial: 5,
      temAcessoCompleto: true,
      carregando: false,
      erro: null,
      recarregar: vi.fn(),
    })

    renderComProtectedRoute()

    expect(screen.getByText('Painel conteúdo')).toBeInTheDocument()
    expect(screen.getByText(/acaba em 5 dias/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run tests to verify the new assertions fail**

Run: `npm test -- ProtectedRoute.test`
Expected: FAIL on the third test — the banner text isn't rendered yet.

- [ ] **Step 7: Wire `AssinaturaBanner` into `ProtectedRoute`**

Modify `src/components/ProtectedRoute.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { AssinaturaBanner } from '@/components/AssinaturaBanner'

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

  return (
    <>
      <AssinaturaBanner />
      {children}
    </>
  )
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test -- ProtectedRoute.test AssinaturaBanner.test`
Expected: PASS, 7 tests total.

- [ ] **Step 9: Commit**

```bash
git add src/components/AssinaturaBanner.tsx src/components/AssinaturaBanner.test.tsx src/components/ProtectedRoute.tsx src/components/ProtectedRoute.test.tsx
git commit -m "feat: adiciona AssinaturaBanner e liga ele ao ProtectedRoute"
```

---

## Task 4: `RequireAssinaturaAtiva` guard + bloqueio de criar/editar/excluir veículo (TDD)

**Files:**
- Create: `src/components/RequireAssinaturaAtiva.tsx`
- Test: `src/components/RequireAssinaturaAtiva.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/Veiculos.tsx`
- Modify: `src/pages/Veiculos.test.tsx` (existing file)
- Modify: `src/components/veiculos/LinhaVeiculo.tsx`
- Test: `src/components/veiculos/LinhaVeiculo.test.tsx` (new file — this component had no test yet)

**Interfaces:**
- Consumes: `useAssinatura()` from Task 2.
- Produces: `export function RequireAssinaturaAtiva({ children }: { children: ReactNode })`, used by `App.tsx` wrapping `VeiculoFormPage` at `/veiculos/novo` and `/veiculos/:id/editar`. `LinhaVeiculo` gains a required `temAcessoCompleto: boolean` prop.

- [ ] **Step 1: Write the failing tests for `RequireAssinaturaAtiva`**

Create `src/components/RequireAssinaturaAtiva.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { RequireAssinaturaAtiva } from '@/components/RequireAssinaturaAtiva'
import { useAssinatura } from '@/hooks/useAssinatura'

vi.mock('@/hooks/useAssinatura', () => ({
  useAssinatura: vi.fn(),
}))

function renderComGuard() {
  return render(
    <MemoryRouter initialEntries={['/veiculos/novo']}>
      <Routes>
        <Route
          path="/veiculos/novo"
          element={
            <RequireAssinaturaAtiva>
              <div>Formulário conteúdo</div>
            </RequireAssinaturaAtiva>
          }
        />
        <Route path="/assinatura" element={<div>Assinatura conteúdo</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.mocked(useAssinatura).mockReset()
})

describe('RequireAssinaturaAtiva', () => {
  it('mostra o estado de carregamento enquanto a assinatura ainda não foi resolvida', () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: null,
      diasRestantesTrial: null,
      temAcessoCompleto: false,
      carregando: true,
      erro: null,
      recarregar: vi.fn(),
    })
    renderComGuard()
    expect(screen.getByText('Carregando...')).toBeInTheDocument()
  })

  it('renderiza os children quando há acesso completo', () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: 'trial',
      diasRestantesTrial: 3,
      temAcessoCompleto: true,
      carregando: false,
      erro: null,
      recarregar: vi.fn(),
    })
    renderComGuard()
    expect(screen.getByText('Formulário conteúdo')).toBeInTheDocument()
  })

  it('redireciona para /assinatura quando não há acesso completo', () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: 'overdue',
      diasRestantesTrial: null,
      temAcessoCompleto: false,
      carregando: false,
      erro: null,
      recarregar: vi.fn(),
    })
    renderComGuard()
    expect(screen.getByText('Assinatura conteúdo')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- RequireAssinaturaAtiva.test`
Expected: FAIL — `Cannot find module '@/components/RequireAssinaturaAtiva'`.

- [ ] **Step 3: Implement `RequireAssinaturaAtiva`**

Create `src/components/RequireAssinaturaAtiva.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAssinatura } from '@/hooks/useAssinatura'

export function RequireAssinaturaAtiva({ children }: { children: ReactNode }) {
  const { carregando, temAcessoCompleto } = useAssinatura()

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  if (!temAcessoCompleto) {
    return <Navigate to="/assinatura" replace />
  }

  return <>{children}</>
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- RequireAssinaturaAtiva.test`
Expected: PASS, 3 tests.

- [ ] **Step 5: Wire the guard into the veículo create/edit routes**

Modify `src/App.tsx` — add the import and wrap the two routes:

```tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { PublicHomeRoute } from '@/components/PublicHomeRoute'
import { RequireAssinaturaAtiva } from '@/components/RequireAssinaturaAtiva'
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
            <RequireAssinaturaAtiva>
              <VeiculoFormPage />
            </RequireAssinaturaAtiva>
          </ProtectedRoute>
        }
      />
      <Route
        path="/veiculos/:id/editar"
        element={
          <ProtectedRoute>
            <RequireAssinaturaAtiva>
              <VeiculoFormPage />
            </RequireAssinaturaAtiva>
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

The `/assinatura` route itself is added later, in Task 11, once `AssinaturaPage` exists — adding the import now would leave the build broken until then. Run `npm run build` at the end of this task (added as its own step below) and expect it to succeed, since nothing here references a file that doesn't exist yet.

- [ ] **Step 6: Write the failing test for `LinhaVeiculo`'s read-only mode**

Create `src/components/veiculos/LinhaVeiculo.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LinhaVeiculo } from '@/components/veiculos/LinhaVeiculo'
import type { Veiculo } from '@/lib/veiculos'

const veiculoExemplo = {
  id: 'v1',
  marca: 'Toyota',
  modelo: 'Corolla',
  ano_modelo: 2022,
  preco: 120000,
  status: 'disponivel',
} as Veiculo

function renderLinha(temAcessoCompleto: boolean) {
  return render(
    <MemoryRouter>
      <LinhaVeiculo
        veiculo={veiculoExemplo}
        excluindoId={null}
        onExcluir={vi.fn()}
        temAcessoCompleto={temAcessoCompleto}
      />
    </MemoryRouter>
  )
}

describe('LinhaVeiculo', () => {
  it('mostra os links de editar/excluir quando há acesso completo', () => {
    renderLinha(true)
    expect(screen.getByText('Editar')).toBeInTheDocument()
    expect(screen.getByText('Excluir')).not.toBeDisabled()
  })

  it('esconde editar e desabilita excluir em modo leitura', () => {
    renderLinha(false)
    expect(screen.queryByText('Editar')).not.toBeInTheDocument()
    expect(screen.getByText('Excluir')).toBeDisabled()
  })
})
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test -- LinhaVeiculo.test`
Expected: FAIL — `temAcessoCompleto` isn't a recognized prop yet, "Editar" always renders, "Excluir" is never disabled by it.

- [ ] **Step 8: Update `LinhaVeiculo` to respect `temAcessoCompleto`**

Modify `src/components/veiculos/LinhaVeiculo.tsx`:

```tsx
import { Link } from 'react-router-dom'
import type { Veiculo } from '@/lib/veiculos'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface LinhaVeiculoProps {
  veiculo: Veiculo
  excluindoId: string | null
  onExcluir: (id: string) => void
  temAcessoCompleto: boolean
}

export function LinhaVeiculo({ veiculo, excluindoId, onExcluir, temAcessoCompleto }: LinhaVeiculoProps) {
  return (
    <div className="flex flex-1 flex-wrap items-center justify-between gap-2 text-sm">
      <div className="flex flex-1 flex-wrap gap-4">
        <span>{veiculo.marca}</span>
        <span>{veiculo.modelo}</span>
        <span>{veiculo.ano_modelo}</span>
        <span>{veiculo.preco != null ? veiculo.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</span>
        <span>{veiculo.status}</span>
      </div>
      <div className="flex items-center gap-2">
        {temAcessoCompleto && (
          <Link to={`/veiculos/${veiculo.id}/editar`} className="underline">
            Editar
          </Link>
        )}
        <Dialog>
          <DialogTrigger
            render={<Button variant="destructive" size="sm" disabled={!temAcessoCompleto} />}
          >
            Excluir
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir veículo</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir {veiculo.marca} {veiculo.modelo}? Essa ação não pode ser
              desfeita.
            </p>
            <DialogFooter>
              <Button
                variant="destructive"
                disabled={excluindoId === veiculo.id}
                onClick={() => onExcluir(veiculo.id)}
              >
                Confirmar exclusão
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test -- LinhaVeiculo.test`
Expected: PASS, 2 tests.

- [ ] **Step 10: Pass `temAcessoCompleto` from `Veiculos.tsx` and gate "Novo veículo"**

Modify `src/pages/Veiculos.tsx`:

Add the import and hook call:

```tsx
import { useAssinatura } from '@/hooks/useAssinatura'
```

```tsx
export default function VeiculosPage() {
  const { veiculos, carregando, erro, recarregar } = useVeiculos()
  const { temAcessoCompleto } = useAssinatura()
  // ...rest of existing state unchanged
```

Replace the header's "Novo veículo" button:

```tsx
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Veículos</h1>
        {temAcessoCompleto ? (
          <Link to="/veiculos/novo">
            <Button>Novo veículo</Button>
          </Link>
        ) : (
          <Button disabled title="Assinatura necessária para cadastrar veículos">
            Novo veículo
          </Button>
        )}
      </div>
```

And pass the new prop through both places `LinhaVeiculo` is rendered:

```tsx
                renderItem={(veiculo) => (
                  <LinhaVeiculo
                    veiculo={veiculo}
                    excluindoId={excluindoId}
                    onExcluir={excluir}
                    temAcessoCompleto={temAcessoCompleto}
                  />
                )}
```

```tsx
                  <li key={veiculo.id} className="flex items-center gap-2 rounded-md border p-2">
                    <LinhaVeiculo
                      veiculo={veiculo}
                      excluindoId={excluindoId}
                      onExcluir={excluir}
                      temAcessoCompleto={temAcessoCompleto}
                    />
                  </li>
```

- [ ] **Step 11: Mock `useAssinatura` in `Veiculos.test.tsx`**

`src/pages/Veiculos.test.tsx` doesn't mock `@/hooks/useAuth` or `@/hooks/useAssinatura` today — `VeiculosPage` never needed them before this task. Now that it calls `useAssinatura()` (which calls the real `useAuth()` internally), every existing test in this file would hit "useAuth precisa ser usado dentro de um AuthProvider" without a mock. Add this to the top of `src/pages/Veiculos.test.tsx`, next to the existing `vi.mock('@/lib/veiculos', ...)`:

```tsx
vi.mock('@/hooks/useAssinatura', () => ({
  useAssinatura: () => ({
    status: 'active',
    diasRestantesTrial: null,
    temAcessoCompleto: true,
    carregando: false,
    erro: null,
    recarregar: vi.fn(),
  }),
}))
```

This keeps every pre-existing test in the file exercising `VeiculosPage` with full access, matching its behavior before this task.

- [ ] **Step 12: Run the full test suite for this task's files**

Run: `npm test -- RequireAssinaturaAtiva.test LinhaVeiculo.test Veiculos.test`
Expected: PASS.

- [ ] **Step 13: Type-check and build**

Run: `npm run build`
Expected: succeeds — `App.tsx` only references files that already exist at this point in the plan.

- [ ] **Step 14: Commit**

```bash
git add src/components/RequireAssinaturaAtiva.tsx src/components/RequireAssinaturaAtiva.test.tsx src/App.tsx src/pages/Veiculos.tsx src/pages/Veiculos.test.tsx src/components/veiculos/LinhaVeiculo.tsx src/components/veiculos/LinhaVeiculo.test.tsx
git commit -m "feat: bloqueia criar/editar/excluir veiculo sem assinatura ativa"
```

---

## Task 5: Bloqueia "Salvar" em Configurações sem assinatura ativa (TDD)

**Files:**
- Modify: `src/pages/Configuracoes.tsx`
- Modify: `src/pages/Configuracoes.test.tsx` (existing file)

**Interfaces:**
- Consumes: `useAssinatura()` from Task 2.

**`Configuracoes.test.tsx` today** mocks `@/lib/supabase`, `@/lib/loja` (`getLoja`/`updateLoja`), `@/hooks/useAuth` and `@/lib/loja-imagens`; a `lojaExemplo` fixture (updated in Task 2 Step 3 with the new billing fields) is what `getLoja` resolves to; and a `renderPagina()` helper wraps `<ConfiguracoesPage />` in a `<MemoryRouter>`. This task's new test reuses all four exactly as they are.

- [ ] **Step 1: Confirm the current baseline passes**

Run: `npm test -- Configuracoes.test`
Expected: PASS (confirms nothing is broken before this task's changes).

- [ ] **Step 2: Write the failing test for the disabled Save button**

In `src/pages/Configuracoes.test.tsx`, add the new mock next to the existing `vi.mock` calls at the top of the file:

```tsx
vi.mock('@/hooks/useAssinatura', () => ({
  useAssinatura: vi.fn(),
}))
```

Add the import next to the file's other imports:

```tsx
import { useAssinatura } from '@/hooks/useAssinatura'
```

In the existing `beforeEach` (the one that already resets `getLoja`/`updateLoja` and sets the `useAuth` mock), add a default so every pre-existing test in the file keeps seeing full access:

```tsx
  vi.mocked(useAssinatura).mockReturnValue({
    status: 'active',
    diasRestantesTrial: null,
    temAcessoCompleto: true,
    carregando: false,
    erro: null,
    recarregar: vi.fn(),
  })
```

Then add a new test, anywhere after the existing `describe`/`it` blocks in the file:

```tsx
it('desabilita o botão Salvar quando não há acesso completo', async () => {
  vi.mocked(getLoja).mockResolvedValue(lojaExemplo)
  vi.mocked(useAssinatura).mockReturnValue({
    status: 'overdue',
    diasRestantesTrial: null,
    temAcessoCompleto: false,
    carregando: false,
    erro: null,
    recarregar: vi.fn(),
  })

  renderPagina()

  expect(await screen.findByRole('button', { name: /salvar/i })).toBeDisabled()
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- Configuracoes.test`
Expected: FAIL on the new test — the Save button isn't wired to `useAssinatura` yet.

- [ ] **Step 4: Disable the Save button based on `useAssinatura`**

In `src/pages/Configuracoes.tsx`, add the import:

```tsx
import { useAssinatura } from '@/hooks/useAssinatura'
```

Inside `ConfiguracoesPage`, add the hook call next to the existing `useLoja` call:

```tsx
  const { temAcessoCompleto } = useAssinatura()
```

Change the submit button:

```tsx
            <Button type="submit" disabled={salvando || !temAcessoCompleto}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
```

Add a note above it so the lojista understands why it's disabled:

```tsx
            {!temAcessoCompleto && (
              <p className="text-sm text-muted-foreground">
                Sua conta está em modo leitura — assine para poder salvar alterações.
              </p>
            )}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- Configuracoes.test`
Expected: PASS, including every pre-existing test in the file — the `beforeEach` default from Step 2 keeps them exercising the page with full access, same as before this task.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Configuracoes.tsx src/pages/Configuracoes.test.tsx
git commit -m "feat: desabilita salvar configuracoes sem assinatura ativa"
```

---

## Task 6: Bloqueio de acesso na vitrine pública (TDD)

**Files:**
- Modify: `src/lib/vitrine.ts`
- Modify: `src/hooks/useVitrine.ts`
- Modify: `src/pages/Vitrine.tsx`
- Modify: `src/pages/Vitrine.test.tsx` (existing file)

**Interfaces:**
- Produces: `export async function getAcessoCompletoPublico(lojaId: string): Promise<boolean>` in `src/lib/vitrine.ts`, called by `useVitrine` before loading veículos. `useVitrine` now also returns `disponivel: boolean`.

- [ ] **Step 1: Add `getAcessoCompletoPublico` to `src/lib/vitrine.ts`**

Add at the end of `src/lib/vitrine.ts`:

```typescript
export async function getAcessoCompletoPublico(lojaId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('loja_tem_acesso_completo', { p_loja_id: lojaId })
  if (error) throw new Error(error.message)
  return Boolean(data)
}
```

- [ ] **Step 2: Update `useVitrine` to check access before loading veículos**

Modify `src/hooks/useVitrine.ts`:

```typescript
import { useCallback, useEffect, useState } from 'react'
import { getAcessoCompletoPublico, getLojaPublica, listVeiculosPublicos, type LojaPublica } from '@/lib/vitrine'
import type { Veiculo } from '@/lib/veiculos'

interface EstadoVitrine {
  loja: LojaPublica | null
  veiculos: Veiculo[]
  disponivel: boolean
  carregando: boolean
  erro: string | null
}

const ESTADO_INICIAL: EstadoVitrine = { loja: null, veiculos: [], disponivel: true, carregando: true, erro: null }

export function useVitrine(slug: string) {
  const [estado, setEstado] = useState<EstadoVitrine>(ESTADO_INICIAL)

  const carregar = useCallback(() => {
    setEstado({ loja: null, veiculos: [], disponivel: true, carregando: true, erro: null })

    getLojaPublica(slug)
      .then(async (loja) => {
        if (!loja) {
          setEstado({ loja: null, veiculos: [], disponivel: true, carregando: false, erro: null })
          return
        }
        const disponivel = await getAcessoCompletoPublico(loja.id)
        if (!disponivel) {
          setEstado({ loja, veiculos: [], disponivel: false, carregando: false, erro: null })
          return
        }
        const veiculos = await listVeiculosPublicos(loja.id)
        setEstado({ loja, veiculos, disponivel: true, carregando: false, erro: null })
      })
      .catch((e: Error) => setEstado({ loja: null, veiculos: [], disponivel: true, carregando: false, erro: e.message }))
  }, [slug])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { ...estado, recarregar: carregar }
}
```

- [ ] **Step 3: Write the failing test for the unavailable state**

`src/pages/Vitrine.test.tsx` today mocks `@/lib/vitrine` with a plain `vi.mock` object (`getLojaPublica`, `listVeiculosPublicos`, `ehUrlSegura`), resets those two mocks in a top-level `beforeEach`, and exposes a `renderPagina(slug = 'auto-center-silva')` helper that renders `<VitrinePage />` inside a `<MemoryRouter>`/`<Routes>` at `/v/:slug`. This task's new test reuses all three exactly as they are.

Update the import line at the top of the file:

```tsx
import { getLojaPublica, getAcessoCompletoPublico, listVeiculosPublicos } from '@/lib/vitrine'
```

Update the existing `vi.mock('@/lib/vitrine', ...)` call to also mock the new function:

```tsx
vi.mock('@/lib/vitrine', () => ({
  getLojaPublica: vi.fn(),
  getAcessoCompletoPublico: vi.fn(),
  listVeiculosPublicos: vi.fn(),
  ehUrlSegura: (url: string | null | undefined) => Boolean(url) && /^https?:\/\//i.test(url as string),
}))
```

Update the existing `beforeEach` to reset and default the new mock, so every pre-existing test in the file keeps seeing an available vitrine:

```tsx
beforeEach(() => {
  vi.mocked(getLojaPublica).mockReset()
  vi.mocked(getAcessoCompletoPublico).mockReset().mockResolvedValue(true)
  vi.mocked(listVeiculosPublicos).mockReset()
  document.head.innerHTML = ''
})
```

Then add a new test inside the existing `describe('VitrinePage', ...)` block:

```tsx
it('mostra mensagem de indisponibilidade quando a loja está em modo leitura', async () => {
  vi.mocked(getLojaPublica).mockResolvedValue(lojaExemplo as never)
  vi.mocked(getAcessoCompletoPublico).mockResolvedValue(false)

  renderPagina()

  expect(await screen.findByText(/vitrine está indisponível/i)).toBeInTheDocument()
  expect(listVeiculosPublicos).not.toHaveBeenCalled()
})
```

- [ ] **Step 4: Run tests to verify the new test fails**

Run: `npm test -- Vitrine.test`
Expected: FAIL on the new test only — the unavailability message doesn't exist yet. Every pre-existing test in the file should still PASS, since the updated `beforeEach` already defaults `getAcessoCompletoPublico` to `true` for them.

- [ ] **Step 5: Render the unavailable state in `Vitrine.tsx`**

Modify `src/pages/Vitrine.tsx` — update the hook destructuring and add a branch right after the existing `if (!loja)` block:

```tsx
  const { loja, veiculos, disponivel, carregando, erro, recarregar } = useVitrine(slug ?? '')
```

```tsx
  if (!disponivel) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">Esta vitrine está indisponível no momento.</p>
      </div>
    )
  }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- Vitrine.test`
Expected: PASS, all tests including the new one.

- [ ] **Step 7: Commit**

```bash
git add src/lib/vitrine.ts src/hooks/useVitrine.ts src/pages/Vitrine.tsx src/pages/Vitrine.test.tsx
git commit -m "feat: bloqueia vitrine publica quando a loja esta em modo leitura"
```

---

## Task 7: Mapeamento de eventos do webhook Asaas (TDD) + Edge Function `webhook-asaas`

**Files:**
- Create: `src/lib/asaas-webhook.ts`
- Test: `src/lib/asaas-webhook.test.ts`
- Create: `supabase/functions/webhook-asaas/index.ts`

**Interfaces:**
- Produces: `export function mapearEventoAsaas(evento: string): 'active' | 'overdue' | 'canceled' | null`, imported both by the Vitest suite and, via a relative path, by the Deno Edge Function in this same task.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/asaas-webhook.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { mapearEventoAsaas } from './asaas-webhook'

describe('mapearEventoAsaas', () => {
  it.each([
    ['PAYMENT_CONFIRMED', 'active'],
    ['PAYMENT_RECEIVED', 'active'],
    ['PAYMENT_OVERDUE', 'overdue'],
    ['PAYMENT_DELETED', 'canceled'],
    ['PAYMENT_REFUNDED', 'canceled'],
  ] as const)('mapeia %s para %s', (evento, esperado) => {
    expect(mapearEventoAsaas(evento)).toBe(esperado)
  })

  it('retorna null para eventos que não afetam o status da assinatura', () => {
    expect(mapearEventoAsaas('PAYMENT_CREATED')).toBeNull()
    expect(mapearEventoAsaas('PAYMENT_UPDATED')).toBeNull()
    expect(mapearEventoAsaas('algo-desconhecido')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- asaas-webhook.test`
Expected: FAIL — `Cannot find module './asaas-webhook'`.

- [ ] **Step 3: Implement `mapearEventoAsaas`**

Create `src/lib/asaas-webhook.ts`:

```typescript
export type StatusAssinaturaWebhook = 'active' | 'overdue' | 'canceled'

/**
 * Mapeia o campo `event` do payload de webhook do Asaas para o
 * `subscription_status` correspondente em `lojas`. Retorna null para
 * eventos que não afetam a assinatura (ex.: PAYMENT_CREATED) — nesse
 * caso quem chama esta função não deve alterar nada no banco.
 *
 * Zero dependências de runtime (sem imports do Supabase ou do Deno) de
 * propósito: este arquivo é importado tanto pelos testes deste projeto
 * (Vitest/Node) quanto pela Edge Function `webhook-asaas` (Deno), e
 * precisa rodar identicamente nos dois.
 */
export function mapearEventoAsaas(evento: string): StatusAssinaturaWebhook | null {
  switch (evento) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
      return 'active'
    case 'PAYMENT_OVERDUE':
      return 'overdue'
    case 'PAYMENT_DELETED':
    case 'PAYMENT_REFUNDED':
      return 'canceled'
    default:
      return null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- asaas-webhook.test`
Expected: PASS, 6 tests (5 from the `it.each` block, plus 1 for the "retorna null" case, which makes its 3 assertions inside a single `it`).

- [ ] **Step 5: Write the Edge Function**

Create `supabase/functions/webhook-asaas/index.ts`:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0'
import { mapearEventoAsaas } from '../../../src/lib/asaas-webhook.ts'

const ASAAS_WEBHOOK_TOKEN = Deno.env.get('ASAAS_WEBHOOK_TOKEN')!

Deno.serve(async (req) => {
  if (req.headers.get('asaas-access-token') !== ASAAS_WEBHOOK_TOKEN) {
    return new Response('Não autorizado.', { status: 401 })
  }

  const payload = await req.json()
  const novoStatus = mapearEventoAsaas(payload.event)

  if (!novoStatus) {
    return new Response('ok', { status: 200 })
  }

  const asaasSubscriptionId = payload.payment?.subscription
  if (!asaasSubscriptionId) {
    return new Response('ok', { status: 200 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { error } = await supabase
    .from('lojas')
    .update({ subscription_status: novoStatus })
    .eq('asaas_subscription_id', asaasSubscriptionId)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  return new Response('ok', { status: 200 })
})
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically into every Supabase Edge Function's environment — no manual secret needed for those two.

- [ ] **Step 6: Deploy and configure the webhook (manual, one-time)**

```bash
supabase login
supabase link --project-ref <seu-project-ref>
supabase secrets set ASAAS_WEBHOOK_TOKEN=<gere-um-token-aleatorio-forte>
supabase functions deploy webhook-asaas --no-verify-jwt
```

`--no-verify-jwt` is required because Asaas calls this endpoint without a Supabase user session. In the Asaas dashboard (sandbox), register the webhook URL `https://<seu-project-ref>.supabase.co/functions/v1/webhook-asaas` and set the same token from `ASAAS_WEBHOOK_TOKEN` as its access token / custom header value, matching the `asaas-access-token` header this function checks.

This function imports its event-mapping logic from `../../../src/lib/asaas-webhook.ts`, reaching outside `supabase/functions/` entirely — a deliberate choice (Task 7) so the same file is unit-tested by this project's Vitest suite, but it deviates from Supabase's documented `supabase/functions/_shared/` convention for shared code. If `supabase functions deploy webhook-asaas` above fails to resolve that import, the fallback is to inline `mapearEventoAsaas`'s body directly into this function's own `index.ts` (duplicating the ~10 lines rather than importing them) — the deploy command failing loudly here is the actual test of whether this pattern works, so don't skip watching its output.

- [ ] **Step 7: Commit**

```bash
git add src/lib/asaas-webhook.ts src/lib/asaas-webhook.test.ts supabase/functions/webhook-asaas/index.ts
git commit -m "feat: adiciona mapeamento de eventos e a edge function webhook-asaas"
```

---

## Task 8: Edge Function `criar-assinatura`

**Files:**
- Create: `supabase/functions/criar-assinatura/index.ts`

**Interfaces:**
- Produces: an authenticated HTTP endpoint invoked via `supabase.functions.invoke('criar-assinatura')` (wired to the frontend in Task 10), returning `{ linkPagamento: string }` on success or `{ error: string }` with a non-2xx status on failure.

No automated test for this task (per the spec's testing section, only the webhook's pure mapping logic gets unit tests; this function's correctness is checked against the real Asaas sandbox in Task 12) — write the code carefully and verify manually.

- [ ] **Step 1: Write the Edge Function**

Create `supabase/functions/criar-assinatura/index.ts`:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0'

const ASAAS_API_URL = Deno.env.get('ASAAS_API_URL') ?? 'https://api-sandbox.asaas.com/v3'
const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')!
const PRECO_MENSAL_REAIS = 97

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado.' }), { status: 401, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Não autenticado.' }), { status: 401, headers: corsHeaders })
    }

    const { data: loja, error: lojaError } = await supabase
      .from('lojas')
      .select('id, nome_loja, email_contato, asaas_customer_id')
      .eq('user_id', userData.user.id)
      .single()

    if (lojaError || !loja) {
      return new Response(JSON.stringify({ error: 'Loja não encontrada.' }), { status: 404, headers: corsHeaders })
    }

    let asaasCustomerId = loja.asaas_customer_id as string | null

    if (!asaasCustomerId) {
      const clienteResposta = await fetch(`${ASAAS_API_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', access_token: ASAAS_API_KEY },
        body: JSON.stringify({
          name: loja.nome_loja ?? 'Loja ZapCar',
          email: loja.email_contato ?? userData.user.email,
        }),
      })
      const cliente = await clienteResposta.json()
      if (!clienteResposta.ok) {
        return new Response(
          JSON.stringify({ error: cliente.errors?.[0]?.description ?? 'Erro ao criar cliente no Asaas.' }),
          { status: 502, headers: corsHeaders }
        )
      }
      asaasCustomerId = cliente.id
    }

    const assinaturaResposta = await fetch(`${ASAAS_API_URL}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', access_token: ASAAS_API_KEY },
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: 'UNDEFINED',
        cycle: 'MONTHLY',
        value: PRECO_MENSAL_REAIS,
        description: 'Assinatura ZapCar',
      }),
    })
    const assinatura = await assinaturaResposta.json()
    if (!assinaturaResposta.ok) {
      return new Response(
        JSON.stringify({ error: assinatura.errors?.[0]?.description ?? 'Erro ao criar assinatura no Asaas.' }),
        { status: 502, headers: corsHeaders }
      )
    }

    // A assinatura gera a primeira cobrança de forma assíncrona no Asaas —
    // busca essa cobrança pra obter o link de pagamento hospedado (invoiceUrl
    // é um campo da cobrança, não da assinatura).
    const cobrancasResposta = await fetch(
      `${ASAAS_API_URL}/payments?subscription=${assinatura.id}&limit=1`,
      { headers: { access_token: ASAAS_API_KEY } }
    )
    const cobrancas = await cobrancasResposta.json()
    const linkPagamento = cobrancas.data?.[0]?.invoiceUrl

    if (!linkPagamento) {
      return new Response(
        JSON.stringify({
          error: 'Assinatura criada, mas o link de pagamento ainda não está disponível. Tente novamente em instantes.',
        }),
        { status: 502, headers: corsHeaders }
      )
    }

    await supabase
      .from('lojas')
      .update({ asaas_customer_id: asaasCustomerId, asaas_subscription_id: assinatura.id })
      .eq('id', loja.id)

    return new Response(JSON.stringify({ linkPagamento }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders })
  }
})
```

- [ ] **Step 2: Deploy and configure secrets (manual, one-time)**

```bash
supabase secrets set ASAAS_API_KEY=<sua-chave-de-api-do-asaas-sandbox>
supabase functions deploy criar-assinatura
```

(No `--no-verify-jwt` here — this endpoint must only run for a logged-in lojista, so it keeps Supabase's default JWT verification.)

- [ ] **Step 3: Manual smoke test against the Asaas sandbox**

Using `curl` (or the Supabase dashboard's function invoker) with a real user's JWT:

```bash
curl -i -X POST 'https://<seu-project-ref>.supabase.co/functions/v1/criar-assinatura' \
  -H 'Authorization: Bearer <jwt-de-um-usuario-de-teste-logado>'
```

Expected: `200` with `{"linkPagamento": "https://sandbox.asaas.com/i/..."}`, and the corresponding `lojas` row now has `asaas_customer_id`/`asaas_subscription_id` filled in (check via the Supabase table editor).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/criar-assinatura/index.ts
git commit -m "feat: adiciona a edge function criar-assinatura"
```

---

## Task 9: Edge Function `listar-cobrancas-asaas`

**Files:**
- Create: `supabase/functions/listar-cobrancas-asaas/index.ts`

**Interfaces:**
- Produces: an authenticated HTTP endpoint invoked via `supabase.functions.invoke('listar-cobrancas-asaas')` (wired to the frontend in Task 10), returning `{ cobrancas: { id: string; valor: number; status: string; vencimento: string }[] }`.

No automated test for this task either, for the same reason as Task 8 — manual verification in Task 12.

- [ ] **Step 1: Write the Edge Function**

Create `supabase/functions/listar-cobrancas-asaas/index.ts`:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0'

const ASAAS_API_URL = Deno.env.get('ASAAS_API_URL') ?? 'https://api-sandbox.asaas.com/v3'
const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CobrancaAsaas {
  id: string
  value: number
  status: string
  dueDate: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado.' }), { status: 401, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Não autenticado.' }), { status: 401, headers: corsHeaders })
    }

    const { data: loja } = await supabase
      .from('lojas')
      .select('asaas_customer_id')
      .eq('user_id', userData.user.id)
      .single()

    if (!loja?.asaas_customer_id) {
      return new Response(JSON.stringify({ cobrancas: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const cobrancasResposta = await fetch(
      `${ASAAS_API_URL}/payments?customer=${loja.asaas_customer_id}&order=desc`,
      { headers: { access_token: ASAAS_API_KEY } }
    )
    const cobrancas = await cobrancasResposta.json()

    if (!cobrancasResposta.ok) {
      return new Response(JSON.stringify({ error: 'Erro ao consultar cobranças no Asaas.' }), {
        status: 502,
        headers: corsHeaders,
      })
    }

    const resultado = ((cobrancas.data ?? []) as CobrancaAsaas[]).map((c) => ({
      id: c.id,
      valor: c.value,
      status: c.status,
      vencimento: c.dueDate,
    }))

    return new Response(JSON.stringify({ cobrancas: resultado }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders })
  }
})
```

- [ ] **Step 2: Deploy**

```bash
supabase functions deploy listar-cobrancas-asaas
```

(Reuses the `ASAAS_API_KEY` secret already set in Task 8.)

- [ ] **Step 3: Manual smoke test**

```bash
curl -i 'https://<seu-project-ref>.supabase.co/functions/v1/listar-cobrancas-asaas' \
  -H 'Authorization: Bearer <jwt-do-mesmo-usuario-de-teste-do-task-8>'
```

Expected: `200` with `{"cobrancas": [...]}` containing at least the subscription's first charge created in Task 8's smoke test.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/listar-cobrancas-asaas/index.ts
git commit -m "feat: adiciona a edge function listar-cobrancas-asaas"
```

---

## Task 10: `src/lib/asaas.ts` — wrapper de front-end para as Edge Functions (TDD)

**Files:**
- Create: `src/lib/asaas.ts`
- Test: `src/lib/asaas.test.ts`

**Interfaces:**
- Consumes: `supabase.functions.invoke` from `src/lib/supabase.ts`.
- Produces: `export interface Cobranca { id: string; valor: number; status: string; vencimento: string }`, `export async function criarAssinatura(): Promise<string>` (returns the payment link URL), `export async function listarCobrancas(): Promise<Cobranca[]>`. Task 11's `/assinatura` page consumes both.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/asaas.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase'
import { criarAssinatura, listarCobrancas } from '@/lib/asaas'

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}))

beforeEach(() => {
  vi.mocked(supabase.functions.invoke).mockReset()
})

describe('criarAssinatura', () => {
  it('retorna o link de pagamento', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { linkPagamento: 'https://sandbox.asaas.com/i/abc123' },
      error: null,
    } as never)

    const link = await criarAssinatura()

    expect(supabase.functions.invoke).toHaveBeenCalledWith('criar-assinatura')
    expect(link).toBe('https://sandbox.asaas.com/i/abc123')
  })

  it('lança erro quando a invocação falha', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: { message: 'falha de rede' },
    } as never)

    await expect(criarAssinatura()).rejects.toThrow('falha de rede')
  })

  it('lança o erro retornado no corpo quando a função responde sem link', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { error: 'Loja não encontrada.' },
      error: null,
    } as never)

    await expect(criarAssinatura()).rejects.toThrow('Loja não encontrada.')
  })
})

describe('listarCobrancas', () => {
  it('retorna a lista de cobranças', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { cobrancas: [{ id: 'pay_1', valor: 97, status: 'CONFIRMED', vencimento: '2026-10-01' }] },
      error: null,
    } as never)

    const cobrancas = await listarCobrancas()

    expect(supabase.functions.invoke).toHaveBeenCalledWith('listar-cobrancas-asaas')
    expect(cobrancas).toEqual([{ id: 'pay_1', valor: 97, status: 'CONFIRMED', vencimento: '2026-10-01' }])
  })

  it('retorna lista vazia quando não há cobrancas', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { cobrancas: [] }, error: null } as never)

    expect(await listarCobrancas()).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- asaas.test`
Expected: FAIL — `Cannot find module '@/lib/asaas'`.

- [ ] **Step 3: Implement `src/lib/asaas.ts`**

Create `src/lib/asaas.ts`:

```typescript
import { supabase } from '@/lib/supabase'

export interface Cobranca {
  id: string
  valor: number
  status: string
  vencimento: string
}

export async function criarAssinatura(): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ linkPagamento?: string; error?: string }>(
    'criar-assinatura'
  )
  if (error) throw new Error(error.message)
  if (!data?.linkPagamento) throw new Error(data?.error ?? 'Não foi possível gerar o link de pagamento.')
  return data.linkPagamento
}

export async function listarCobrancas(): Promise<Cobranca[]> {
  const { data, error } = await supabase.functions.invoke<{ cobrancas?: Cobranca[]; error?: string }>(
    'listar-cobrancas-asaas'
  )
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data?.cobrancas ?? []
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- asaas.test`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/asaas.ts src/lib/asaas.test.ts
git commit -m "feat: adiciona wrapper de front-end para as edge functions do asaas"
```

---

## Task 11: Página `/assinatura` (TDD)

**Files:**
- Create: `src/pages/Assinatura.tsx`
- Test: `src/pages/Assinatura.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useAssinatura()` (Task 2), `criarAssinatura()`/`listarCobrancas()`/`Cobranca` (Task 10).
- Produces: `export default function AssinaturaPage()`, wired into `App.tsx` at route `/assinatura` in this task (the route `RequireAssinaturaAtiva`, added in Task 4, already redirects there).

- [ ] **Step 1: Write the failing tests**

Create `src/pages/Assinatura.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AssinaturaPage from '@/pages/Assinatura'
import { useAssinatura } from '@/hooks/useAssinatura'
import { criarAssinatura, listarCobrancas } from '@/lib/asaas'

vi.mock('@/hooks/useAssinatura', () => ({
  useAssinatura: vi.fn(),
}))

vi.mock('@/lib/asaas', () => ({
  criarAssinatura: vi.fn(),
  listarCobrancas: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(useAssinatura).mockReset()
  vi.mocked(criarAssinatura).mockReset()
  vi.mocked(listarCobrancas).mockReset().mockResolvedValue([])
  vi.stubGlobal('location', { ...window.location, href: '' })
})

describe('AssinaturaPage', () => {
  it('mostra a contagem de dias restantes durante o trial', async () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: 'trial',
      diasRestantesTrial: 4,
      temAcessoCompleto: true,
      carregando: false,
      erro: null,
      recarregar: vi.fn(),
    })

    render(<AssinaturaPage />)

    expect(await screen.findByText(/4 dias/i)).toBeInTheDocument()
  })

  it('mostra o aviso de modo leitura quando a assinatura venceu', async () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: 'overdue',
      diasRestantesTrial: null,
      temAcessoCompleto: false,
      carregando: false,
      erro: null,
      recarregar: vi.fn(),
    })

    render(<AssinaturaPage />)

    expect(await screen.findByText(/modo leitura/i)).toBeInTheDocument()
  })

  it('mostra "Assinatura ativa" quando o status é active', async () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: 'active',
      diasRestantesTrial: null,
      temAcessoCompleto: true,
      carregando: false,
      erro: null,
      recarregar: vi.fn(),
    })

    render(<AssinaturaPage />)

    expect(await screen.findByText(/assinatura ativa/i)).toBeInTheDocument()
  })

  it('redireciona pro link de pagamento ao clicar em Assinar agora', async () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: 'overdue',
      diasRestantesTrial: null,
      temAcessoCompleto: false,
      carregando: false,
      erro: null,
      recarregar: vi.fn(),
    })
    vi.mocked(criarAssinatura).mockResolvedValue('https://sandbox.asaas.com/i/abc123')

    render(<AssinaturaPage />)
    await userEvent.click(screen.getByRole('button', { name: /assinar agora/i }))

    await waitFor(() => expect(window.location.href).toBe('https://sandbox.asaas.com/i/abc123'))
  })

  it('mostra o histórico de cobranças', async () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: 'active',
      diasRestantesTrial: null,
      temAcessoCompleto: true,
      carregando: false,
      erro: null,
      recarregar: vi.fn(),
    })
    vi.mocked(listarCobrancas).mockResolvedValue([
      { id: 'pay_1', valor: 97, status: 'CONFIRMED', vencimento: '2026-10-01' },
    ])

    render(<AssinaturaPage />)

    expect(await screen.findByText('CONFIRMED')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- Assinatura.test`
Expected: FAIL — `Cannot find module '@/pages/Assinatura'`.

- [ ] **Step 3: Implement `Assinatura.tsx`**

Create `src/pages/Assinatura.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useAssinatura } from '@/hooks/useAssinatura'
import { criarAssinatura, listarCobrancas, type Cobranca } from '@/lib/asaas'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function textoStatus(status: string | null, diasRestantesTrial: number | null): string {
  if (status === 'active') return 'Assinatura ativa.'
  if (status === 'trial' && diasRestantesTrial !== null) {
    return `Você está no trial gratuito — restam ${diasRestantesTrial} ${diasRestantesTrial === 1 ? 'dia' : 'dias'}.`
  }
  return 'Sua conta está em modo leitura. Assine para voltar a criar e editar.'
}

export default function AssinaturaPage() {
  const { status, diasRestantesTrial, temAcessoCompleto, carregando } = useAssinatura()
  const [assinando, setAssinando] = useState(false)
  const [erroAssinar, setErroAssinar] = useState<string | null>(null)
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([])
  const [carregandoCobrancas, setCarregandoCobrancas] = useState(true)

  useEffect(() => {
    listarCobrancas()
      .then(setCobrancas)
      .finally(() => setCarregandoCobrancas(false))
  }, [])

  async function assinar() {
    setErroAssinar(null)
    setAssinando(true)
    try {
      const link = await criarAssinatura()
      window.location.href = link
    } catch (e) {
      setErroAssinar((e as Error).message)
      setAssinando(false)
    }
  }

  if (carregando) {
    return <p className="p-4 text-muted-foreground">Carregando...</p>
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Assinatura</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p>{textoStatus(status, diasRestantesTrial)}</p>

          {erroAssinar && (
            <p role="alert" className="text-sm text-destructive">
              {erroAssinar}
            </p>
          )}

          {!temAcessoCompleto && (
            <Button onClick={assinar} disabled={assinando}>
              {assinando ? 'Gerando link de pagamento...' : 'Assinar agora'}
            </Button>
          )}

          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Histórico de cobranças</h2>
            {carregandoCobrancas && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {!carregandoCobrancas && cobrancas.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma cobrança ainda.</p>
            )}
            {cobrancas.length > 0 && (
              <ul className="flex flex-col gap-2">
                {cobrancas.map((cobranca) => (
                  <li key={cobranca.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <span>{cobranca.vencimento}</span>
                    <span>{cobranca.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    <span>{cobranca.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- Assinatura.test`
Expected: PASS, 5 tests.

- [ ] **Step 5: Wire the `/assinatura` route into `App.tsx`**

Modify `src/App.tsx` — add the import next to the other page imports:

```tsx
import AssinaturaPage from '@/pages/Assinatura'
```

And add the route (anywhere among the other `<ProtectedRoute>`-wrapped routes, e.g. right after `/configuracoes`):

```tsx
      <Route
        path="/assinatura"
        element={
          <ProtectedRoute>
            <AssinaturaPage />
          </ProtectedRoute>
        }
      />
```

- [ ] **Step 6: Type-check and build the whole app**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: all tests pass, across every task in this plan plus every pre-existing test in the project.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Assinatura.tsx src/pages/Assinatura.test.tsx src/App.tsx
git commit -m "feat: adiciona a pagina /assinatura"
```

---

## Task 12: Verificação manual ponta a ponta e checklist final

**Files:** `CLAUDE.md` (roadmap update) — no other code changes expected in this task.

- [ ] **Step 1: Confirmar a SQL da Task 1 já foi aplicada**

No SQL Editor do Supabase, rode a query de verificação da Task 1 Step 5 de novo e confirme as 10 policies restritivas. Confirme também que o trigger de proteção existe:

```sql
select tgname, tgrelid::regclass, tgenabled
from pg_trigger
where tgname = 'bloqueia_edicao_billing';
```

Expected: 1 linha, `tgenabled = 'O'` (habilitado). Se quiser, teste manualmente que uma loja em trial não consegue se autopromover: logado como essa loja (ou via `supabase.auth` de teste), tente `update lojas set subscription_status = 'active' where id = '<id-da-loja-de-teste>'` fora do service_role e confirme que a exceção "Alteração de campos de billing só é permitida pelo back-end" é lançada.

- [ ] **Step 2: Subir o servidor de desenvolvimento**

Run: `npm run dev`

- [ ] **Step 3: Verificar o trial ativo**

Logar com uma loja de teste recém-criada (ou uma já existente, que ganhou trial fresco na Task 1). Checklist:
- O banner no topo do painel mostra "Seu trial acaba em N dias" com um link "Assinar agora".
- `/veiculos/novo`, editar um veículo existente e salvar em `/configuracoes` funcionam normalmente.
- `/assinatura` mostra a contagem de dias e o botão "Assinar agora".

- [ ] **Step 4: Forçar o modo leitura e verificar o bloqueio**

No SQL Editor, force o vencimento do trial dessa loja de teste:

```sql
update public.lojas set trial_ends_at = now() - interval '1 day' where id = '<id-da-loja-de-teste>';
```

Recarregar o painel e checar:
- O banner muda pra "modo leitura".
- O botão "Novo veículo" em `/veiculos` fica desabilitado; a lista de veículos não mostra mais "Editar", e "Excluir" fica desabilitado.
- Acessar `/veiculos/novo` ou `/veiculos/:id/editar` diretamente pela URL redireciona pra `/assinatura`.
- Em `/configuracoes`, o botão "Salvar" fica desabilitado com o aviso de modo leitura.
- Se essa loja tiver `vitrine_publica = true`, acessar `/v/<slug>` mostra "Esta vitrine está indisponível no momento" em vez do catálogo.

- [ ] **Step 5: Fluxo real de pagamento no sandbox do Asaas**

Em `/assinatura`, clicar "Assinar agora", completar o pagamento de teste na página do Asaas (Pix ou cartão de teste do sandbox) e confirmar:
- O webhook chega (visível nos logs da function `webhook-asaas` no dashboard do Supabase).
- `subscription_status` da loja vira `'active'` no banco.
- Ao voltar/recarregar o painel, o banner some, os botões voltam a funcionar, e `/assinatura` mostra "Assinatura ativa." com a cobrança paga no histórico.

- [ ] **Step 6: Restaurar a loja de teste (opcional)**

Se quiser deixar a loja de teste utilizável de novo sem esperar o Asaas real:

```sql
update public.lojas set subscription_status = 'trial', trial_ends_at = now() + interval '7 days' where id = '<id-da-loja-de-teste>';
```

- [ ] **Step 7: Rodar lint**

Run: `npm run lint`
Expected: sem erros novos introduzidos por este sub-projeto.

- [ ] **Step 8: Atualizar `CLAUDE.md`**

Marcar o item 5b como completo no roteiro, corrigindo também o nome do item 5 (que citava "Stripe"):

```markdown
5. ~~Billing (Asaas) + landing page~~ ✅ completo — dividido em dois sub-projetos menores:
   - 5a. ~~Landing page~~ ✅ completo.
   - 5b. ~~Billing (Asaas)~~ ✅ completo.
```

Adicionar, na seção "Estado atual", um parágrafo e as referências de spec/plano seguindo o padrão das entregas anteriores (loja tem trial de 7 dias, modo leitura ao vencer, pagamento via Asaas em `/assinatura`), e mencionar em "Convenções deste projeto" que Edge Functions agora vivem em `supabase/functions/` neste mesmo repositório.

- [ ] **Step 9: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: marca Billing (Asaas), item 5b, como completo"
```

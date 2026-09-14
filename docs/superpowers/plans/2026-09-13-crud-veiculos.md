# CRUD de Veículos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao lojista uma tela de estoque de veículos completa — listar, cadastrar (com busca automática de dados por placa), editar e excluir — com fotos, isolado por loja via RLS existente.

**Architecture:** Camada de dados fina sobre o Supabase JS (`src/lib/veiculos.ts`, `src/lib/veiculo-fotos.ts`) consumida por um hook (`useVeiculos`) e duas páginas novas (`Veiculos.tsx`, `VeiculoForm.tsx`) na área já protegida pela Fundação. Validação com Zod, formulário com React Hook Form. Uma Vercel Serverless Function (`api/consulta-placa.ts`) faz proxy da consulta à API Placas, mantendo o token fora do bundle do front-end.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui (`base-nova`) + React Router 7 + `@supabase/supabase-js` + React Hook Form + Zod + Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-13-crud-veiculos-design.md`

## Global Constraints

- Usar sempre a chave **publishable** do Supabase (`VITE_SUPABASE_PUBLISHABLE_KEY`), nunca a `secret key`.
- O token da API Placas **nunca** pode ser uma variável `VITE_*` (vai pro bundle público) — fica só como variável de ambiente do projeto Vercel, lida apenas dentro de `api/consulta-placa.ts`.
- `loja_id` de um veículo é sempre `session.user.id` — confirmado que `lojas.id = auth.uid()` (relação 1:1 via o trigger `handle_new_user`).
- TDD a partir deste sub-projeto: todo arquivo de lógica (`schema`, `lib`, `api`) tem teste escrito antes da implementação.
- `ano_fabricacao`/`ano_modelo` substituem `ano` (que fica sem uso neste front-end). `user_id` e `ordem` ficam de fora do formulário.
- Toda mensagem de commit termina com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## Task 1: Configurar Vitest + Testing Library

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/lib/smoke.test.ts`
- Modify: `package.json` (scripts + devDependencies)

**Interfaces:**
- Produces: comando `npm test` executando Vitest com ambiente `jsdom` e matchers do `@testing-library/jest-dom` já registrados globalmente — toda task seguinte assume isso funcionando.

- [ ] **Step 1: Instalar as dependências de teste**

```bash
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Criar a config do Vitest**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

- [ ] **Step 3: Criar o setup file**

`src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 4: Escrever um teste-fumaça (smoke test) que falha antes de existir código nenhum**

`src/lib/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('ambiente de testes', () => {
  it('executa um teste simples', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Adicionar os scripts de teste no `package.json`**

Em `"scripts"`, adicionar:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `npm test`
Expected: PASS (1 teste, "executa um teste simples")

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts src/test/setup.ts src/lib/smoke.test.ts package.json package-lock.json
git commit -m "test: configura Vitest + Testing Library

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Schema de validação Zod

**Files:**
- Create: `src/lib/veiculo-schema.ts`
- Create: `src/lib/veiculo-schema.test.ts`

**Interfaces:**
- Produces: `veiculoSchema` (Zod), `type VeiculoFormValues`, e as constantes `COMBUSTIVEL_OPTIONS`, `CAMBIO_OPTIONS`, `CARROCERIA_OPTIONS`, `STATUS_OPTIONS` — usadas pelo formulário (Task 7) e pela normalização da API Placas (Task 13).

- [ ] **Step 1: Escrever os testes de validação (falhando, pois o schema ainda não existe)**

`src/lib/veiculo-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { veiculoSchema } from '@/lib/veiculo-schema'

const dadosValidosMinimos = {
  marca: 'Honda',
  modelo: 'Civic',
  ano_fabricacao: '2023',
  ano_modelo: '2024',
  preco: '95000',
}

describe('veiculoSchema', () => {
  it('aceita os campos mínimos obrigatórios', () => {
    const resultado = veiculoSchema.safeParse(dadosValidosMinimos)
    expect(resultado.success).toBe(true)
  })

  it('rejeita quando falta a marca', () => {
    const resultado = veiculoSchema.safeParse({ ...dadosValidosMinimos, marca: '' })
    expect(resultado.success).toBe(false)
  })

  it('rejeita preço zero ou negativo', () => {
    const resultado = veiculoSchema.safeParse({ ...dadosValidosMinimos, preco: '0' })
    expect(resultado.success).toBe(false)
  })

  it('trata km vazio como não informado, sem erro', () => {
    const resultado = veiculoSchema.safeParse({ ...dadosValidosMinimos, km: '' })
    expect(resultado.success).toBe(true)
    if (resultado.success) {
      expect(resultado.data.km).toBeUndefined()
    }
  })

  it('rejeita preço promocional maior ou igual ao preço normal', () => {
    const resultado = veiculoSchema.safeParse({
      ...dadosValidosMinimos,
      preco: '90000',
      preco_promocional: '90000',
    })
    expect(resultado.success).toBe(false)
  })

  it('aceita preço promocional menor que o preço normal', () => {
    const resultado = veiculoSchema.safeParse({
      ...dadosValidosMinimos,
      preco: '90000',
      preco_promocional: '85000',
    })
    expect(resultado.success).toBe(true)
  })

  it('normaliza a placa para maiúsculas e valida o formato', () => {
    const resultado = veiculoSchema.safeParse({ ...dadosValidosMinimos, placa: 'abc1d23' })
    expect(resultado.success).toBe(true)
    if (resultado.success) {
      expect(resultado.data.placa).toBe('ABC1D23')
    }
  })

  it('rejeita placa em formato inválido', () => {
    const resultado = veiculoSchema.safeParse({ ...dadosValidosMinimos, placa: '12345' })
    expect(resultado.success).toBe(false)
  })

  it('aplica os defaults de aceita_troca, destaque, opcionais e status', () => {
    const resultado = veiculoSchema.safeParse(dadosValidosMinimos)
    expect(resultado.success).toBe(true)
    if (resultado.success) {
      expect(resultado.data.aceita_troca).toBe(false)
      expect(resultado.data.destaque).toBe(false)
      expect(resultado.data.opcionais).toEqual([])
      expect(resultado.data.status).toBe('disponivel')
    }
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha (o módulo não existe ainda)**

Run: `npm test -- veiculo-schema`
Expected: FAIL com erro de módulo `@/lib/veiculo-schema` não encontrado

- [ ] **Step 3: Implementar o schema**

`src/lib/veiculo-schema.ts`:

```ts
import { z } from 'zod'

export const COMBUSTIVEL_OPTIONS = [
  'Gasolina',
  'Etanol',
  'Flex',
  'Diesel',
  'Híbrido',
  'Elétrico',
] as const

export const CAMBIO_OPTIONS = ['Manual', 'Automático', 'CVT'] as const

export const CARROCERIA_OPTIONS = [
  'Sedã',
  'Hatch',
  'SUV',
  'Picape',
  'Perua/SW',
  'Minivan',
  'Conversível',
] as const

export const STATUS_OPTIONS = ['disponivel', 'reservado', 'vendido', 'inativo'] as const

const PLACA_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/

const paraIndefinidoSeVazio = (valor: unknown) =>
  valor === '' || valor === null || valor === undefined ? undefined : valor

const numeroOpcional = (schema: z.ZodNumber) =>
  z.preprocess(paraIndefinidoSeVazio, schema.optional())

const textoOpcional = () => z.preprocess(paraIndefinidoSeVazio, z.string().trim().optional())

export const veiculoSchema = z
  .object({
    marca: z.coerce.string().trim().min(1, 'Informe a marca.'),
    modelo: z.coerce.string().trim().min(1, 'Informe o modelo.'),
    versao: textoOpcional(),
    ano_fabricacao: z.coerce
      .number({ invalid_type_error: 'Informe um ano válido.' })
      .int()
      .min(1950, 'Ano de fabricação inválido.')
      .max(new Date().getFullYear() + 1, 'Ano de fabricação inválido.'),
    ano_modelo: z.coerce
      .number({ invalid_type_error: 'Informe um ano válido.' })
      .int()
      .min(1950, 'Ano do modelo inválido.')
      .max(new Date().getFullYear() + 2, 'Ano do modelo inválido.'),
    cor: textoOpcional(),
    km: numeroOpcional(
      z.number({ invalid_type_error: 'Informe uma quilometragem válida.' }).int().min(0, 'Quilometragem não pode ser negativa.')
    ),
    combustivel: z.preprocess(paraIndefinidoSeVazio, z.enum(COMBUSTIVEL_OPTIONS).optional()),
    cambio: z.preprocess(paraIndefinidoSeVazio, z.enum(CAMBIO_OPTIONS).optional()),
    carroceria: z.preprocess(paraIndefinidoSeVazio, z.enum(CARROCERIA_OPTIONS).optional()),
    portas: numeroOpcional(z.number().int().min(1, 'Número de portas inválido.').max(6, 'Número de portas inválido.')),
    placa: z.preprocess(
      (valor) => {
        const semVazio = paraIndefinidoSeVazio(valor)
        return semVazio === undefined ? undefined : String(semVazio).trim().toUpperCase()
      },
      z.string().regex(PLACA_REGEX, 'Placa inválida. Use o formato AAA0X00 ou AAA9999.').optional()
    ),
    preco: z.coerce
      .number({ invalid_type_error: 'Informe um preço válido.' })
      .positive('O preço deve ser maior que zero.'),
    preco_promocional: numeroOpcional(
      z.number({ invalid_type_error: 'Informe um preço válido.' }).positive('O preço promocional deve ser maior que zero.')
    ),
    aceita_troca: z.coerce.boolean().default(false),
    destaque: z.coerce.boolean().default(false),
    descricao: textoOpcional(),
    opcionais: z.array(z.string().trim().min(1)).default([]),
    status: z.enum(STATUS_OPTIONS).default('disponivel'),
  })
  .refine((dados) => dados.preco_promocional === undefined || dados.preco_promocional < dados.preco, {
    message: 'O preço promocional deve ser menor que o preço normal.',
    path: ['preco_promocional'],
  })

export type VeiculoFormValues = z.infer<typeof veiculoSchema>
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- veiculo-schema`
Expected: PASS (9 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/veiculo-schema.ts src/lib/veiculo-schema.test.ts
git commit -m "feat: schema de validação do veículo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Funções auxiliares de título e placa final

**Files:**
- Create: `src/lib/veiculo-helpers.ts`
- Create: `src/lib/veiculo-helpers.test.ts`

**Interfaces:**
- Produces: `gerarTitulo(marca: string, modelo: string, anoModelo: number): string`, `derivarPlacaFinal(placa: string | null | undefined): string | null` — usadas pela camada de dados (Task 4) ao montar o payload de gravação.

- [ ] **Step 1: Escrever os testes**

`src/lib/veiculo-helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { gerarTitulo, derivarPlacaFinal } from '@/lib/veiculo-helpers'

describe('gerarTitulo', () => {
  it('combina marca, modelo e ano do modelo', () => {
    expect(gerarTitulo('Honda', 'Civic', 2024)).toBe('Honda Civic 2024')
  })
})

describe('derivarPlacaFinal', () => {
  it('retorna os últimos 4 caracteres da placa', () => {
    expect(derivarPlacaFinal('ABC1D23')).toBe('1D23')
  })

  it('retorna null quando não há placa', () => {
    expect(derivarPlacaFinal(null)).toBeNull()
    expect(derivarPlacaFinal(undefined)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- veiculo-helpers`
Expected: FAIL com erro de módulo não encontrado

- [ ] **Step 3: Implementar**

`src/lib/veiculo-helpers.ts`:

```ts
export function gerarTitulo(marca: string, modelo: string, anoModelo: number): string {
  return `${marca} ${modelo} ${anoModelo}`
}

export function derivarPlacaFinal(placa: string | null | undefined): string | null {
  if (!placa) return null
  return placa.slice(-4)
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- veiculo-helpers`
Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/veiculo-helpers.ts src/lib/veiculo-helpers.test.ts
git commit -m "feat: helpers de título e placa final do veículo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Camada de dados — CRUD básico (`veiculos.ts`)

**Files:**
- Create: `src/lib/veiculos.ts`
- Create: `src/lib/veiculos.test.ts`

**Interfaces:**
- Consumes: nenhuma (usa `supabase` de `@/lib/supabase`, mockado no teste).
- Produces: `interface Veiculo`, `type VeiculoPayload`, `listVeiculos(): Promise<Veiculo[]>`, `getVeiculo(id: string): Promise<Veiculo | null>`, `createVeiculo(id: string, payload: VeiculoPayload): Promise<Veiculo>`, `updateVeiculo(id: string, payload: VeiculoPayload): Promise<Veiculo>`, `deleteVeiculo(id: string): Promise<void>` — usadas pelo hook (Task 5) e pelas páginas (Tasks 6, 9, 10).

- [ ] **Step 1: Escrever os testes com o client do Supabase mockado**

`src/lib/veiculos.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase'
import { listVeiculos, getVeiculo, createVeiculo, updateVeiculo, deleteVeiculo, type VeiculoPayload } from '@/lib/veiculos'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

const payloadExemplo: VeiculoPayload = {
  loja_id: 'loja-1',
  marca: 'Honda',
  modelo: 'Civic',
  versao: null,
  ano_fabricacao: 2023,
  ano_modelo: 2024,
  cor: null,
  km: null,
  combustivel: null,
  cambio: null,
  carroceria: null,
  portas: null,
  placa: null,
  placa_final: null,
  preco: 95000,
  preco_promocional: null,
  aceita_troca: false,
  destaque: false,
  descricao: null,
  opcionais: [],
  status: 'disponivel',
  fotos: [],
  foto_capa: null,
  titulo: 'Honda Civic 2024',
}

beforeEach(() => {
  vi.mocked(supabase.from).mockReset()
})

describe('listVeiculos', () => {
  it('retorna os veículos ordenados por criação', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [{ id: '1', ...payloadExemplo }], error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const resultado = await listVeiculos()

    expect(supabase.from).toHaveBeenCalledWith('veiculos')
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(resultado).toHaveLength(1)
  })

  it('lança erro quando o Supabase retorna erro', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'falha de rede' } }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await expect(listVeiculos()).rejects.toThrow('falha de rede')
  })
})

describe('getVeiculo', () => {
  it('retorna o veículo pelo id', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: '1', ...payloadExemplo }, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const resultado = await getVeiculo('1')

    expect(builder.eq).toHaveBeenCalledWith('id', '1')
    expect(resultado?.id).toBe('1')
  })

  it('retorna null quando não encontra', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    expect(await getVeiculo('inexistente')).toBeNull()
  })
})

describe('createVeiculo', () => {
  it('insere o veículo com o id informado', async () => {
    const builder = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'novo-id', ...payloadExemplo }, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const resultado = await createVeiculo('novo-id', payloadExemplo)

    expect(builder.insert).toHaveBeenCalledWith({ id: 'novo-id', ...payloadExemplo })
    expect(resultado.id).toBe('novo-id')
  })
})

describe('updateVeiculo', () => {
  it('atualiza o veículo pelo id', async () => {
    const builder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: '1', ...payloadExemplo }, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await updateVeiculo('1', payloadExemplo)

    expect(builder.update).toHaveBeenCalledWith(payloadExemplo)
    expect(builder.eq).toHaveBeenCalledWith('id', '1')
  })
})

describe('deleteVeiculo', () => {
  it('remove o veículo pelo id', async () => {
    const builder = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await deleteVeiculo('1')

    expect(builder.eq).toHaveBeenCalledWith('id', '1')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- veiculos.test`
Expected: FAIL com erro de módulo `@/lib/veiculos` não encontrado

- [ ] **Step 3: Implementar**

`src/lib/veiculos.ts`:

```ts
import { supabase } from '@/lib/supabase'

export interface Veiculo {
  id: string
  loja_id: string
  marca: string
  modelo: string
  versao: string | null
  ano_fabricacao: number
  ano_modelo: number
  cor: string | null
  km: number | null
  combustivel: string | null
  cambio: string | null
  carroceria: string | null
  portas: number | null
  placa: string | null
  placa_final: string | null
  preco: number
  preco_promocional: number | null
  aceita_troca: boolean
  destaque: boolean
  descricao: string | null
  opcionais: string[]
  status: string
  fotos: string[]
  foto_capa: string | null
  titulo: string
  ordem: number
  created_at: string
  updated_at: string
}

export type VeiculoPayload = Omit<Veiculo, 'id' | 'ordem' | 'created_at' | 'updated_at'>

export async function listVeiculos(): Promise<Veiculo[]> {
  const { data, error } = await supabase
    .from('veiculos')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Veiculo[]
}

export async function getVeiculo(id: string): Promise<Veiculo | null> {
  const { data, error } = await supabase.from('veiculos').select('*').eq('id', id).maybeSingle()

  if (error) throw new Error(error.message)
  return (data as Veiculo | null) ?? null
}

export async function createVeiculo(id: string, payload: VeiculoPayload): Promise<Veiculo> {
  const { data, error } = await supabase
    .from('veiculos')
    .insert({ id, ...payload })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Veiculo
}

export async function updateVeiculo(id: string, payload: VeiculoPayload): Promise<Veiculo> {
  const { data, error } = await supabase
    .from('veiculos')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Veiculo
}

export async function deleteVeiculo(id: string): Promise<void> {
  const { error } = await supabase.from('veiculos').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
```

Note a `select('*').order(...)` do `builder.select` no teste é chamado com `'*'` — confira que a implementação passa exatamente essa string.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- veiculos.test`
Expected: PASS (7 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/veiculos.ts src/lib/veiculos.test.ts
git commit -m "feat: camada de dados do CRUD de veículos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Hook `useVeiculos` + página de listagem

**Files:**
- Create: `src/hooks/useVeiculos.ts`
- Create: `src/pages/Veiculos.tsx`
- Create: `src/pages/Veiculos.test.tsx`
- Modify: `src/App.tsx` (rota `/veiculos`)
- Modify: `src/pages/Dashboard.tsx` (link para `/veiculos`)

**Interfaces:**
- Consumes: `listVeiculos` (Task 4).
- Produces: hook `useVeiculos()` retornando `{ veiculos: Veiculo[]; carregando: boolean; erro: string | null; recarregar: () => void }` — consumido também pela Task 9/10 (para atualizar a lista após editar/excluir, via `recarregar`).

- [ ] **Step 1: Escrever o teste da página (falhando)**

`src/pages/Veiculos.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import VeiculosPage from '@/pages/Veiculos'
import { listVeiculos } from '@/lib/veiculos'

vi.mock('@/lib/veiculos', () => ({
  listVeiculos: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(listVeiculos).mockReset()
})

function renderPagina() {
  return render(
    <MemoryRouter>
      <VeiculosPage />
    </MemoryRouter>
  )
}

describe('VeiculosPage', () => {
  it('mostra estado de carregamento e depois a lista', async () => {
    vi.mocked(listVeiculos).mockResolvedValue([
      {
        id: '1',
        marca: 'Honda',
        modelo: 'Civic',
        ano_modelo: 2024,
        preco: 95000,
        status: 'disponivel',
      } as never,
    ])

    renderPagina()

    expect(screen.getByText(/carregando/i)).toBeInTheDocument()
    expect(await screen.findByText('Honda')).toBeInTheDocument()
    expect(screen.getByText('Civic')).toBeInTheDocument()
  })

  it('mostra mensagem de vazio quando não há veículos', async () => {
    vi.mocked(listVeiculos).mockResolvedValue([])

    renderPagina()

    expect(await screen.findByText(/nenhum veículo cadastrado/i)).toBeInTheDocument()
  })

  it('mostra erro com botão de tentar novamente', async () => {
    vi.mocked(listVeiculos).mockRejectedValue(new Error('falha de rede'))

    renderPagina()

    expect(await screen.findByText('falha de rede')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- Veiculos.test`
Expected: FAIL (módulo `@/pages/Veiculos` não existe)

- [ ] **Step 3: Implementar o hook**

`src/hooks/useVeiculos.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { listVeiculos, type Veiculo } from '@/lib/veiculos'

export function useVeiculos() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(() => {
    setCarregando(true)
    setErro(null)
    listVeiculos()
      .then(setVeiculos)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { veiculos, carregando, erro, recarregar: carregar }
}
```

- [ ] **Step 4: Implementar a página**

`src/pages/Veiculos.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { useVeiculos } from '@/hooks/useVeiculos'
import { Button } from '@/components/ui/button'

export default function VeiculosPage() {
  const { veiculos, carregando, erro, recarregar } = useVeiculos()

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Veículos</h1>
        <Button asChild>
          <Link to="/veiculos/novo">Novo veículo</Link>
        </Button>
      </div>

      {carregando && <p className="text-muted-foreground">Carregando...</p>}

      {!carregando && erro && (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
          <Button variant="outline" onClick={recarregar}>
            Tentar novamente
          </Button>
        </div>
      )}

      {!carregando && !erro && veiculos.length === 0 && (
        <p className="text-muted-foreground">Nenhum veículo cadastrado ainda.</p>
      )}

      {!carregando && !erro && veiculos.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2">Marca</th>
              <th className="py-2">Modelo</th>
              <th className="py-2">Ano</th>
              <th className="py-2">Preço</th>
              <th className="py-2">Status</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {veiculos.map((veiculo) => (
              <tr key={veiculo.id} className="border-b">
                <td className="py-2">{veiculo.marca}</td>
                <td className="py-2">{veiculo.modelo}</td>
                <td className="py-2">{veiculo.ano_modelo}</td>
                <td className="py-2">
                  {veiculo.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="py-2">{veiculo.status}</td>
                <td className="py-2 text-right">
                  <Link to={`/veiculos/${veiculo.id}/editar`} className="text-sm underline">
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Registrar a rota e o link no Dashboard**

Em `src/App.tsx`, importar `VeiculosPage` e adicionar a rota dentro da área protegida:

```tsx
import VeiculosPage from '@/pages/Veiculos'
```

```tsx
      <Route
        path="/veiculos"
        element={
          <ProtectedRoute>
            <VeiculosPage />
          </ProtectedRoute>
        }
      />
```

Em `src/pages/Dashboard.tsx`, adicionar um link (usando `Link` de `react-router-dom`) entre o `<p>` de "Logado como..." e o botão de sair:

```tsx
import { Link } from 'react-router-dom'
```

```tsx
      <Link to="/veiculos" className="underline">
        Ver veículos
      </Link>
```

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `npm test -- Veiculos.test`
Expected: PASS (3 testes)

- [ ] **Step 7: Verificação manual**

Run: `npm run dev`, acessar `/`, clicar em "Ver veículos", confirmar que `/veiculos` carrega e mostra "Nenhum veículo cadastrado ainda." (banco ainda vazio pra essa loja).

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useVeiculos.ts src/pages/Veiculos.tsx src/pages/Veiculos.test.tsx src/App.tsx src/pages/Dashboard.tsx
git commit -m "feat: página de listagem de veículos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Formulário de cadastro — campos essenciais, fim a fim

**Files:**
- Create: `src/pages/VeiculoForm.tsx`
- Create: `src/pages/VeiculoForm.test.tsx`
- Modify: `src/App.tsx` (rota `/veiculos/novo`)
- Modify: `package.json` (dependências)

**Interfaces:**
- Consumes: `veiculoSchema`/`VeiculoFormValues` (Task 2), `gerarTitulo`/`derivarPlacaFinal` (Task 3), `createVeiculo`/`VeiculoPayload` (Task 4), `useAuth` (já existente).
- Produces: componente `VeiculoFormPage` — será estendido nas Tasks 7, 9, 11, 12, 14 (mesmo arquivo, sem trocar de nome/export).

Este task entrega só os campos **obrigatórios** (`marca`, `modelo`, `ano_fabricacao`, `ano_modelo`, `preco`) — o suficiente pra um cadastro completo, ponta a ponta, aparecer na listagem. Os demais campos entram na Task 7.

- [ ] **Step 1: Instalar as bibliotecas de formulário**

```bash
npm install react-hook-form zod @hookform/resolvers
npx shadcn@latest add form input label
```

(O `input` e `label` já existem; o CLI do shadcn avisa e não sobrescreve sem confirmação — responda "não" se perguntado, o objetivo aqui é só adicionar o componente `form`.)

- [ ] **Step 2: Escrever o teste do fluxo de criação (falhando)**

`src/pages/VeiculoForm.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import VeiculoFormPage from '@/pages/VeiculoForm'
import { createVeiculo } from '@/lib/veiculos'
import { useAuth } from '@/hooks/useAuth'

vi.mock('@/lib/veiculos', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/veiculos')>()),
  createVeiculo: vi.fn(),
  getVeiculo: vi.fn(),
  updateVeiculo: vi.fn(),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}))

beforeEach(() => {
  vi.mocked(createVeiculo).mockReset()
  navigateMock.mockReset()
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'loja-1' },
    session: {} as never,
    loading: false,
    signOut: vi.fn(),
  })
})

function renderFormulario() {
  return render(
    <MemoryRouter initialEntries={['/veiculos/novo']}>
      <Routes>
        <Route path="/veiculos/novo" element={<VeiculoFormPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('VeiculoFormPage — cadastro', () => {
  it('cria um veículo com os campos essenciais e redireciona para a listagem', async () => {
    vi.mocked(createVeiculo).mockResolvedValue({ id: 'novo-id' } as never)
    const usuario = userEvent.setup()

    renderFormulario()

    await usuario.type(screen.getByLabelText(/marca/i), 'Honda')
    await usuario.type(screen.getByLabelText(/modelo/i), 'Civic')
    await usuario.type(screen.getByLabelText(/ano de fabricação/i), '2023')
    await usuario.type(screen.getByLabelText(/ano do modelo/i), '2024')
    await usuario.type(screen.getByLabelText(/^preço/i), '95000')
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/salvando/i)).toBeInTheDocument()
    expect(createVeiculo).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        loja_id: 'loja-1',
        marca: 'Honda',
        modelo: 'Civic',
        ano_fabricacao: 2023,
        ano_modelo: 2024,
        preco: 95000,
        titulo: 'Honda Civic 2024',
      })
    )
  })

  it('mostra erro de validação quando falta a marca', async () => {
    const usuario = userEvent.setup()
    renderFormulario()

    await usuario.type(screen.getByLabelText(/modelo/i), 'Civic')
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/informe a marca/i)).toBeInTheDocument()
    expect(createVeiculo).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -- VeiculoForm.test`
Expected: FAIL (módulo `@/pages/VeiculoForm` não existe)

- [ ] **Step 4: Implementar o formulário (campos essenciais)**

`src/pages/VeiculoForm.tsx`:

```tsx
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { veiculoSchema, type VeiculoFormValues } from '@/lib/veiculo-schema'
import { gerarTitulo, derivarPlacaFinal } from '@/lib/veiculo-helpers'
import { createVeiculo, type VeiculoPayload } from '@/lib/veiculos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const valoresIniciais: VeiculoFormValues = {
  marca: '',
  modelo: '',
  versao: undefined,
  ano_fabricacao: new Date().getFullYear(),
  ano_modelo: new Date().getFullYear(),
  cor: undefined,
  km: undefined,
  combustivel: undefined,
  cambio: undefined,
  carroceria: undefined,
  portas: undefined,
  placa: undefined,
  preco: 0,
  preco_promocional: undefined,
  aceita_troca: false,
  destaque: false,
  descricao: undefined,
  opcionais: [],
  status: 'disponivel',
}

export default function VeiculoFormPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [veiculoId] = useState(() => id ?? crypto.randomUUID())

  const form = useForm<VeiculoFormValues>({
    resolver: zodResolver(veiculoSchema),
    defaultValues: valoresIniciais,
  })

  if (!user) {
    return <p className="text-muted-foreground">Carregando...</p>
  }

  async function onSubmit(valores: VeiculoFormValues) {
    setErroSalvar(null)
    setSalvando(true)

    const payload: VeiculoPayload = {
      loja_id: user!.id,
      marca: valores.marca,
      modelo: valores.modelo,
      versao: valores.versao ?? null,
      ano_fabricacao: valores.ano_fabricacao,
      ano_modelo: valores.ano_modelo,
      cor: valores.cor ?? null,
      km: valores.km ?? null,
      combustivel: valores.combustivel ?? null,
      cambio: valores.cambio ?? null,
      carroceria: valores.carroceria ?? null,
      portas: valores.portas ?? null,
      placa: valores.placa ?? null,
      placa_final: derivarPlacaFinal(valores.placa),
      preco: valores.preco,
      preco_promocional: valores.preco_promocional ?? null,
      aceita_troca: valores.aceita_troca,
      destaque: valores.destaque,
      descricao: valores.descricao ?? null,
      opcionais: valores.opcionais,
      status: valores.status,
      fotos: [],
      foto_capa: null,
      titulo: gerarTitulo(valores.marca, valores.modelo, valores.ano_modelo),
    }

    try {
      await createVeiculo(veiculoId, payload)
      navigate('/veiculos')
    } catch (e) {
      setErroSalvar((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Novo veículo</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="marca">Marca</Label>
              <Input id="marca" {...form.register('marca')} />
              {form.formState.errors.marca && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.marca.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="modelo">Modelo</Label>
              <Input id="modelo" {...form.register('modelo')} />
              {form.formState.errors.modelo && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.modelo.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ano_fabricacao">Ano de fabricação</Label>
              <Input id="ano_fabricacao" type="number" {...form.register('ano_fabricacao')} />
              {form.formState.errors.ano_fabricacao && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.ano_fabricacao.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ano_modelo">Ano do modelo</Label>
              <Input id="ano_modelo" type="number" {...form.register('ano_modelo')} />
              {form.formState.errors.ano_modelo && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.ano_modelo.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="preco">Preço</Label>
              <Input id="preco" type="number" step="0.01" {...form.register('preco')} />
              {form.formState.errors.preco && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.preco.message}
                </p>
              )}
            </div>

            {erroSalvar && (
              <p role="alert" className="text-sm text-destructive">
                {erroSalvar}
              </p>
            )}

            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Registrar a rota**

Em `src/App.tsx`:

```tsx
import VeiculoFormPage from '@/pages/VeiculoForm'
```

```tsx
      <Route
        path="/veiculos/novo"
        element={
          <ProtectedRoute>
            <VeiculoFormPage />
          </ProtectedRoute>
        }
      />
```

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `npm test -- VeiculoForm.test`
Expected: PASS (2 testes)

- [ ] **Step 7: Verificação manual**

Run: `npm run dev`, acessar `/veiculos/novo`, preencher marca/modelo/anos/preço, salvar, confirmar redirecionamento pra `/veiculos` e que o veículo aparece na tabela. Conferir também no Supabase (Table Editor) que a linha foi criada com `loja_id` = o `id` do usuário logado e `titulo` preenchido.

- [ ] **Step 8: Commit**

```bash
git add src/pages/VeiculoForm.tsx src/pages/VeiculoForm.test.tsx src/App.tsx package.json package-lock.json src/components/ui/form.tsx
git commit -m "feat: cadastro de veículo com campos essenciais

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Expandir o formulário — demais campos

**Files:**
- Modify: `src/pages/VeiculoForm.tsx`
- Modify: `src/pages/VeiculoForm.test.tsx`
- Create: `src/components/veiculos/OpcionaisField.tsx`
- Create: `src/components/veiculos/OpcionaisField.test.tsx`

**Interfaces:**
- Consumes: `COMBUSTIVEL_OPTIONS`, `CAMBIO_OPTIONS`, `CARROCERIA_OPTIONS`, `STATUS_OPTIONS` (Task 2).
- Produces: `OpcionaisField` — `{ value: string[]; onChange: (valores: string[]) => void }`, reaproveitável.

- [ ] **Step 1: Instalar os componentes shadcn que faltam**

```bash
npx shadcn@latest add select textarea switch badge
```

- [ ] **Step 2: Escrever o teste do `OpcionaisField` (falhando)**

`src/components/veiculos/OpcionaisField.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OpcionaisField } from '@/components/veiculos/OpcionaisField'

describe('OpcionaisField', () => {
  it('adiciona um item ao digitar e pressionar Enter', async () => {
    const onChange = vi.fn()
    const usuario = userEvent.setup()

    render(<OpcionaisField value={[]} onChange={onChange} />)

    await usuario.type(screen.getByLabelText(/adicionar opcional/i), 'Ar condicionado{Enter}')

    expect(onChange).toHaveBeenCalledWith(['Ar condicionado'])
  })

  it('remove um item existente', async () => {
    const onChange = vi.fn()
    const usuario = userEvent.setup()

    render(<OpcionaisField value={['Ar condicionado', 'Vidro elétrico']} onChange={onChange} />)

    await usuario.click(screen.getByRole('button', { name: /remover ar condicionado/i }))

    expect(onChange).toHaveBeenCalledWith(['Vidro elétrico'])
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -- OpcionaisField`
Expected: FAIL (módulo não existe)

- [ ] **Step 4: Implementar `OpcionaisField`**

`src/components/veiculos/OpcionaisField.tsx`:

```tsx
import { useState, type KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface OpcionaisFieldProps {
  value: string[]
  onChange: (valores: string[]) => void
}

export function OpcionaisField({ value, onChange }: OpcionaisFieldProps) {
  const [texto, setTexto] = useState('')

  function adicionar() {
    const item = texto.trim()
    if (!item) return
    onChange([...value, item])
    setTexto('')
  }

  function remover(item: string) {
    onChange(value.filter((v) => v !== item))
  }

  function aoPressionarTecla(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Enter') {
      evento.preventDefault()
      adicionar()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="opcional-novo" className="text-sm font-medium">
        Adicionar opcional
      </label>
      <Input
        id="opcional-novo"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={aoPressionarTecla}
        placeholder="Ex: Ar condicionado"
      />
      <div className="flex flex-wrap gap-2">
        {value.map((item) => (
          <Badge key={item} variant="secondary" className="gap-1">
            {item}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Remover ${item}`}
              onClick={() => remover(item)}
            >
              ×
            </Button>
          </Badge>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm test -- OpcionaisField`
Expected: PASS (2 testes)

- [ ] **Step 6: Adicionar os testes dos demais campos no formulário**

Em `src/pages/VeiculoForm.test.tsx`, adicionar este novo teste dentro do mesmo `describe('VeiculoFormPage — cadastro', ...)` já existente:

```tsx
  it('envia os campos de seleção e o switch de aceita troca', async () => {
    vi.mocked(createVeiculo).mockResolvedValue({ id: 'novo-id' } as never)
    const usuario = userEvent.setup()

    renderFormulario()

    await usuario.type(screen.getByLabelText(/marca/i), 'Honda')
    await usuario.type(screen.getByLabelText(/modelo/i), 'Civic')
    await usuario.type(screen.getByLabelText(/ano de fabricação/i), '2023')
    await usuario.type(screen.getByLabelText(/ano do modelo/i), '2024')
    await usuario.type(screen.getByLabelText(/^preço/i), '95000')
    await usuario.click(screen.getByLabelText(/aceita troca/i))
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/salvando/i)).toBeInTheDocument()
    expect(createVeiculo).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ aceita_troca: true })
    )
  })
```

- [ ] **Step 7: Rodar e confirmar que falha (o campo `aceita troca` ainda não existe)**

Run: `npm test -- VeiculoForm.test`
Expected: FAIL (elemento com label "aceita troca" não encontrado)

- [ ] **Step 8: Expandir o formulário com os campos restantes**

Em `src/pages/VeiculoForm.tsx`, adicionar os imports:

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { OpcionaisField } from '@/components/veiculos/OpcionaisField'
import {
  COMBUSTIVEL_OPTIONS,
  CAMBIO_OPTIONS,
  CARROCERIA_OPTIONS,
  STATUS_OPTIONS,
} from '@/lib/veiculo-schema'
```

E inserir os campos abaixo do bloco de `preco`, antes do bloco de erro/botão de salvar:

```tsx
            <div className="flex flex-col gap-2">
              <Label htmlFor="versao">Versão</Label>
              <Input id="versao" {...form.register('versao')} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="cor">Cor</Label>
              <Input id="cor" {...form.register('cor')} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="km">Quilometragem</Label>
              <Input id="km" type="number" {...form.register('km')} />
              {form.formState.errors.km && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.km.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="combustivel">Combustível</Label>
              <Select
                value={form.watch('combustivel') ?? ''}
                onValueChange={(v) => form.setValue('combustivel', v as never)}
              >
                <SelectTrigger id="combustivel">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {COMBUSTIVEL_OPTIONS.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {opcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="cambio">Câmbio</Label>
              <Select
                value={form.watch('cambio') ?? ''}
                onValueChange={(v) => form.setValue('cambio', v as never)}
              >
                <SelectTrigger id="cambio">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {CAMBIO_OPTIONS.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {opcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="carroceria">Carroceria</Label>
              <Select
                value={form.watch('carroceria') ?? ''}
                onValueChange={(v) => form.setValue('carroceria', v as never)}
              >
                <SelectTrigger id="carroceria">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {CARROCERIA_OPTIONS.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {opcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="portas">Portas</Label>
              <Input id="portas" type="number" {...form.register('portas')} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="placa">Placa</Label>
              <Input id="placa" {...form.register('placa')} />
              {form.formState.errors.placa && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.placa.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="preco_promocional">Preço promocional</Label>
              <Input id="preco_promocional" type="number" step="0.01" {...form.register('preco_promocional')} />
              {form.formState.errors.preco_promocional && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.preco_promocional.message}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="aceita_troca"
                aria-label="Aceita troca"
                checked={form.watch('aceita_troca')}
                onCheckedChange={(v) => form.setValue('aceita_troca', v)}
              />
              <Label htmlFor="aceita_troca">Aceita troca</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="destaque"
                aria-label="Destaque"
                checked={form.watch('destaque')}
                onCheckedChange={(v) => form.setValue('destaque', v)}
              />
              <Label htmlFor="destaque">Destaque</Label>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(v) => form.setValue('status', v as never)}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {opcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea id="descricao" {...form.register('descricao')} />
            </div>

            <OpcionaisField
              value={form.watch('opcionais')}
              onChange={(valores) => form.setValue('opcionais', valores)}
            />
```

- [ ] **Step 9: Rodar e confirmar que passa**

Run: `npm test -- VeiculoForm.test`
Expected: PASS (3 testes)

- [ ] **Step 10: Verificação manual**

Run: `npm run dev`, cadastrar um veículo preenchendo todos os campos novos, confirmar no Supabase que os valores foram gravados corretamente (incluindo `opcionais` como array).

- [ ] **Step 11: Commit**

```bash
git add src/pages/VeiculoForm.tsx src/pages/VeiculoForm.test.tsx src/components/veiculos/OpcionaisField.tsx src/components/veiculos/OpcionaisField.test.tsx src/components/ui/select.tsx src/components/ui/textarea.tsx src/components/ui/switch.tsx src/components/ui/badge.tsx
git commit -m "feat: campos completos do formulário de veículo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Edição de veículo

**Files:**
- Modify: `src/pages/VeiculoForm.tsx`
- Modify: `src/pages/VeiculoForm.test.tsx`
- Modify: `src/App.tsx` (rota `/veiculos/:id/editar`)

**Interfaces:**
- Consumes: `getVeiculo`, `updateVeiculo` (Task 4).

- [ ] **Step 1: Escrever o teste de edição (falhando)**

Em `src/pages/VeiculoForm.test.tsx`, importar também `getVeiculo` e `updateVeiculo` do mock já existente de `@/lib/veiculos`, e adicionar:

```tsx
import { updateVeiculo, getVeiculo } from '@/lib/veiculos'
```

```tsx
function renderFormularioEdicao(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/veiculos/${id}/editar`]}>
      <Routes>
        <Route path="/veiculos/:id/editar" element={<VeiculoFormPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('VeiculoFormPage — edição', () => {
  it('carrega os dados existentes e envia a atualização', async () => {
    vi.mocked(getVeiculo).mockResolvedValue({
      id: 'existente-1',
      marca: 'Toyota',
      modelo: 'Corolla',
      ano_fabricacao: 2022,
      ano_modelo: 2023,
      preco: 110000,
      opcionais: [],
      status: 'disponivel',
      aceita_troca: false,
      destaque: false,
    } as never)
    vi.mocked(updateVeiculo).mockResolvedValue({ id: 'existente-1' } as never)
    const usuario = userEvent.setup()

    renderFormularioEdicao('existente-1')

    expect(await screen.findByDisplayValue('Toyota')).toBeInTheDocument()

    await usuario.clear(screen.getByLabelText(/^preço/i))
    await usuario.type(screen.getByLabelText(/^preço/i), '108000')
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/salvando/i)).toBeInTheDocument()
    expect(updateVeiculo).toHaveBeenCalledWith(
      'existente-1',
      expect.objectContaining({ preco: 108000, marca: 'Toyota' })
    )
  })

  it('mostra mensagem quando o veículo não é encontrado', async () => {
    vi.mocked(getVeiculo).mockResolvedValue(null)

    renderFormularioEdicao('inexistente')

    expect(await screen.findByText(/veículo não encontrado/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- VeiculoForm.test`
Expected: FAIL (o formulário ainda não carrega dados existentes)

- [ ] **Step 3: Implementar o carregamento e a atualização**

Em `src/pages/VeiculoForm.tsx`, importar `useEffect` de `'react'`, e `getVeiculo`, `updateVeiculo` de `@/lib/veiculos`. Adicionar estado e efeito de carregamento, e ramificar `onSubmit` entre criar/atualizar.

**Importante:** o bloco de estado/efeito abaixo precisa ficar logo depois de `const form = useForm(...)` e **antes** do `if (!user) { return ... }` — todo hook precisa ser chamado incondicionalmente, antes de qualquer `return` antecipado do componente.

```tsx
import { useEffect, useState } from 'react'
```

```tsx
  const [carregandoVeiculo, setCarregandoVeiculo] = useState(Boolean(id))
  const [naoEncontrado, setNaoEncontrado] = useState(false)

  useEffect(() => {
    if (!id) return
    getVeiculo(id)
      .then((veiculo) => {
        if (!veiculo) {
          setNaoEncontrado(true)
          return
        }
        form.reset({
          marca: veiculo.marca,
          modelo: veiculo.modelo,
          versao: veiculo.versao ?? undefined,
          ano_fabricacao: veiculo.ano_fabricacao,
          ano_modelo: veiculo.ano_modelo,
          cor: veiculo.cor ?? undefined,
          km: veiculo.km ?? undefined,
          combustivel: (veiculo.combustivel as never) ?? undefined,
          cambio: (veiculo.cambio as never) ?? undefined,
          carroceria: (veiculo.carroceria as never) ?? undefined,
          portas: veiculo.portas ?? undefined,
          placa: veiculo.placa ?? undefined,
          preco: veiculo.preco,
          preco_promocional: veiculo.preco_promocional ?? undefined,
          aceita_troca: veiculo.aceita_troca,
          destaque: veiculo.destaque,
          descricao: veiculo.descricao ?? undefined,
          opcionais: veiculo.opcionais,
          status: veiculo.status as never,
        })
      })
      .catch((e: Error) => setErroSalvar(e.message))
      .finally(() => setCarregandoVeiculo(false))
  }, [id, form])
```

Substituir o corpo de `onSubmit` para ramificar entre `createVeiculo` e `updateVeiculo`:

```tsx
    try {
      if (id) {
        await updateVeiculo(id, payload)
      } else {
        await createVeiculo(veiculoId, payload)
      }
      navigate('/veiculos')
    } catch (e) {
      setErroSalvar((e as Error).message)
    } finally {
      setSalvando(false)
    }
```

E, antes do `return` principal, tratar os estados de carregamento/não encontrado:

```tsx
  if (carregandoVeiculo) {
    return <p className="text-muted-foreground">Carregando...</p>
  }

  if (naoEncontrado) {
    return <p className="text-muted-foreground">Veículo não encontrado.</p>
  }
```

Ajustar também o título do `CardTitle` para refletir o modo:

```tsx
          <CardTitle>{id ? 'Editar veículo' : 'Novo veículo'}</CardTitle>
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- VeiculoForm.test`
Expected: PASS (5 testes)

- [ ] **Step 5: Registrar a rota**

Em `src/App.tsx`:

```tsx
      <Route
        path="/veiculos/:id/editar"
        element={
          <ProtectedRoute>
            <VeiculoFormPage />
          </ProtectedRoute>
        }
      />
```

- [ ] **Step 6: Verificação manual**

Run: `npm run dev`, editar o veículo criado na Task 6/7, mudar o preço, salvar, confirmar que a listagem mostra o novo valor.

- [ ] **Step 7: Commit**

```bash
git add src/pages/VeiculoForm.tsx src/pages/VeiculoForm.test.tsx src/App.tsx
git commit -m "feat: edição de veículo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Exclusão de veículo

**Files:**
- Modify: `src/pages/Veiculos.tsx`
- Modify: `src/pages/Veiculos.test.tsx`

**Interfaces:**
- Consumes: `deleteVeiculo` (Task 4), `recarregar` (do hook `useVeiculos`, Task 5).

- [ ] **Step 1: Instalar o componente de diálogo**

```bash
npx shadcn@latest add dialog
```

- [ ] **Step 2: Escrever o teste de exclusão (falhando)**

Em `src/pages/Veiculos.test.tsx`, importar `deleteVeiculo` no mock de `@/lib/veiculos` e `userEvent`:

```tsx
import userEvent from '@testing-library/user-event'
```

Trocar a linha `import { listVeiculos } from '@/lib/veiculos'` por:

```tsx
import { listVeiculos, deleteVeiculo } from '@/lib/veiculos'
```

E trocar o bloco `vi.mock('@/lib/veiculos', ...)` por:

```tsx
vi.mock('@/lib/veiculos', () => ({
  listVeiculos: vi.fn(),
  deleteVeiculo: vi.fn(),
}))
```

```tsx
  it('exclui um veículo após confirmação', async () => {
    vi.mocked(listVeiculos).mockResolvedValue([
      { id: '1', marca: 'Honda', modelo: 'Civic', ano_modelo: 2024, preco: 95000, status: 'disponivel' } as never,
    ])
    vi.mocked(deleteVeiculo).mockResolvedValue(undefined)
    const usuario = userEvent.setup()

    renderPagina()

    await usuario.click(await screen.findByRole('button', { name: /excluir/i }))
    await usuario.click(screen.getByRole('button', { name: /confirmar exclusão/i }))

    expect(deleteVeiculo).toHaveBeenCalledWith('1')
  })
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -- Veiculos.test`
Expected: FAIL (não existe botão "Excluir")

- [ ] **Step 4: Implementar a exclusão com confirmação**

Em `src/pages/Veiculos.tsx`, importar:

```tsx
import { useState } from 'react'
import { deleteVeiculo } from '@/lib/veiculos'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
```

Dentro do componente, adicionar estado de exclusão em andamento e a função de excluir:

```tsx
  const [excluindoId, setExcluindoId] = useState<string | null>(null)

  async function excluir(idVeiculo: string) {
    setExcluindoId(idVeiculo)
    try {
      await deleteVeiculo(idVeiculo)
      recarregar()
    } finally {
      setExcluindoId(null)
    }
  }
```

E na última célula de cada linha da tabela, ao lado do link "Editar":

```tsx
                <td className="py-2 text-right">
                  <Link to={`/veiculos/${veiculo.id}/editar`} className="mr-2 text-sm underline">
                    Editar
                  </Link>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        Excluir
                      </Button>
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
                          onClick={() => excluir(veiculo.id)}
                        >
                          Confirmar exclusão
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </td>
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm test -- Veiculos.test`
Expected: PASS (4 testes)

- [ ] **Step 6: Verificação manual**

Run: `npm run dev`, excluir um veículo de teste, confirmar que some da listagem e do Supabase.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Veiculos.tsx src/pages/Veiculos.test.tsx src/components/ui/dialog.tsx
git commit -m "feat: exclusão de veículo com confirmação

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Storage de fotos — bucket + camada de dados

**Files:**
- Create: `src/lib/veiculo-fotos.ts`
- Create: `src/lib/veiculo-fotos.test.ts`

**Interfaces:**
- Produces: `uploadFotoVeiculo(lojaId: string, veiculoId: string, arquivo: File): Promise<string>`, `removerFotoVeiculo(url: string): Promise<void>` — usadas pela Task 11 (UI de fotos).

**Ação manual prévia (fora deste repositório, no SQL Editor do Supabase):**

```sql
insert into storage.buckets (id, name, public)
values ('veiculos-fotos', 'veiculos-fotos', true)
on conflict (id) do nothing;

create policy "Lojista gerencia as próprias fotos"
on storage.objects for all
to authenticated
using (bucket_id = 'veiculos-fotos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'veiculos-fotos' and (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Step 1: Rodar essa SQL no Supabase antes de continuar** (checklist manual, não código)

- [ ] **Step 2: Escrever os testes com o storage do Supabase mockado**

`src/lib/veiculo-fotos.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase'
import { uploadFotoVeiculo, removerFotoVeiculo } from '@/lib/veiculo-fotos'

vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: vi.fn() } },
}))

beforeEach(() => {
  vi.mocked(supabase.storage.from).mockReset()
})

describe('uploadFotoVeiculo', () => {
  it('sobe o arquivo e retorna a URL pública', async () => {
    const bucket = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://exemplo.supabase.co/storage/v1/object/public/veiculos-fotos/loja-1/veiculo-1/foto.jpg' },
      }),
    }
    vi.mocked(supabase.storage.from).mockReturnValue(bucket as never)
    const arquivo = new File(['conteudo'], 'foto.jpg', { type: 'image/jpeg' })

    const url = await uploadFotoVeiculo('loja-1', 'veiculo-1', arquivo)

    expect(supabase.storage.from).toHaveBeenCalledWith('veiculos-fotos')
    expect(bucket.upload).toHaveBeenCalled()
    expect(url).toBe('https://exemplo.supabase.co/storage/v1/object/public/veiculos-fotos/loja-1/veiculo-1/foto.jpg')
  })

  it('lança erro quando o upload falha', async () => {
    const bucket = {
      upload: vi.fn().mockResolvedValue({ error: { message: 'falha no upload' } }),
      getPublicUrl: vi.fn(),
    }
    vi.mocked(supabase.storage.from).mockReturnValue(bucket as never)
    const arquivo = new File(['conteudo'], 'foto.jpg', { type: 'image/jpeg' })

    await expect(uploadFotoVeiculo('loja-1', 'veiculo-1', arquivo)).rejects.toThrow('falha no upload')
  })
})

describe('removerFotoVeiculo', () => {
  it('remove pelo caminho extraído da URL pública', async () => {
    const bucket = { remove: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.storage.from).mockReturnValue(bucket as never)

    await removerFotoVeiculo(
      'https://exemplo.supabase.co/storage/v1/object/public/veiculos-fotos/loja-1/veiculo-1/foto.jpg'
    )

    expect(bucket.remove).toHaveBeenCalledWith(['loja-1/veiculo-1/foto.jpg'])
  })

  it('não faz nada quando a URL não pertence ao bucket', async () => {
    const bucket = { remove: vi.fn() }
    vi.mocked(supabase.storage.from).mockReturnValue(bucket as never)

    await removerFotoVeiculo('https://outro-dominio.com/foto.jpg')

    expect(bucket.remove).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -- veiculo-fotos`
Expected: FAIL (módulo não existe)

- [ ] **Step 4: Implementar**

`src/lib/veiculo-fotos.ts`:

```ts
import { supabase } from '@/lib/supabase'

const BUCKET = 'veiculos-fotos'

export async function uploadFotoVeiculo(lojaId: string, veiculoId: string, arquivo: File): Promise<string> {
  const extensao = arquivo.name.split('.').pop() ?? 'jpg'
  const caminho = `${lojaId}/${veiculoId}/${crypto.randomUUID()}.${extensao}`

  const { error } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho)
  return data.publicUrl
}

export async function removerFotoVeiculo(url: string): Promise<void> {
  const marcador = `/storage/v1/object/public/${BUCKET}/`
  const indice = url.indexOf(marcador)
  if (indice === -1) return

  const caminho = decodeURIComponent(url.slice(indice + marcador.length))
  const { error } = await supabase.storage.from(BUCKET).remove([caminho])
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm test -- veiculo-fotos`
Expected: PASS (4 testes)

- [ ] **Step 6: Commit**

```bash
git add src/lib/veiculo-fotos.ts src/lib/veiculo-fotos.test.ts
git commit -m "feat: upload e remoção de fotos do veículo no Storage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: UI de fotos no formulário

**Files:**
- Create: `src/components/veiculos/FotosField.tsx`
- Create: `src/components/veiculos/FotosField.test.tsx`
- Modify: `src/pages/VeiculoForm.tsx`
- Modify: `src/pages/VeiculoForm.test.tsx`

**Interfaces:**
- Consumes: `uploadFotoVeiculo`, `removerFotoVeiculo` (Task 10).
- Produces: `FotosField` — `{ lojaId: string; veiculoId: string; fotos: string[]; fotoCapa: string | null; onChange: (fotos: string[], fotoCapa: string | null) => void }`.

- [ ] **Step 1: Escrever o teste do `FotosField` (falhando)**

`src/components/veiculos/FotosField.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FotosField } from '@/components/veiculos/FotosField'
import { uploadFotoVeiculo, removerFotoVeiculo } from '@/lib/veiculo-fotos'

vi.mock('@/lib/veiculo-fotos', () => ({
  uploadFotoVeiculo: vi.fn(),
  removerFotoVeiculo: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(uploadFotoVeiculo).mockReset()
  vi.mocked(removerFotoVeiculo).mockReset()
})

describe('FotosField', () => {
  it('sobe um arquivo selecionado e define como capa quando é a primeira foto', async () => {
    vi.mocked(uploadFotoVeiculo).mockResolvedValue('https://exemplo/foto1.jpg')
    const onChange = vi.fn()
    const usuario = userEvent.setup()
    const arquivo = new File(['conteudo'], 'foto1.jpg', { type: 'image/jpeg' })

    render(<FotosField lojaId="loja-1" veiculoId="veiculo-1" fotos={[]} fotoCapa={null} onChange={onChange} />)

    await usuario.upload(screen.getByLabelText(/adicionar fotos/i), arquivo)

    expect(uploadFotoVeiculo).toHaveBeenCalledWith('loja-1', 'veiculo-1', arquivo)
    expect(onChange).toHaveBeenCalledWith(['https://exemplo/foto1.jpg'], 'https://exemplo/foto1.jpg')
  })

  it('remove uma foto existente', async () => {
    vi.mocked(removerFotoVeiculo).mockResolvedValue(undefined)
    const onChange = vi.fn()
    const usuario = userEvent.setup()

    render(
      <FotosField
        lojaId="loja-1"
        veiculoId="veiculo-1"
        fotos={['https://exemplo/foto1.jpg', 'https://exemplo/foto2.jpg']}
        fotoCapa="https://exemplo/foto1.jpg"
        onChange={onChange}
      />
    )

    await usuario.click(screen.getAllByRole('button', { name: /remover foto/i })[0])

    expect(removerFotoVeiculo).toHaveBeenCalledWith('https://exemplo/foto1.jpg')
    expect(onChange).toHaveBeenCalledWith(['https://exemplo/foto2.jpg'], 'https://exemplo/foto2.jpg')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- FotosField`
Expected: FAIL (módulo não existe)

- [ ] **Step 3: Implementar**

`src/components/veiculos/FotosField.tsx`:

```tsx
import type { ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { uploadFotoVeiculo, removerFotoVeiculo } from '@/lib/veiculo-fotos'

interface FotosFieldProps {
  lojaId: string
  veiculoId: string
  fotos: string[]
  fotoCapa: string | null
  onChange: (fotos: string[], fotoCapa: string | null) => void
}

export function FotosField({ lojaId, veiculoId, fotos, fotoCapa, onChange }: FotosFieldProps) {
  async function aoSelecionarArquivos(evento: ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(evento.target.files ?? [])
    evento.target.value = ''

    const novasUrls: string[] = []
    for (const arquivo of arquivos) {
      const url = await uploadFotoVeiculo(lojaId, veiculoId, arquivo)
      novasUrls.push(url)
    }

    const todasAsFotos = [...fotos, ...novasUrls]
    const novaCapa = fotoCapa ?? novasUrls[0] ?? null
    onChange(todasAsFotos, novaCapa)
  }

  async function remover(url: string) {
    await removerFotoVeiculo(url)
    const restantes = fotos.filter((f) => f !== url)
    const novaCapa = fotoCapa === url ? (restantes[0] ?? null) : fotoCapa
    onChange(restantes, novaCapa)
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="fotos-input">Adicionar fotos</Label>
      <input id="fotos-input" type="file" accept="image/*" multiple onChange={aoSelecionarArquivos} />

      <div className="flex flex-wrap gap-3">
        {fotos.map((url) => (
          <div key={url} className="flex flex-col items-center gap-1">
            <img src={url} alt="Foto do veículo" className="h-20 w-28 rounded object-cover" />
            <div className="flex gap-1">
              <Button
                type="button"
                variant={url === fotoCapa ? 'default' : 'outline'}
                size="xs"
                onClick={() => onChange(fotos, url)}
              >
                {url === fotoCapa ? 'Capa' : 'Definir capa'}
              </Button>
              <Button type="button" variant="destructive" size="xs" aria-label="Remover foto" onClick={() => remover(url)}>
                Remover
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- FotosField`
Expected: PASS (2 testes)

- [ ] **Step 5: Integrar ao formulário**

Em `src/pages/VeiculoForm.tsx`, adicionar estado local pra fotos (fora do React Hook Form, pois o upload é assíncrono e não é um input de texto comum):

```tsx
import { FotosField } from '@/components/veiculos/FotosField'
```

```tsx
  const [fotos, setFotos] = useState<string[]>([])
  const [fotoCapa, setFotoCapa] = useState<string | null>(null)
```

No `useEffect` de carregamento (edição), adicionar após o `form.reset(...)`:

```tsx
        setFotos(veiculo.fotos)
        setFotoCapa(veiculo.foto_capa)
```

No payload montado em `onSubmit`, trocar `fotos: []` e `foto_capa: null` por:

```tsx
      fotos,
      foto_capa: fotoCapa,
```

E no JSX, antes do bloco de erro/botão de salvar:

```tsx
            <FotosField
              lojaId={user!.id}
              veiculoId={veiculoId}
              fotos={fotos}
              fotoCapa={fotoCapa}
              onChange={(novasFotos, novaCapa) => {
                setFotos(novasFotos)
                setFotoCapa(novaCapa)
              }}
            />
```

- [ ] **Step 6: Rodar toda a suíte e confirmar que nada quebrou**

Run: `npm test`
Expected: PASS (todos os testes existentes + os novos)

- [ ] **Step 7: Verificação manual**

Run: `npm run dev`, cadastrar um veículo novo com 2 fotos, confirmar que aparecem como thumbnails, trocar a capa, remover uma foto, salvar e conferir no Supabase Storage que os arquivos existem no caminho `<loja_id>/<veiculo_id>/...`.

- [ ] **Step 8: Commit**

```bash
git add src/components/veiculos/FotosField.tsx src/components/veiculos/FotosField.test.tsx src/pages/VeiculoForm.tsx src/pages/VeiculoForm.test.tsx
git commit -m "feat: upload de fotos integrado ao formulário de veículo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: Serverless function — consulta de placa

**Files:**
- Create: `api/consulta-placa.ts`
- Create: `api/consulta-placa.test.ts`
- Modify: `package.json` (devDependency `@vercel/node`)

**Interfaces:**
- Produces: `buscarDadosPlaca(placa: string, token: string): Promise<ResultadoConsultaPlaca>` (função pura, testável sem HTTP real), `export default handler` (adaptador Vercel), tipo `ResultadoConsultaPlaca` — consumido pela Task 13 (front-end).

- [ ] **Step 1: Instalar os tipos da Vercel**

```bash
npm install -D @vercel/node
```

- [ ] **Step 2: Escrever os testes com `fetch` mockado**

`api/consulta-placa.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buscarDadosPlaca } from './consulta-placa'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('buscarDadosPlaca', () => {
  it('retorna os dados normalizados quando há uma única correspondência Fipe', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        marca: 'VW',
        modelo: 'CROSSFOX',
        ano: '2007',
        anoModelo: '2007',
        cor: 'Prata',
        extra: { combustivel: 'Alcool / Gasolina', caixa_cambio: '', carroceria: '' },
        fipe: {
          dados: [
            {
              texto_modelo: 'CROSSFOX 1.6 Mi Total Flex 8V 5p',
              texto_valor: 'R$ 28.799,00',
              score: 101,
            },
          ],
        },
      }),
    } as never)

    const resultado = await buscarDadosPlaca('INT8C36', 'token-teste')

    expect(resultado).toEqual({
      ok: true,
      data: {
        marca: 'VW',
        modelo: 'CROSSFOX',
        anoFabricacao: 2007,
        anoModelo: 2007,
        cor: 'Prata',
        combustivel: 'Flex',
        cambio: undefined,
        carroceria: undefined,
        versoes: [{ texto: 'CROSSFOX 1.6 Mi Total Flex 8V 5p', valorFipe: 28799, score: 101 }],
      },
    })
  })

  it('ordena múltiplas correspondências Fipe da maior pra menor pontuação', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        marca: 'VW',
        modelo: 'CROSSFOX',
        ano: '2007',
        anoModelo: '2007',
        cor: 'Prata',
        extra: {},
        fipe: {
          dados: [
            { texto_modelo: 'Versão A', texto_valor: 'R$ 20.000,00', score: 80 },
            { texto_modelo: 'Versão B', texto_valor: 'R$ 22.000,00', score: 95 },
          ],
        },
      }),
    } as never)

    const resultado = await buscarDadosPlaca('INT8C36', 'token-teste')

    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.data.versoes.map((v) => v.texto)).toEqual(['Versão B', 'Versão A'])
    }
  })

  it('mapeia placa não encontrada (406)', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 406, json: async () => ({}) } as never)

    const resultado = await buscarDadosPlaca('AAA0000', 'token-teste')

    expect(resultado).toEqual({ ok: false, codigo: 'nao_encontrada' })
  })

  it('mapeia placa inválida (401)', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 401, json: async () => ({}) } as never)

    const resultado = await buscarDadosPlaca('AAA0000', 'token-teste')

    expect(resultado).toEqual({ ok: false, codigo: 'placa_invalida' })
  })

  it('mapeia limite de consultas atingido (429)', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 429, json: async () => ({}) } as never)

    const resultado = await buscarDadosPlaca('AAA0000', 'token-teste')

    expect(resultado).toEqual({ ok: false, codigo: 'limite_excedido' })
  })

  it('mapeia qualquer outro erro como indisponível', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('timeout'))

    const resultado = await buscarDadosPlaca('AAA0000', 'token-teste')

    expect(resultado).toEqual({ ok: false, codigo: 'indisponivel' })
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -- api/consulta-placa`
Expected: FAIL (módulo não existe)

- [ ] **Step 4: Implementar**

`api/consulta-placa.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'

export interface VersaoFipe {
  texto: string
  valorFipe: number
  score: number
}

export interface DadosPlaca {
  marca: string
  modelo: string
  anoFabricacao: number
  anoModelo: number
  cor?: string
  combustivel?: string
  cambio?: string
  carroceria?: string
  versoes: VersaoFipe[]
}

export type CodigoErroConsultaPlaca =
  | 'placa_invalida'
  | 'nao_encontrada'
  | 'token_invalido'
  | 'limite_excedido'
  | 'indisponivel'

export type ResultadoConsultaPlaca =
  | { ok: true; data: DadosPlaca }
  | { ok: false; codigo: CodigoErroConsultaPlaca }

function normalizarCombustivel(valor: string | undefined): string | undefined {
  if (!valor) return undefined
  const texto = valor.toLowerCase()
  const temAlcool = texto.includes('alcool') || texto.includes('etanol') || texto.includes('álcool')
  const temGasolina = texto.includes('gasolina')
  if (temAlcool && temGasolina) return 'Flex'
  if (texto.includes('flex')) return 'Flex'
  if (temGasolina) return 'Gasolina'
  if (temAlcool) return 'Etanol'
  if (texto.includes('diesel')) return 'Diesel'
  if (texto.includes('híbrido') || texto.includes('hibrido')) return 'Híbrido'
  if (texto.includes('elétrico') || texto.includes('eletrico')) return 'Elétrico'
  return undefined
}

function paraNumero(valorEmReais: string): number {
  const limpo = valorEmReais.replace(/[^\d,]/g, '').replace(',', '.')
  return Number(limpo)
}

function vazioParaUndefined(valor: string | undefined): string | undefined {
  return valor ? valor : undefined
}

export async function buscarDadosPlaca(placa: string, token: string): Promise<ResultadoConsultaPlaca> {
  try {
    const resposta = await fetch(`https://wdapi2.com.br/consulta/${placa}/${token}`)

    if (!resposta.ok) {
      if (resposta.status === 401) return { ok: false, codigo: 'placa_invalida' }
      if (resposta.status === 402) return { ok: false, codigo: 'token_invalido' }
      if (resposta.status === 406) return { ok: false, codigo: 'nao_encontrada' }
      if (resposta.status === 429) return { ok: false, codigo: 'limite_excedido' }
      return { ok: false, codigo: 'indisponivel' }
    }

    const corpo = await resposta.json()

    const versoes: VersaoFipe[] = (corpo.fipe?.dados ?? [])
      .map((item: { texto_modelo: string; texto_valor: string; score: number }) => ({
        texto: item.texto_modelo,
        valorFipe: paraNumero(item.texto_valor),
        score: item.score,
      }))
      .sort((a: VersaoFipe, b: VersaoFipe) => b.score - a.score)

    return {
      ok: true,
      data: {
        marca: corpo.marca,
        modelo: corpo.modelo,
        anoFabricacao: Number(corpo.ano),
        anoModelo: Number(corpo.anoModelo),
        cor: vazioParaUndefined(corpo.cor),
        combustivel: normalizarCombustivel(corpo.extra?.combustivel),
        cambio: vazioParaUndefined(corpo.extra?.caixa_cambio),
        carroceria: vazioParaUndefined(corpo.extra?.carroceria),
        versoes,
      },
    }
  } catch {
    return { ok: false, codigo: 'indisponivel' }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const placa = req.query.placa
  if (typeof placa !== 'string' || placa.trim() === '') {
    res.status(400).json({ error: 'placa_invalida' })
    return
  }

  const token = process.env.APIPLACAS_TOKEN
  if (!token) {
    res.status(500).json({ error: 'token_invalido' })
    return
  }

  const resultado = await buscarDadosPlaca(placa.trim().toUpperCase(), token)

  if (resultado.ok) {
    res.status(200).json({ ok: true, data: resultado.data })
    return
  }

  const statusPorCodigo: Record<CodigoErroConsultaPlaca, number> = {
    placa_invalida: 400,
    nao_encontrada: 404,
    token_invalido: 500,
    limite_excedido: 429,
    indisponivel: 502,
  }

  res.status(statusPorCodigo[resultado.codigo]).json({ ok: false, error: resultado.codigo })
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm test -- api/consulta-placa`
Expected: PASS (6 testes)

- [ ] **Step 6: Configurar a variável de ambiente no Vercel (ação manual, fora do código)**

No painel do projeto Vercel: Settings → Environment Variables → adicionar `APIPLACAS_TOKEN` com o token de produção (**não** commitar esse valor em lugar nenhum do repositório).

- [ ] **Step 7: Commit**

```bash
git add api/consulta-placa.ts api/consulta-placa.test.ts package.json package-lock.json
git commit -m "feat: serverless function de consulta de placa (API Placas)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13: UI de busca por placa no formulário

**Files:**
- Create: `src/components/veiculos/PlacaLookup.tsx`
- Create: `src/components/veiculos/PlacaLookup.test.tsx`
- Modify: `src/pages/VeiculoForm.tsx`

**Interfaces:**
- Consumes: a rota `/api/consulta-placa` (Task 12), tipos `DadosPlaca`/`VersaoFipe` (Task 12, reexportados ou duplicados como tipos locais de front-end).
- Produces: `PlacaLookup` — `{ placaAtual: string; onDadosEncontrados: (dados: { marca: string; modelo: string; anoFabricacao: number; anoModelo: number; cor?: string; combustivel?: string; cambio?: string; carroceria?: string; versao?: string; valorFipeReferencia?: number }) => void }`.

- [ ] **Step 1: Escrever o teste do `PlacaLookup` (falhando)**

`src/components/veiculos/PlacaLookup.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlacaLookup } from '@/components/veiculos/PlacaLookup'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('PlacaLookup', () => {
  it('preenche direto quando há uma única correspondência Fipe', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        ok: true,
        data: {
          marca: 'VW',
          modelo: 'CROSSFOX',
          anoFabricacao: 2007,
          anoModelo: 2007,
          cor: 'Prata',
          combustivel: 'Flex',
          versoes: [{ texto: 'CROSSFOX 1.6 Total Flex', valorFipe: 28799, score: 101 }],
        },
      }),
    } as never)
    const onDadosEncontrados = vi.fn()
    const usuario = userEvent.setup()

    render(<PlacaLookup placaAtual="INT8C36" onDadosEncontrados={onDadosEncontrados} />)
    await usuario.click(screen.getByRole('button', { name: /buscar dados/i }))

    expect(await screen.findByText(/dados encontrados/i)).toBeInTheDocument()
    expect(onDadosEncontrados).toHaveBeenCalledWith(
      expect.objectContaining({ marca: 'VW', modelo: 'CROSSFOX', versao: 'CROSSFOX 1.6 Total Flex' })
    )
  })

  it('mostra seletor quando há múltiplas correspondências Fipe', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        ok: true,
        data: {
          marca: 'VW',
          modelo: 'CROSSFOX',
          anoFabricacao: 2007,
          anoModelo: 2007,
          versoes: [
            { texto: 'Versão B', valorFipe: 22000, score: 95 },
            { texto: 'Versão A', valorFipe: 20000, score: 80 },
          ],
        },
      }),
    } as never)
    const onDadosEncontrados = vi.fn()
    const usuario = userEvent.setup()

    render(<PlacaLookup placaAtual="INT8C36" onDadosEncontrados={onDadosEncontrados} />)
    await usuario.click(screen.getByRole('button', { name: /buscar dados/i }))

    expect(await screen.findByText('Versão B')).toBeInTheDocument()
    expect(onDadosEncontrados).not.toHaveBeenCalled()

    await usuario.click(screen.getByRole('button', { name: /usar esta versão/i }))

    expect(onDadosEncontrados).toHaveBeenCalledWith(expect.objectContaining({ versao: 'Versão B' }))
  })

  it('mostra mensagem quando a placa não é encontrada', async () => {
    vi.mocked(fetch).mockResolvedValue({ json: async () => ({ ok: false, error: 'nao_encontrada' }) } as never)
    const usuario = userEvent.setup()

    render(<PlacaLookup placaAtual="AAA0000" onDadosEncontrados={vi.fn()} />)
    await usuario.click(screen.getByRole('button', { name: /buscar dados/i }))

    expect(await screen.findByText(/placa não encontrada/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- PlacaLookup`
Expected: FAIL (módulo não existe)

- [ ] **Step 3: Implementar**

`src/components/veiculos/PlacaLookup.tsx`:

```tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface VersaoFipe {
  texto: string
  valorFipe: number
  score: number
}

interface DadosPlaca {
  marca: string
  modelo: string
  anoFabricacao: number
  anoModelo: number
  cor?: string
  combustivel?: string
  cambio?: string
  carroceria?: string
  versoes: VersaoFipe[]
}

interface DadosEncontrados {
  marca: string
  modelo: string
  anoFabricacao: number
  anoModelo: number
  cor?: string
  combustivel?: string
  cambio?: string
  carroceria?: string
  versao?: string
  valorFipeReferencia?: number
}

interface PlacaLookupProps {
  placaAtual: string
  onDadosEncontrados: (dados: DadosEncontrados) => void
}

const MENSAGENS_ERRO: Record<string, string> = {
  placa_invalida: 'Placa inválida. Confira o formato digitado.',
  nao_encontrada: 'Placa não encontrada. Preencha os dados manualmente.',
  token_invalido: 'Consulta indisponível no momento. Preencha os dados manualmente.',
  limite_excedido: 'Consulta indisponível no momento. Preencha os dados manualmente.',
  indisponivel: 'Consulta indisponível no momento. Preencha os dados manualmente.',
}

export function PlacaLookup({ placaAtual, onDadosEncontrados }: PlacaLookupProps) {
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [dados, setDados] = useState<DadosPlaca | null>(null)

  function aplicar(dadosBase: DadosPlaca, versao?: VersaoFipe) {
    onDadosEncontrados({
      marca: dadosBase.marca,
      modelo: dadosBase.modelo,
      anoFabricacao: dadosBase.anoFabricacao,
      anoModelo: dadosBase.anoModelo,
      cor: dadosBase.cor,
      combustivel: dadosBase.combustivel,
      cambio: dadosBase.cambio,
      carroceria: dadosBase.carroceria,
      versao: versao?.texto,
      valorFipeReferencia: versao?.valorFipe,
    })
  }

  async function buscar() {
    setErro(null)
    setDados(null)
    setCarregando(true)
    try {
      const resposta = await fetch(`/api/consulta-placa?placa=${encodeURIComponent(placaAtual)}`)
      const corpo = await resposta.json()

      if (!corpo.ok) {
        setErro(MENSAGENS_ERRO[corpo.error] ?? MENSAGENS_ERRO.indisponivel)
        return
      }

      const dadosRecebidos = corpo.data as DadosPlaca
      if (dadosRecebidos.versoes.length <= 1) {
        aplicar(dadosRecebidos, dadosRecebidos.versoes[0])
      } else {
        setDados(dadosRecebidos)
      }
    } catch {
      setErro(MENSAGENS_ERRO.indisponivel)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" disabled={carregando || !placaAtual} onClick={buscar}>
        {carregando ? 'Buscando...' : 'Buscar dados'}
      </Button>

      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}

      {dados && dados.versoes.length > 1 && (
        <div className="flex flex-col gap-2 rounded border p-3">
          <p className="text-sm font-medium">Dados encontrados — selecione a versão correta:</p>
          {dados.versoes.map((versao) => (
            <div key={versao.texto} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {versao.texto} — Fipe:{' '}
                {versao.valorFipe.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
              <Button type="button" size="sm" onClick={() => aplicar(dados, versao)}>
                Usar esta versão
              </Button>
            </div>
          ))}
        </div>
      )}

      {dados && dados.versoes.length <= 1 && <p className="text-sm text-muted-foreground">Dados encontrados.</p>}
    </div>
  )
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- PlacaLookup`
Expected: PASS (3 testes)

- [ ] **Step 5: Integrar ao formulário**

Em `src/pages/VeiculoForm.tsx`:

```tsx
import { PlacaLookup } from '@/components/veiculos/PlacaLookup'
```

Adicionar estado pro valor de referência Fipe:

```tsx
  const [valorFipeReferencia, setValorFipeReferencia] = useState<number | null>(null)
```

Logo abaixo do campo `placa` no JSX, adicionar:

```tsx
            <PlacaLookup
              placaAtual={form.watch('placa') ?? ''}
              onDadosEncontrados={(dados) => {
                form.setValue('marca', dados.marca)
                form.setValue('modelo', dados.modelo)
                form.setValue('ano_fabricacao', dados.anoFabricacao)
                form.setValue('ano_modelo', dados.anoModelo)
                if (dados.cor) form.setValue('cor', dados.cor)
                if (dados.combustivel) form.setValue('combustivel', dados.combustivel as never)
                // cambio/carroceria vêm em texto livre da API de placas (nem sempre presentes) —
                // só aplica se bater exatamente com uma das opções do select, senão fica em branco
                // pro lojista escolher manualmente.
                if (dados.cambio && (CAMBIO_OPTIONS as readonly string[]).includes(dados.cambio)) {
                  form.setValue('cambio', dados.cambio as never)
                }
                if (dados.carroceria && (CARROCERIA_OPTIONS as readonly string[]).includes(dados.carroceria)) {
                  form.setValue('carroceria', dados.carroceria as never)
                }
                if (dados.versao) form.setValue('versao', dados.versao)
                setValorFipeReferencia(dados.valorFipeReferencia ?? null)
              }}
            />
```

E, no bloco do campo `preco`, adicionar logo depois do `<Input id="preco" ... />` (antes da mensagem de erro):

```tsx
              {valorFipeReferencia !== null && (
                <p className="text-sm text-muted-foreground">
                  Valor Fipe de referência:{' '}
                  {valorFipeReferencia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} —{' '}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => form.setValue('preco', valorFipeReferencia)}
                  >
                    usar como preço
                  </button>
                </p>
              )}
```

- [ ] **Step 6: Rodar toda a suíte e confirmar que nada quebrou**

Run: `npm test`
Expected: PASS (todos os testes)

- [ ] **Step 7: Verificação manual**

Requer `vercel dev` (ou deploy de preview) pra servir `/api/consulta-placa` localmente, com `APIPLACAS_TOKEN` configurado em `.env` local do Vercel CLI. Testar com uma placa real: conferir preenchimento automático, o seletor de versões (se houver mais de uma), e as mensagens de erro com uma placa inexistente.

- [ ] **Step 8: Commit**

```bash
git add src/components/veiculos/PlacaLookup.tsx src/components/veiculos/PlacaLookup.test.tsx src/pages/VeiculoForm.tsx
git commit -m "feat: busca de dados do veículo por placa no formulário

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 14: Revisão final e atualização da documentação

**Files:**
- Modify: `zapcar-frontend/CLAUDE.md`
- Modify: `README.md`

**Interfaces:** nenhuma (task de fechamento, sem código novo).

- [ ] **Step 1: Rodar a suíte completa de testes**

Run: `npm test`
Expected: PASS (todos os testes de todas as tasks anteriores)

- [ ] **Step 2: Rodar o lint**

Run: `npm run lint`
Expected: sem erros (avisos pré-existentes, se houver, não são deste sub-projeto)

- [ ] **Step 3: Rodar o build de produção**

Run: `npm run build`
Expected: build conclui sem erros de tipo

- [ ] **Step 4: Checklist de verificação manual end-to-end**

Com `npm run dev` (e `vercel dev` pra rota de placa), confirmar:
- [ ] Listar veículos existentes em `/veiculos`.
- [ ] Cadastrar um veículo novo com todos os campos preenchidos manualmente.
- [ ] Cadastrar um veículo usando "Buscar dados" por placa, incluindo o caso de múltiplas versões Fipe.
- [ ] Editar um veículo existente e confirmar que os valores persistem.
- [ ] Excluir um veículo e confirmar a remoção (linha + fotos no Storage).
- [ ] Tentar cadastrar sem marca/modelo/preço e ver os erros de validação.
- [ ] Confirmar isolamento: logar com duas contas de loja diferentes e confirmar que uma não vê os veículos da outra.

- [ ] **Step 5: Atualizar `CLAUDE.md`**

Em `zapcar-frontend/CLAUDE.md`, atualizar a seção "Roteiro — próximos sub-projetos":

```markdown
1. ~~Fundação~~ ✅ completo
2. ~~CRUD de veículos~~ ✅ completo
3. **Vitrine pública com CTA de WhatsApp** (`/v/:slug`) — próximo. Inclui a tarefa de reordenação manual dos veículos (`ordem`), adiada do CRUD de veículos.
4. Dashboard CRM (histórico de conversa, temperatura do lead, assumir conversa manualmente).
5. Billing (Stripe) + landing page.
```

E adicionar a referência da spec/plano deste sub-projeto ao lado da referência da Fundação:

```markdown
Spec do CRUD de veículos: `docs/superpowers/specs/2026-09-13-crud-veiculos-design.md`
Plano de implementação do CRUD de veículos: `docs/superpowers/plans/2026-09-13-crud-veiculos.md`
```

- [ ] **Step 6: Atualizar `README.md`**

Adicionar, após a seção de configuração de `.env.local`, uma nota sobre a variável de ambiente do Vercel:

```markdown
## Variável de ambiente adicional (Vercel)

A busca de dados por placa (`api/consulta-placa.ts`) depende de `APIPLACAS_TOKEN`, configurada em Settings → Environment Variables do projeto na Vercel — **nunca** como `VITE_*` nem commitada no repositório.
```

E, após a seção de Build, uma seção de testes:

```markdown
## Testes

```bash
npm test
```
```

- [ ] **Step 7: Commit**

```bash
git add zapcar-frontend/CLAUDE.md README.md
git commit -m "docs: atualiza roteiro e README após o CRUD de veículos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

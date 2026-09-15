# Dashboard CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a rota `/leads` com um board Kanban (colunas Novo/Frio/Morno/Quente/Agendado) para os leads da loja, permitindo reclassificar manualmente por arrastar-e-soltar, ver o histórico de conversa de um lead num painel lateral, e alternar entre "bot atendendo" e "assumi a conversa".

**Architecture:** Uma camada de dados nova (`src/lib/leads.ts`) lê/grava `leads` e `Interacoes` (RLS já escopa por loja, sem filtro `loja_id` explícito no client — mesmo padrão de `listVeiculos()`). Um hook `useLeads` carrega a lista. A decisão de "pra qual coluna esse drag deve mover o lead" e "pra onde o teclado deve pular ao apertar seta" são funções puras isoladas (`decidirMovimentoLead`, `coordenadasColuna`), testadas diretamente sem precisar simular DOM — o `KanbanBoard` só as invoca. `PainelConversaLead` é um `Sheet` (shadcn, novo neste projeto) controlado pela página, que busca o histórico do lead selecionado sob demanda. `Leads.tsx` orquestra tudo e persiste mudanças de forma otimista (mesmo padrão da reordenação de veículos).

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui (`base-nova`) + React Router 7 + `@supabase/supabase-js` + Vitest + React Testing Library + `@dnd-kit/core` (já instalado desde a reordenação de veículos — nenhuma instalação nova de drag-and-drop), mais um componente shadcn novo: `sheet`.

**Spec:** `docs/superpowers/specs/2026-09-15-dashboard-crm-design.md`

## Global Constraints

- Usar sempre a chave **publishable** do Supabase (`VITE_SUPABASE_PUBLISHABLE_KEY`), nunca a `secret key`.
- TDD em todo arquivo de lógica e componente: teste escrito e falhando antes da implementação.
- **Sem filtro `loja_id` explícito nas leituras** — RLS já escopa `leads`/`Interacoes` pelo dono autenticado, mesmo padrão já usado em `listVeiculos()` (que também não filtra `loja_id` no client). Não é necessário `useLoja`/`useAuth` nesta entrega.
- Nenhuma migration necessária — todas as colunas usadas (`leads.temperatura`, `leads.bot_ativo`, `leads.resumo_diario`, `Interacoes.*`) já existem e são mantidas pelos workflows n8n descritos na spec.
- Nome da tabela `Interacoes` tem "I" maiúsculo — usar exatamente `supabase.from('Interacoes')` (é assim que os workflows n8n já gravam nela).
- **shadcn `Button` deste projeto não tem prop `asChild`** (primitivas `@base-ui/react`) — usar a prop `render` quando precisar envolver um `Link`.
- Biblioteca de drag-and-drop: `@dnd-kit/core` puro (`useDraggable`/`useDroppable`), **não** `@dnd-kit/sortable` — diferente da reordenação de veículos, aqui não existe ordem dentro de uma coluna, só pertencimento a uma coluna, então não há necessidade de contexto "sortable".
- **Lógica de drag-and-drop isolada em funções puras, testadas sem simular DOM:** `decidirMovimentoLead` (pra qual coluna o `onDragEnd` deve mover o lead, se alguma) e `coordenadasColuna` (pra onde o teclado deve pular ao apertar seta esquerda/direita) recebem dados já simples (objetos planos, `Map`s) e são chamadas diretamente nos testes — não precisam de `getBoundingClientRect` mockado feito elemento por elemento como na reordenação de veículos. Só o teste de integração do `KanbanBoard` (Task 5) precisa desse tipo de mock, e só uma vez, pra confirmar que a fiação (sensors, collision detection, callbacks) está correta.
- Toda mensagem de commit termina com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## Task 1: Camada de dados — `src/lib/leads.ts`

**Files:**
- Create: `src/lib/leads.ts`
- Create: `src/lib/leads.test.ts`

**Interfaces:**
- Consumes: `supabase` de `@/lib/supabase` (já mockado nos testes existentes do projeto, mesmo padrão).
- Produces: `type TemperaturaLead = 'Frio' | 'Morno' | 'Quente' | 'Agendado'`; `type ColunaId = TemperaturaLead | 'novo'`; `interface Lead`; `interface Interacao`; `getLeads(): Promise<Lead[]>`; `updateLeadTemperatura(leadId: string, temperatura: TemperaturaLead): Promise<void>`; `getInteracoes(leadId: string): Promise<Interacao[]>`; `setLeadBotAtivo(leadId: string, ativo: boolean): Promise<void>`. Usadas por `useLeads` (Task 2), `KanbanBoard`/`decidirMovimentoLead` (Tasks 3-5), `PainelConversaLead` (Task 6) e `Leads.tsx` (Task 7).

- [ ] **Step 1: Escrever os testes (falhando)**

`src/lib/leads.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase'
import { getLeads, updateLeadTemperatura, getInteracoes, setLeadBotAtivo } from '@/lib/leads'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

beforeEach(() => {
  vi.mocked(supabase.from).mockReset()
})

describe('getLeads', () => {
  it('busca todos os leads ordenados pela última atualização', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ id: '1', nome: 'Fulano' }],
        error: null,
      }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const resultado = await getLeads()

    expect(supabase.from).toHaveBeenCalledWith('leads')
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.order).toHaveBeenCalledWith('updated_at', { ascending: false })
    expect(resultado).toHaveLength(1)
  })

  it('lança erro quando o Supabase retorna erro', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'falha de rede' } }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await expect(getLeads()).rejects.toThrow('falha de rede')
  })
})

describe('updateLeadTemperatura', () => {
  it('atualiza a temperatura do lead', async () => {
    const builder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await updateLeadTemperatura('lead-1', 'Quente')

    expect(supabase.from).toHaveBeenCalledWith('leads')
    expect(builder.update).toHaveBeenCalledWith({ temperatura: 'Quente' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'lead-1')
  })

  it('lança erro quando o Supabase retorna erro', async () => {
    const builder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: { message: 'falha de rede' } }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await expect(updateLeadTemperatura('lead-1', 'Quente')).rejects.toThrow('falha de rede')
  })
})

describe('getInteracoes', () => {
  it('busca as interações do lead em ordem cronológica', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ id: '1', lead_id: 'lead-1', remetente: 'LEAD', tipo: 'conversation', conteudo: 'Oi' }],
        error: null,
      }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const resultado = await getInteracoes('lead-1')

    expect(supabase.from).toHaveBeenCalledWith('Interacoes')
    expect(builder.eq).toHaveBeenCalledWith('lead_id', 'lead-1')
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(resultado).toHaveLength(1)
  })

  it('lança erro quando o Supabase retorna erro', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'falha de rede' } }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await expect(getInteracoes('lead-1')).rejects.toThrow('falha de rede')
  })
})

describe('setLeadBotAtivo', () => {
  it('atualiza bot_ativo do lead', async () => {
    const builder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await setLeadBotAtivo('lead-1', false)

    expect(builder.update).toHaveBeenCalledWith({ bot_ativo: false })
    expect(builder.eq).toHaveBeenCalledWith('id', 'lead-1')
  })

  it('lança erro quando o Supabase retorna erro', async () => {
    const builder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: { message: 'falha de rede' } }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await expect(setLeadBotAtivo('lead-1', false)).rejects.toThrow('falha de rede')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- leads.test`
Expected: FAIL com erro de módulo `@/lib/leads` não encontrado

- [ ] **Step 3: Implementar**

`src/lib/leads.ts`:

```ts
import { supabase } from '@/lib/supabase'

export type TemperaturaLead = 'Frio' | 'Morno' | 'Quente' | 'Agendado'
export type ColunaId = TemperaturaLead | 'novo'

export interface Lead {
  id: string
  loja_id: string
  nome: string | null
  telefone: string | null
  whatsapp: string
  bot_ativo: boolean
  temperatura: TemperaturaLead | null
  resumo_diario: string | null
  data_ultimo_resumo: string | null
  created_at: string
  updated_at: string
}

export interface Interacao {
  id: string
  lead_id: string
  remetente: 'LEAD' | 'LOJA' | 'BOT'
  tipo: string
  conteudo: string
  created_at: string
}

export async function getLeads(): Promise<Lead[]> {
  const { data, error } = await supabase.from('leads').select('*').order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Lead[]
}

export async function updateLeadTemperatura(leadId: string, temperatura: TemperaturaLead): Promise<void> {
  const { error } = await supabase.from('leads').update({ temperatura }).eq('id', leadId)
  if (error) throw new Error(error.message)
}

export async function getInteracoes(leadId: string): Promise<Interacao[]> {
  const { data, error } = await supabase
    .from('Interacoes')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as Interacao[]
}

export async function setLeadBotAtivo(leadId: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from('leads').update({ bot_ativo: ativo }).eq('id', leadId)
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- leads.test`
Expected: PASS (8 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/leads.ts src/lib/leads.test.ts
git commit -m "feat: camada de dados de leads e interações (CRM)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Hook `useLeads`

**Files:**
- Create: `src/hooks/useLeads.ts`
- Create: `src/hooks/useLeads.test.ts`

**Interfaces:**
- Consumes: `getLeads`, `type Lead` (Task 1).
- Produces: `useLeads()` — `{ leads: Lead[]; carregando: boolean; erro: string | null; recarregar: () => void }`. Usado por `Leads.tsx` (Task 7). Mesma forma de `useVeiculos()`/`useLoja()`, já existentes no projeto.

- [ ] **Step 1: Escrever o teste (falhando)**

`src/hooks/useLeads.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useLeads } from './useLeads'
import { getLeads } from '@/lib/leads'

vi.mock('@/lib/leads', () => ({
  getLeads: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(getLeads).mockReset()
})

describe('useLeads', () => {
  it('carrega os leads ao montar', async () => {
    vi.mocked(getLeads).mockResolvedValue([{ id: '1' } as never])

    const { result } = renderHook(() => useLeads())

    expect(result.current.carregando).toBe(true)
    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.leads).toEqual([{ id: '1' }])
    expect(result.current.erro).toBeNull()
  })

  it('expõe o erro quando a busca falha', async () => {
    vi.mocked(getLeads).mockRejectedValue(new Error('falha de rede'))

    const { result } = renderHook(() => useLeads())

    await waitFor(() => expect(result.current.erro).toBe('falha de rede'))
  })

  it('recarrega ao chamar recarregar', async () => {
    vi.mocked(getLeads).mockResolvedValue([])
    const { result } = renderHook(() => useLeads())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    result.current.recarregar()

    expect(vi.mocked(getLeads)).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- useLeads.test`
Expected: FAIL com erro de módulo `./useLeads` não encontrado

- [ ] **Step 3: Implementar**

`src/hooks/useLeads.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { getLeads, type Lead } from '@/lib/leads'

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(() => {
    setCarregando(true)
    setErro(null)
    getLeads()
      .then(setLeads)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { leads, carregando, erro, recarregar: carregar }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- useLeads.test`
Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useLeads.ts src/hooks/useLeads.test.ts
git commit -m "feat: hook useLeads pra carregar a lista de leads

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Lógica pura de drag-and-drop entre colunas

**Files:**
- Create: `src/components/leads/decidirMovimentoLead.ts`
- Create: `src/components/leads/decidirMovimentoLead.test.ts`
- Create: `src/components/leads/coordenadasColuna.ts`
- Create: `src/components/leads/coordenadasColuna.test.ts`

**Interfaces:**
- Consumes: `type ColunaId`, `type TemperaturaLead` (Task 1).
- Produces: `decidirMovimentoLead(over: { id: string | number } | null, colunaAtual: ColunaId): TemperaturaLead | null` e `coordenadasColuna: KeyboardCoordinateGetter` (de `@dnd-kit/core`). Ambas usadas por `KanbanBoard` (Task 5).

Estas duas funções concentram toda a lógica de decisão do drag-and-drop entre colunas. Sendo funções puras (recebem dados já simples — objetos planos e `Map`s — e devolvem um valor), são testadas diretamente, sem precisar renderizar componentes nem mockar `getBoundingClientRect` elemento por elemento. Isso evita a fragilidade de simular geometria de drag multi-coluna via DOM: só o `KanbanBoard` (Task 5) precisa de um teste de integração desse tipo, e só um, pra confirmar a fiação.

- [ ] **Step 1: Escrever os testes de `decidirMovimentoLead` (falhando)**

`src/components/leads/decidirMovimentoLead.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { decidirMovimentoLead } from './decidirMovimentoLead'

describe('decidirMovimentoLead', () => {
  it('retorna a coluna de destino quando é diferente da atual', () => {
    expect(decidirMovimentoLead({ id: 'Quente' }, 'Frio')).toBe('Quente')
  })

  it('retorna null quando não há coluna de destino (drop fora de qualquer coluna)', () => {
    expect(decidirMovimentoLead(null, 'Frio')).toBeNull()
  })

  it('retorna null quando o destino é a coluna "Novo" (bloqueado)', () => {
    expect(decidirMovimentoLead({ id: 'novo' }, 'Frio')).toBeNull()
  })

  it('retorna null quando o destino é a mesma coluna atual (no-op)', () => {
    expect(decidirMovimentoLead({ id: 'Frio' }, 'Frio')).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- decidirMovimentoLead.test`
Expected: FAIL com erro de módulo não encontrado

- [ ] **Step 3: Implementar `decidirMovimentoLead`**

`src/components/leads/decidirMovimentoLead.ts`:

```ts
import type { ColunaId, TemperaturaLead } from '@/lib/leads'

export function decidirMovimentoLead(
  over: { id: string | number } | null,
  colunaAtual: ColunaId
): TemperaturaLead | null {
  if (!over) return null
  if (over.id === 'novo') return null
  if (over.id === colunaAtual) return null
  return over.id as TemperaturaLead
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- decidirMovimentoLead.test`
Expected: PASS (4 testes)

- [ ] **Step 5: Escrever os testes de `coordenadasColuna` (falhando)**

`src/components/leads/coordenadasColuna.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import type { ClientRect, Over, SensorContext } from '@dnd-kit/core'
import { coordenadasColuna } from './coordenadasColuna'

function contexto(overrides: Partial<SensorContext> = {}): SensorContext {
  return {
    activatorEvent: null,
    active: null,
    activeNode: null,
    collisionRect: null,
    collisions: null,
    draggableNodes: new Map(),
    draggingNode: null,
    draggingNodeRect: null,
    droppableRects: new Map(),
    droppableContainers: new Map() as never,
    over: null,
    scrollableAncestors: [],
    scrollAdjustedTranslate: null,
    ...overrides,
  }
}

function rect(left: number): ClientRect {
  return { left, top: 0, width: 300, height: 100, right: left + 300, bottom: 100 } as ClientRect
}

const evento = (code: string) => ({ code, preventDefault: vi.fn() }) as unknown as KeyboardEvent

describe('coordenadasColuna', () => {
  it('ignora teclas que não são seta esquerda/direita', () => {
    const resultado = coordenadasColuna(evento('ArrowUp'), {
      active: 'lead-1',
      currentCoordinates: { x: 300, y: 0 },
      context: contexto(),
    })

    expect(resultado).toBeUndefined()
  })

  it('pula pra coluna mais próxima à direita', () => {
    const droppableRects = new Map([
      ['novo', rect(0)],
      ['Frio', rect(300)],
      ['Morno', rect(600)],
      ['Quente', rect(900)],
    ])

    const resultado = coordenadasColuna(evento('ArrowRight'), {
      active: 'lead-1',
      currentCoordinates: { x: 300, y: 0 },
      context: contexto({
        collisionRect: rect(300),
        droppableRects,
        over: { id: 'Frio' } as Over,
      }),
    })

    expect(resultado).toEqual({ x: 600, y: 0 })
  })

  it('pula pra coluna mais próxima à esquerda', () => {
    const droppableRects = new Map([
      ['novo', rect(0)],
      ['Frio', rect(300)],
      ['Morno', rect(600)],
    ])

    const resultado = coordenadasColuna(evento('ArrowLeft'), {
      active: 'lead-1',
      currentCoordinates: { x: 300, y: 0 },
      context: contexto({
        collisionRect: rect(300),
        droppableRects,
        over: { id: 'Frio' } as Over,
      }),
    })

    expect(resultado).toEqual({ x: 0, y: 0 })
  })

  it('retorna undefined quando não há coluna na direção pressionada', () => {
    const droppableRects = new Map([
      ['novo', rect(0)],
      ['Frio', rect(300)],
    ])

    const resultado = coordenadasColuna(evento('ArrowRight'), {
      active: 'lead-1',
      currentCoordinates: { x: 300, y: 0 },
      context: contexto({
        collisionRect: rect(300),
        droppableRects,
        over: { id: 'Frio' } as Over,
      }),
    })

    expect(resultado).toBeUndefined()
  })

  it('retorna undefined quando ainda não há collisionRect', () => {
    const resultado = coordenadasColuna(evento('ArrowRight'), {
      active: 'lead-1',
      currentCoordinates: { x: 0, y: 0 },
      context: contexto(),
    })

    expect(resultado).toBeUndefined()
  })
})
```

- [ ] **Step 6: Rodar e confirmar que falha**

Run: `npm test -- coordenadasColuna.test`
Expected: FAIL com erro de módulo não encontrado

- [ ] **Step 7: Implementar `coordenadasColuna`**

`src/components/leads/coordenadasColuna.ts`:

```ts
import type { KeyboardCoordinateGetter } from '@dnd-kit/core'

export const coordenadasColuna: KeyboardCoordinateGetter = (event, { context: { collisionRect, droppableRects, over } }) => {
  if (event.code !== 'ArrowLeft' && event.code !== 'ArrowRight') return

  event.preventDefault()
  if (!collisionRect) return

  const direcao = event.code === 'ArrowRight' ? 1 : -1
  const colunaAtualId = over?.id

  let melhorId: string | number | null = null
  let melhorDistancia = Infinity

  droppableRects.forEach((rect, id) => {
    if (id === colunaAtualId) return
    const delta = (rect.left - collisionRect.left) * direcao
    if (delta > 0 && delta < melhorDistancia) {
      melhorDistancia = delta
      melhorId = id
    }
  })

  if (melhorId === null) return

  const rectAlvo = droppableRects.get(melhorId)
  if (!rectAlvo) return

  return { x: rectAlvo.left, y: rectAlvo.top }
}
```

- [ ] **Step 8: Rodar e confirmar que passa**

Run: `npm test -- coordenadasColuna.test`
Expected: PASS (5 testes)

- [ ] **Step 9: Commit**

```bash
git add src/components/leads/decidirMovimentoLead.ts src/components/leads/decidirMovimentoLead.test.ts src/components/leads/coordenadasColuna.ts src/components/leads/coordenadasColuna.test.ts
git commit -m "feat: lógica pura de decisão do drag-and-drop entre colunas do Kanban

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Componente `LeadCard`

**Files:**
- Create: `src/components/leads/LeadCard.tsx`
- Create: `src/components/leads/LeadCard.test.tsx`

**Interfaces:**
- Consumes: `type Lead` (Task 1).
- Produces: `LeadCard` — `{ lead: Lead; onAbrir: () => void }`; `tempoRelativo(dataIso: string, agora?: Date): string` (exportada só pra teste direto). Usado por `KanbanBoard` (Task 5).

- [ ] **Step 1: Escrever o teste (falhando)**

`src/components/leads/LeadCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LeadCard, tempoRelativo } from './LeadCard'
import type { Lead } from '@/lib/leads'

const lead: Lead = {
  id: '1',
  loja_id: 'loja-1',
  nome: 'Maria Silva',
  telefone: '61999990000',
  whatsapp: '556199990000@s.whatsapp.net',
  bot_ativo: true,
  temperatura: 'Frio',
  resumo_diario: 'Perguntou sobre o Civic 2024.',
  data_ultimo_resumo: '2026-09-14',
  created_at: '2026-09-14T10:00:00.000Z',
  updated_at: '2026-09-14T10:00:00.000Z',
}

describe('tempoRelativo', () => {
  it('mostra minutos quando faz menos de uma hora', () => {
    const agora = new Date('2026-09-14T10:30:00.000Z')
    expect(tempoRelativo('2026-09-14T10:00:00.000Z', agora)).toBe('há 30min')
  })

  it('mostra horas quando faz menos de um dia', () => {
    const agora = new Date('2026-09-14T15:00:00.000Z')
    expect(tempoRelativo('2026-09-14T10:00:00.000Z', agora)).toBe('há 5h')
  })

  it('mostra dias quando faz um dia ou mais', () => {
    const agora = new Date('2026-09-16T10:00:00.000Z')
    expect(tempoRelativo('2026-09-14T10:00:00.000Z', agora)).toBe('há 2d')
  })
})

describe('LeadCard', () => {
  it('mostra os dados do lead', () => {
    render(<LeadCard lead={lead} onAbrir={vi.fn()} />)

    expect(screen.getByText('Maria Silva')).toBeInTheDocument()
    expect(screen.getByText('61999990000')).toBeInTheDocument()
    expect(screen.getByText('Perguntou sobre o Civic 2024.')).toBeInTheDocument()
    expect(screen.getByText('Bot ativo')).toBeInTheDocument()
  })

  it('mostra "Sem resumo ainda" quando não há resumo_diario', () => {
    render(<LeadCard lead={{ ...lead, resumo_diario: null }} onAbrir={vi.fn()} />)

    expect(screen.getByText('Sem resumo ainda')).toBeInTheDocument()
  })

  it('mostra "Atendimento humano" quando bot_ativo é false', () => {
    render(<LeadCard lead={{ ...lead, bot_ativo: false }} onAbrir={vi.fn()} />)

    expect(screen.getByText('Atendimento humano')).toBeInTheDocument()
  })

  it('chama onAbrir ao clicar no nome do lead', async () => {
    const onAbrir = vi.fn()
    const usuario = userEvent.setup()
    render(<LeadCard lead={lead} onAbrir={onAbrir} />)

    await usuario.click(screen.getByRole('button', { name: 'Maria Silva' }))

    expect(onAbrir).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- LeadCard.test`
Expected: FAIL com erro de módulo `./LeadCard` não encontrado

- [ ] **Step 3: Implementar**

`src/components/leads/LeadCard.tsx`:

```tsx
import { useDraggable } from '@dnd-kit/core'
import { Badge } from '@/components/ui/badge'
import type { Lead } from '@/lib/leads'

export function tempoRelativo(dataIso: string, agora: Date = new Date()): string {
  const diffMs = agora.getTime() - new Date(dataIso).getTime()
  const minutos = Math.floor(diffMs / 60000)
  if (minutos < 60) return `há ${minutos}min`

  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas}h`

  const dias = Math.floor(horas / 24)
  return `há ${dias}d`
}

interface LeadCardProps {
  lead: Lead
  onAbrir: () => void
}

export function LeadCard({ lead, onAbrir }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id })

  const estilo = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  return (
    <div
      ref={setNodeRef}
      style={estilo}
      className={`flex flex-col gap-1 rounded-md border bg-card p-2 text-sm ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onAbrir} className="text-left font-medium hover:underline">
          {lead.nome || lead.telefone || 'Sem nome'}
        </button>
        <button
          type="button"
          aria-label="Arrastar para outra coluna"
          className="cursor-grab touch-none text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
      </div>
      <span className="text-xs text-muted-foreground">{lead.telefone}</span>
      <p className="line-clamp-2 text-xs text-muted-foreground">{lead.resumo_diario || 'Sem resumo ainda'}</p>
      <div className="flex items-center justify-between">
        <Badge variant={lead.bot_ativo ? 'secondary' : 'default'}>
          {lead.bot_ativo ? 'Bot ativo' : 'Atendimento humano'}
        </Badge>
        <span className="text-xs text-muted-foreground">{tempoRelativo(lead.updated_at)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- LeadCard.test`
Expected: PASS (7 testes)

- [ ] **Step 5: Commit**

```bash
git add src/components/leads/LeadCard.tsx src/components/leads/LeadCard.test.tsx
git commit -m "feat: card de lead arrastável do Kanban

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `KanbanColuna` e `KanbanBoard`

**Files:**
- Create: `src/components/leads/KanbanColuna.tsx`
- Create: `src/components/leads/KanbanBoard.tsx`
- Create: `src/components/leads/KanbanBoard.test.tsx`

**Interfaces:**
- Consumes: `LeadCard` (Task 4), `decidirMovimentoLead`, `coordenadasColuna` (Task 3), `type Lead`, `type TemperaturaLead` (Task 1).
- Produces: `KanbanBoard` — `{ leads: Lead[]; onMoverLead: (leadId: string, novaTemperatura: TemperaturaLead) => void; onAbrirLead: (lead: Lead) => void }`. Usado por `Leads.tsx` (Task 7). `KanbanColuna` não é exportado fora deste diretório — detalhe interno do board, sem teste próprio (coberto pelos testes do board).

- [ ] **Step 1: Implementar `KanbanColuna`**

`src/components/leads/KanbanColuna.tsx`:

```tsx
import type { ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'

interface KanbanColunaProps {
  id: string
  titulo: string
  quantidade: number
  children: ReactNode
}

export function KanbanColuna({ id, titulo, quantidade, children }: KanbanColunaProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      data-testid={`coluna-${id}`}
      className={`flex w-72 shrink-0 flex-col gap-2 rounded-md border p-2 ${isOver ? 'bg-muted' : ''}`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        <span className="text-xs text-muted-foreground">{quantidade}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Escrever os testes de `KanbanBoard` (falhando)**

`src/components/leads/KanbanBoard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { KanbanBoard } from './KanbanBoard'
import type { Lead } from '@/lib/leads'

const leadBase = {
  loja_id: 'loja-1',
  whatsapp: '556199990000@s.whatsapp.net',
  bot_ativo: true,
  resumo_diario: null,
  data_ultimo_resumo: null,
  created_at: '2026-09-14T10:00:00.000Z',
  updated_at: '2026-09-14T10:00:00.000Z',
}

const leads: Lead[] = [
  { ...leadBase, id: '1', nome: 'Lead Novo', telefone: '1', temperatura: null },
  { ...leadBase, id: '2', nome: 'Lead Frio', telefone: '2', temperatura: 'Frio' },
]

// A coluna e o card compartilham o mesmo retângulo (o card "preenche" a
// coluna) — o suficiente pra exercitar a lógica de qual coluna está mais
// próxima em cada direção, sem precisar modelar pixels realistas.
function mockarRetangulosColunas() {
  const ordem = ['novo', 'Frio', 'Morno', 'Quente', 'Agendado']
  const largura = 300

  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const colunaEl = this.closest('[data-testid^="coluna-"]')
    const colunaId = colunaEl?.getAttribute('data-testid')?.replace('coluna-', '') ?? null
    const indice = colunaId ? ordem.indexOf(colunaId) : -1
    const left = indice >= 0 ? indice * largura : 0
    return {
      width: largura,
      height: 80,
      top: 0,
      left,
      right: left + largura,
      bottom: 80,
      x: left,
      y: 0,
      toJSON() {},
    } as DOMRect
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('KanbanBoard', () => {
  it('agrupa os leads nas colunas certas, incluindo temperatura nula em "Novo"', () => {
    render(<KanbanBoard leads={leads} onMoverLead={vi.fn()} onAbrirLead={vi.fn()} />)

    expect(within(screen.getByTestId('coluna-novo')).getByText('Lead Novo')).toBeInTheDocument()
    expect(within(screen.getByTestId('coluna-Frio')).getByText('Lead Frio')).toBeInTheDocument()
  })

  it('move um lead pra coluna da direita via teclado', async () => {
    mockarRetangulosColunas()
    const onMoverLead = vi.fn()
    render(<KanbanBoard leads={leads} onMoverLead={onMoverLead} onAbrirLead={vi.fn()} />)

    const alca = within(screen.getByTestId('coluna-Frio')).getByRole('button', {
      name: /arrastar para outra coluna/i,
    })
    alca.focus()

    fireEvent.keyDown(alca, { code: 'Space' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    fireEvent.keyDown(alca, { code: 'ArrowRight' })
    fireEvent.keyDown(alca, { code: 'Space' })

    expect(onMoverLead).toHaveBeenCalledWith('2', 'Morno')
  })

  it('chama onAbrirLead ao clicar no nome de um lead', async () => {
    const onAbrirLead = vi.fn()
    render(<KanbanBoard leads={leads} onMoverLead={vi.fn()} onAbrirLead={onAbrirLead} />)

    screen.getByRole('button', { name: 'Lead Frio' }).click()

    expect(onAbrirLead).toHaveBeenCalledWith(leads[1])
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -- KanbanBoard.test`
Expected: FAIL com erro de módulo `./KanbanBoard` não encontrado

- [ ] **Step 4: Implementar `KanbanBoard`**

`src/components/leads/KanbanBoard.tsx`:

```tsx
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { KanbanColuna } from './KanbanColuna'
import { LeadCard } from './LeadCard'
import { coordenadasColuna } from './coordenadasColuna'
import { decidirMovimentoLead } from './decidirMovimentoLead'
import type { ColunaId, Lead, TemperaturaLead } from '@/lib/leads'

const COLUNAS: { id: ColunaId; titulo: string }[] = [
  { id: 'novo', titulo: 'Novo' },
  { id: 'Frio', titulo: 'Frio' },
  { id: 'Morno', titulo: 'Morno' },
  { id: 'Quente', titulo: 'Quente' },
  { id: 'Agendado', titulo: 'Agendado' },
]

interface KanbanBoardProps {
  leads: Lead[]
  onMoverLead: (leadId: string, novaTemperatura: TemperaturaLead) => void
  onAbrirLead: (lead: Lead) => void
}

export function KanbanBoard({ leads, onMoverLead, onAbrirLead }: KanbanBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: coordenadasColuna })
  )

  function aoTerminarDrag(evento: DragEndEvent) {
    const lead = leads.find((l) => l.id === evento.active.id)
    if (!lead) return

    const destino = decidirMovimentoLead(evento.over, lead.temperatura ?? 'novo')
    if (destino) onMoverLead(lead.id, destino)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={aoTerminarDrag}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUNAS.map((coluna) => {
          const leadsColuna = leads.filter((lead) => (lead.temperatura ?? 'novo') === coluna.id)
          return (
            <KanbanColuna key={coluna.id} id={coluna.id} titulo={coluna.titulo} quantidade={leadsColuna.length}>
              {leadsColuna.map((lead) => (
                <LeadCard key={lead.id} lead={lead} onAbrir={() => onAbrirLead(lead)} />
              ))}
            </KanbanColuna>
          )
        })}
      </div>
    </DndContext>
  )
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm test -- KanbanBoard.test`
Expected: PASS (3 testes)

- [ ] **Step 6: Commit**

```bash
git add src/components/leads/KanbanColuna.tsx src/components/leads/KanbanBoard.tsx src/components/leads/KanbanBoard.test.tsx
git commit -m "feat: board Kanban de leads com drag-and-drop entre colunas

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `PainelConversaLead` (drawer com histórico e assumir/devolver)

**Files:**
- Create: `src/components/ui/sheet.tsx` (gerado pelo shadcn CLI)
- Create: `src/components/leads/PainelConversaLead.tsx`
- Create: `src/components/leads/PainelConversaLead.test.tsx`

**Interfaces:**
- Consumes: `getInteracoes`, `setLeadBotAtivo`, `type Lead`, `type Interacao` (Task 1).
- Produces: `PainelConversaLead` — `{ lead: Lead | null; onFechar: () => void; onBotAtivoAlterado: (leadId: string, ativo: boolean) => void }`. Usado por `Leads.tsx` (Task 7).

- [ ] **Step 1: Instalar o componente `Sheet` do shadcn**

```bash
npx shadcn@latest add sheet
```

Isso cria `src/components/ui/sheet.tsx`, exportando `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle` (entre outros), seguindo a mesma convenção do `dialog.tsx` já existente neste projeto (`Sheet` aceita `open`/`onOpenChange`, `SheetContent` aceita `side="right"`). Se os nomes exportados pelo CLI vierem diferentes disso, ajustar os imports do Step 3 pra usar os nomes reais gerados.

- [ ] **Step 2: Escrever os testes (falhando)**

`src/components/leads/PainelConversaLead.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PainelConversaLead } from './PainelConversaLead'
import { getInteracoes, setLeadBotAtivo, type Lead, type Interacao } from '@/lib/leads'

vi.mock('@/lib/leads', async () => {
  const real = await vi.importActual<typeof import('@/lib/leads')>('@/lib/leads')
  return { ...real, getInteracoes: vi.fn(), setLeadBotAtivo: vi.fn() }
})

const lead: Lead = {
  id: '1',
  loja_id: 'loja-1',
  nome: 'Maria Silva',
  telefone: '61999990000',
  whatsapp: '556199990000@s.whatsapp.net',
  bot_ativo: true,
  temperatura: 'Frio',
  resumo_diario: null,
  data_ultimo_resumo: null,
  created_at: '2026-09-14T10:00:00.000Z',
  updated_at: '2026-09-14T10:00:00.000Z',
}

const interacoes: Interacao[] = [
  { id: '1', lead_id: '1', remetente: 'LEAD', tipo: 'conversation', conteudo: 'Oi, quero saber do Civic', created_at: '2026-09-14T10:00:00.000Z' },
  { id: '2', lead_id: '1', remetente: 'BOT', tipo: 'conversation', conteudo: 'Temos um Civic 2024!', created_at: '2026-09-14T10:01:00.000Z' },
]

beforeEach(() => {
  vi.mocked(getInteracoes).mockReset()
  vi.mocked(setLeadBotAtivo).mockReset()
})

describe('PainelConversaLead', () => {
  it('não renderiza nada quando lead é null', () => {
    render(<PainelConversaLead lead={null} onFechar={vi.fn()} onBotAtivoAlterado={vi.fn()} />)

    expect(screen.queryByText('Assumir conversa')).not.toBeInTheDocument()
  })

  it('busca e mostra o histórico do lead selecionado, em ordem', async () => {
    vi.mocked(getInteracoes).mockResolvedValue(interacoes)

    render(<PainelConversaLead lead={lead} onFechar={vi.fn()} onBotAtivoAlterado={vi.fn()} />)

    expect(getInteracoes).toHaveBeenCalledWith('1')
    const mensagens = await screen.findAllByText(/Oi, quero saber do Civic|Temos um Civic 2024!/)
    expect(mensagens.map((m) => m.textContent)).toEqual(['Oi, quero saber do Civic', 'Temos um Civic 2024!'])
  })

  it('mostra "Assumir conversa" quando bot_ativo é true, e grava false ao clicar', async () => {
    vi.mocked(getInteracoes).mockResolvedValue([])
    vi.mocked(setLeadBotAtivo).mockResolvedValue(undefined)
    const onBotAtivoAlterado = vi.fn()
    const usuario = userEvent.setup()

    render(<PainelConversaLead lead={lead} onFechar={vi.fn()} onBotAtivoAlterado={onBotAtivoAlterado} />)

    await usuario.click(await screen.findByRole('button', { name: 'Assumir conversa' }))

    expect(setLeadBotAtivo).toHaveBeenCalledWith('1', false)
    await waitFor(() => expect(onBotAtivoAlterado).toHaveBeenCalledWith('1', false))
  })

  it('mostra "Devolver ao robô" quando bot_ativo é false, e grava true ao clicar', async () => {
    vi.mocked(getInteracoes).mockResolvedValue([])
    vi.mocked(setLeadBotAtivo).mockResolvedValue(undefined)
    const usuario = userEvent.setup()

    render(
      <PainelConversaLead lead={{ ...lead, bot_ativo: false }} onFechar={vi.fn()} onBotAtivoAlterado={vi.fn()} />
    )

    await usuario.click(await screen.findByRole('button', { name: 'Devolver ao robô' }))

    expect(setLeadBotAtivo).toHaveBeenCalledWith('1', true)
  })

  it('mostra erro inline quando falha ao alternar o bot', async () => {
    vi.mocked(getInteracoes).mockResolvedValue([])
    vi.mocked(setLeadBotAtivo).mockRejectedValue(new Error('falha de rede'))
    const usuario = userEvent.setup()

    render(<PainelConversaLead lead={lead} onFechar={vi.fn()} onBotAtivoAlterado={vi.fn()} />)

    await usuario.click(await screen.findByRole('button', { name: 'Assumir conversa' }))

    expect(await screen.findByText('falha de rede')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -- PainelConversaLead.test`
Expected: FAIL com erro de módulo `./PainelConversaLead` não encontrado

- [ ] **Step 4: Implementar**

`src/components/leads/PainelConversaLead.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { getInteracoes, setLeadBotAtivo, type Lead, type Interacao } from '@/lib/leads'

const ROTULO_TIPO: Record<string, string> = {
  audioMessage: '🎤 Áudio',
  imageMessage: '🖼️ Imagem',
}

interface PainelConversaLeadProps {
  lead: Lead | null
  onFechar: () => void
  onBotAtivoAlterado: (leadId: string, ativo: boolean) => void
}

export function PainelConversaLead({ lead, onFechar, onBotAtivoAlterado }: PainelConversaLeadProps) {
  const [interacoes, setInteracoes] = useState<Interacao[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [alternandoBot, setAlternandoBot] = useState(false)

  useEffect(() => {
    if (!lead) return
    setCarregando(true)
    setErro(null)
    getInteracoes(lead.id)
      .then(setInteracoes)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [lead])

  async function alternarBot() {
    if (!lead) return
    const novoValor = !lead.bot_ativo
    setAlternandoBot(true)
    setErro(null)
    try {
      await setLeadBotAtivo(lead.id, novoValor)
      onBotAtivoAlterado(lead.id, novoValor)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setAlternandoBot(false)
    }
  }

  return (
    <Sheet
      open={lead !== null}
      onOpenChange={(aberto: boolean) => {
        if (!aberto) onFechar()
      }}
    >
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{lead?.nome || lead?.telefone || 'Lead'}</SheetTitle>
        </SheetHeader>

        {erro && (
          <p role="alert" className="px-4 text-sm text-destructive">
            {erro}
          </p>
        )}

        {carregando && <p className="px-4 text-sm text-muted-foreground">Carregando histórico...</p>}

        {!carregando && (
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4">
            {interacoes.map((interacao) => (
              <div
                key={interacao.id}
                className={`max-w-[80%] rounded-md p-2 text-sm ${
                  interacao.remetente === 'LEAD'
                    ? 'self-start bg-muted'
                    : 'self-end bg-primary text-primary-foreground'
                }`}
              >
                {ROTULO_TIPO[interacao.tipo] ?? interacao.conteudo}
              </div>
            ))}
          </div>
        )}

        {lead && (
          <div className="p-4">
            <Button onClick={alternarBot} disabled={alternandoBot} className="w-full">
              {lead.bot_ativo ? 'Assumir conversa' : 'Devolver ao robô'}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm test -- PainelConversaLead.test`
Expected: PASS (6 testes)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/ui/sheet.tsx src/components/leads/PainelConversaLead.tsx src/components/leads/PainelConversaLead.test.tsx
git commit -m "feat: painel lateral com histórico de conversa e assumir/devolver bot

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Integração final — página `/leads`

**Files:**
- Create: `src/pages/Leads.tsx`
- Create: `src/pages/Leads.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/Dashboard.tsx`

**Interfaces:**
- Consumes: `useLeads` (Task 2); `updateLeadTemperatura` (Task 1); `KanbanBoard` (Task 5); `PainelConversaLead` (Task 6).
- Produces: nenhuma nova — é a tela final.

- [ ] **Step 1: Escrever os testes (falhando)**

`src/pages/Leads.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LeadsPage from '@/pages/Leads'
import { getLeads, updateLeadTemperatura } from '@/lib/leads'

vi.mock('@/lib/leads', async () => {
  const real = await vi.importActual<typeof import('@/lib/leads')>('@/lib/leads')
  return { ...real, getLeads: vi.fn(), updateLeadTemperatura: vi.fn(), getInteracoes: vi.fn().mockResolvedValue([]) }
})

const leadBase = {
  loja_id: 'loja-1',
  whatsapp: '556199990000@s.whatsapp.net',
  bot_ativo: true,
  resumo_diario: null,
  data_ultimo_resumo: null,
  created_at: '2026-09-14T10:00:00.000Z',
  updated_at: '2026-09-14T10:00:00.000Z',
}

beforeEach(() => {
  vi.mocked(getLeads).mockReset()
  vi.mocked(updateLeadTemperatura).mockReset()
})

function renderPagina() {
  return render(
    <MemoryRouter>
      <LeadsPage />
    </MemoryRouter>
  )
}

describe('LeadsPage', () => {
  it('mostra estado de carregamento e depois o board', async () => {
    vi.mocked(getLeads).mockResolvedValue([
      { ...leadBase, id: '1', nome: 'Maria Silva', telefone: '1', temperatura: 'Frio' },
    ])

    renderPagina()

    expect(screen.getByText(/carregando/i)).toBeInTheDocument()
    expect(await screen.findByText('Maria Silva')).toBeInTheDocument()
  })

  it('mostra erro com botão de tentar novamente', async () => {
    vi.mocked(getLeads).mockRejectedValue(new Error('falha de rede'))

    renderPagina()

    expect(await screen.findByText('falha de rede')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument()
  })

  it('abre o painel lateral ao clicar num lead', async () => {
    vi.mocked(getLeads).mockResolvedValue([
      { ...leadBase, id: '1', nome: 'Maria Silva', telefone: '1', temperatura: 'Frio' },
    ])

    renderPagina()

    screen.getByRole('button', { name: 'Maria Silva' }).click()

    expect(await screen.findByRole('button', { name: 'Assumir conversa' })).toBeInTheDocument()
  })
})
```

`Leads.test.tsx` cobre só carregamento, erro e abertura do painel lateral — a lógica de reversão otimista em `moverLead` (Step 3 abaixo) segue o mesmo padrão já coberto por teste em `Veiculos.tsx` (`aoReordenar`/reversão em caso de falha), e a decisão de "pra qual coluna mover" já está isolada e testada em `decidirMovimentoLead` (Task 3) e na fiação do `KanbanBoard` (Task 5) — testar a reversão de novo aqui exigiria duplicar o mock de geometria de drag só pra esta página, sem cobrir nenhum comportamento novo.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- Leads.test`
Expected: FAIL com erro de módulo `@/pages/Leads` não encontrado

- [ ] **Step 3: Implementar a página**

`src/pages/Leads.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useLeads } from '@/hooks/useLeads'
import { updateLeadTemperatura, type Lead, type TemperaturaLead } from '@/lib/leads'
import { KanbanBoard } from '@/components/leads/KanbanBoard'
import { PainelConversaLead } from '@/components/leads/PainelConversaLead'
import { Button } from '@/components/ui/button'

export default function LeadsPage() {
  const { leads, carregando, erro, recarregar } = useLeads()
  const [leadsExibidos, setLeadsExibidos] = useState<Lead[]>([])
  const [erroMovimento, setErroMovimento] = useState<string | null>(null)
  const [leadSelecionadoId, setLeadSelecionadoId] = useState<string | null>(null)

  useEffect(() => {
    setLeadsExibidos(leads)
  }, [leads])

  async function moverLead(leadId: string, novaTemperatura: TemperaturaLead) {
    const anterior = leadsExibidos
    setErroMovimento(null)
    setLeadsExibidos((atual) => atual.map((l) => (l.id === leadId ? { ...l, temperatura: novaTemperatura } : l)))

    try {
      await updateLeadTemperatura(leadId, novaTemperatura)
    } catch (e) {
      setLeadsExibidos(anterior)
      setErroMovimento((e as Error).message)
    }
  }

  function botAtivoAlterado(leadId: string, ativo: boolean) {
    setLeadsExibidos((atual) => atual.map((l) => (l.id === leadId ? { ...l, bot_ativo: ativo } : l)))
  }

  const leadSelecionado = leadsExibidos.find((l) => l.id === leadSelecionadoId) ?? null

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">CRM</h1>

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

      {!carregando && !erro && (
        <>
          {erroMovimento && (
            <p role="alert" className="text-sm text-destructive">
              {erroMovimento}
            </p>
          )}
          <KanbanBoard leads={leadsExibidos} onMoverLead={moverLead} onAbrirLead={(lead) => setLeadSelecionadoId(lead.id)} />
        </>
      )}

      <PainelConversaLead
        lead={leadSelecionado}
        onFechar={() => setLeadSelecionadoId(null)}
        onBotAtivoAlterado={botAtivoAlterado}
      />
    </div>
  )
}
```

`leadsExibidos` sincroniza com `leads` (do hook) via `useEffect`, mesmo padrão já usado em `Veiculos.tsx` pra `disponiveis`: sempre que `useLeads` completa uma nova busca (no mount ou após `recarregar()`), `leadsExibidos` é substituído pela lista fresca; entre uma busca e outra, `leadsExibidos` é a fonte da verdade e recebe as mudanças otimistas de `temperatura`/`bot_ativo`.

- [ ] **Step 4: Adicionar a rota em `src/App.tsx`**

Adicionar o import:

```tsx
import LeadsPage from '@/pages/Leads'
```

E a rota, logo depois da rota `/veiculos/:id/editar`:

```tsx
      <Route
        path="/leads"
        element={
          <ProtectedRoute>
            <LeadsPage />
          </ProtectedRoute>
        }
      />
```

- [ ] **Step 5: Adicionar o link no Dashboard (`src/pages/Dashboard.tsx`)**

Adicionar, logo depois do link "Ver veículos":

```tsx
      <Link to="/leads" className="underline">
        CRM
      </Link>
```

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `npm test -- Leads.test`
Expected: PASS (3 testes)

- [ ] **Step 7: Rodar a suíte inteira, o type-check e o lint**

Run: `npm test`
Expected: PASS (todos os arquivos, incluindo os das Tasks 1-6)

Run: `npx tsc -b`
Expected: sem erros

Run: `npm run lint`
Expected: sem erros novos

- [ ] **Step 8: Verificação manual**

Run: `npm run dev`, acessar `/leads` com pelo menos dois leads cadastrados (um com `temperatura` `NULL` e outro com algum valor). Confirmar que:
- as 5 colunas aparecem, cada lead na coluna certa;
- arrastar um card (mouse) pra outra coluna persiste a nova temperatura — recarregar a página e confirmar que se manteve;
- arrastar um card pra "Novo" não move nada (volta pro lugar);
- clicar no nome de um lead abre o painel lateral com o histórico de `Interacoes` e o botão "Assumir conversa"/"Devolver ao robô", e clicar nele grava `bot_ativo` (conferir no Supabase);
- com foco na alça de um card, `Space` → seta → `Space` também move o card.

- [ ] **Step 9: Commit**

```bash
git add src/pages/Leads.tsx src/pages/Leads.test.tsx src/App.tsx src/pages/Dashboard.tsx
git commit -m "feat: página /leads com board Kanban e painel de conversa (Dashboard CRM)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Atualizar o roteiro em `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** nenhuma — só documentação.

- [ ] **Step 1: Adicionar a referência da spec/plano**

Em `CLAUDE.md`, logo depois das linhas:

```
Spec de Vitrine pública: `docs/superpowers/specs/2026-09-14-vitrine-publica-design.md`
Plano de implementação de Vitrine pública: `docs/superpowers/plans/2026-09-14-vitrine-publica.md`
```

adicionar:

```

Spec de Dashboard CRM: `docs/superpowers/specs/2026-09-15-dashboard-crm-design.md`
Plano de implementação de Dashboard CRM: `docs/superpowers/plans/2026-09-15-dashboard-crm.md`
```

- [ ] **Step 2: Marcar o item 4 como completo**

Trocar a linha:

```
4. Dashboard CRM (histórico de conversa, temperatura do lead, assumir conversa manualmente).
```

por:

```
4. ~~Dashboard CRM~~ ✅ completo.
```

E atualizar a seção "Estado atual" pra refletir que o CRM está no ar, seguindo o mesmo formato usado pras entregas anteriores.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: marca Dashboard CRM (item 4) como completo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

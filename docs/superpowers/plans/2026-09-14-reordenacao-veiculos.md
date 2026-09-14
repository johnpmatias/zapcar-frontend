# Reordenação Manual dos Veículos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o lojista reordenar manualmente, por arrastar-e-soltar (mouse, toque ou teclado), os veículos com status `disponivel`/`reservado` em `/veiculos`, persistindo a ordem escolhida na coluna `ordem` já existente na tabela `veiculos`.

**Architecture:** Uma função nova em `src/lib/veiculos.ts` (`reorderVeiculos`) grava a ordem; a listagem passa a pedir os veículos já ordenados por `ordem`. Um componente genérico `ListaReordenavel` (dnd-kit) cuida só da mecânica de arrastar; a linha visual de cada veículo é extraída para `LinhaVeiculo`, reaproveitada tanto na lista reordenável quanto na lista estática de vendidos/inativos. `Veiculos.tsx` orquestra tudo: separa os veículos em duas seções por status e persiste a nova ordem de forma otimista (grava no Supabase ao soltar, sem botão de salvar).

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui (`base-nova`) + React Router 7 + `@supabase/supabase-js` + Vitest + React Testing Library, mais uma dependência nova: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`.

**Spec:** `docs/superpowers/specs/2026-09-14-reordenacao-veiculos-design.md`

## Global Constraints

- Usar sempre a chave **publishable** do Supabase (`VITE_SUPABASE_PUBLISHABLE_KEY`), nunca a `secret key`.
- TDD em todo arquivo de lógica e componente: teste escrito e falhando antes da implementação.
- **shadcn `Button` deste projeto não tem prop `asChild`** (primitivas `@base-ui/react`) — usar a prop `render` quando precisar envolver um `Link` (já usado no restante da tela, ver `LinhaVeiculo`).
- Toda mensagem de commit termina com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Nenhuma migration necessária — a coluna `ordem` (int4, default `0`) já existe na tabela `veiculos` desde o CRUD de veículos.
- Biblioteca de drag-and-drop: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` (decisão registrada na spec — suporte a toque e teclado, ao contrário da API HTML5 nativa).
- **Testando drag-and-drop do dnd-kit com teclado:** o `KeyboardSensor` só registra o listener que trata as setas dentro de um `setTimeout(0)` logo após a tecla de ativação (`Space`), então todo teste de reordenação por teclado precisa de um `await new Promise((resolve) => setTimeout(resolve, 0))` entre o `fireEvent.keyDown` de ativação e o de movimento. Além disso, o cálculo de "próximo item na direção pressionada" depende de `getBoundingClientRect()`, que o jsdom sempre retorna zerado — os testes que arrastam de verdade precisam mockar `HTMLElement.prototype.getBoundingClientRect` com um retângulo por item, calculado pela posição real do elemento no DOM (não por um contador, porque o dnd-kit mede os retângulos várias vezes por interação).

---

## Task 1: Camada de dados — ordenação por `ordem` e `reorderVeiculos`

**Files:**
- Modify: `src/lib/veiculos.ts`
- Modify: `src/lib/veiculos.test.ts`

**Interfaces:**
- Consumes: nenhuma nova (usa `supabase` de `@/lib/supabase`, já mockado no teste existente).
- Produces: `listVeiculos()` passa a ordenar por `ordem asc, created_at desc` (assinatura inalterada); `reorderVeiculos(atualizacoes: { id: string; ordem: number }[]): Promise<void>` — usada pela página (Task 4).

- [ ] **Step 1: Escrever os testes (falhando)**

Em `src/lib/veiculos.test.ts`, trocar o import do topo do arquivo por:

```ts
import {
  listVeiculos,
  getVeiculo,
  createVeiculo,
  updateVeiculo,
  deleteVeiculo,
  reorderVeiculos,
  type VeiculoPayload,
} from '@/lib/veiculos'
```

Substituir o bloco `describe('listVeiculos', ...)` inteiro (as duas primeiras `it`s do arquivo) por:

```ts
describe('listVeiculos', () => {
  it('ordena por ordem manual, com data de criação como desempate', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    }
    builder.order.mockReturnValueOnce(builder).mockResolvedValueOnce({
      data: [{ id: '1', ...payloadExemplo }],
      error: null,
    })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const resultado = await listVeiculos()

    expect(supabase.from).toHaveBeenCalledWith('veiculos')
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.order).toHaveBeenNthCalledWith(1, 'ordem', { ascending: true })
    expect(builder.order).toHaveBeenNthCalledWith(2, 'created_at', { ascending: false })
    expect(resultado).toHaveLength(1)
  })

  it('lança erro quando o Supabase retorna erro', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    }
    builder.order.mockReturnValueOnce(builder).mockResolvedValueOnce({
      data: null,
      error: { message: 'falha de rede' },
    })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await expect(listVeiculos()).rejects.toThrow('falha de rede')
  })
})

describe('reorderVeiculos', () => {
  it('atualiza a ordem de cada veículo alterado', async () => {
    const builder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await reorderVeiculos([
      { id: '1', ordem: 0 },
      { id: '2', ordem: 1 },
    ])

    expect(builder.update).toHaveBeenNthCalledWith(1, { ordem: 0 })
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'id', '1')
    expect(builder.update).toHaveBeenNthCalledWith(2, { ordem: 1 })
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'id', '2')
  })

  it('lança erro quando algum update falha', async () => {
    const builder = {
      update: vi.fn().mockReturnThis(),
      eq: vi
        .fn()
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: { message: 'falha de rede' } }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await expect(
      reorderVeiculos([
        { id: '1', ordem: 0 },
        { id: '2', ordem: 1 },
      ])
    ).rejects.toThrow('falha de rede')
  })
})
```

O resto do arquivo (`payloadExemplo`, `beforeEach`, `describe('getVeiculo', ...)` em diante) não muda.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- veiculos.test`
Expected: FAIL — `reorderVeiculos` não existe em `@/lib/veiculos`, e as duas asserções de `builder.order` com `toHaveBeenNthCalledWith` falham porque `listVeiculos` ainda só chama `order` uma vez.

- [ ] **Step 3: Implementar**

Em `src/lib/veiculos.ts`, substituir a função `listVeiculos` por:

```ts
export async function listVeiculos(): Promise<Veiculo[]> {
  const { data, error } = await supabase
    .from('veiculos')
    .select('*')
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Veiculo[]
}

export async function reorderVeiculos(atualizacoes: { id: string; ordem: number }[]): Promise<void> {
  const resultados = await Promise.all(
    atualizacoes.map(({ id, ordem }) => supabase.from('veiculos').update({ ordem }).eq('id', id))
  )

  const comErro = resultados.find((resultado) => resultado.error)
  if (comErro?.error) throw new Error(comErro.error.message)
}
```

`reorderVeiculos` é adicionada logo depois, como uma nova função exportada no mesmo arquivo.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- veiculos.test`
Expected: PASS (11 testes: 9 já existentes + 2 novos de `reorderVeiculos`, mais a reescrita das 2 de `listVeiculos`)

- [ ] **Step 5: Commit**

```bash
git add src/lib/veiculos.ts src/lib/veiculos.test.ts
git commit -m "feat: ordena veículos por ordem manual e adiciona reorderVeiculos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Componente `LinhaVeiculo` (extração)

**Files:**
- Create: `src/components/veiculos/LinhaVeiculo.tsx`
- Create: `src/components/veiculos/LinhaVeiculo.test.tsx`

**Interfaces:**
- Consumes: `type Veiculo` (Task 1, já existente em `@/lib/veiculos`).
- Produces: `LinhaVeiculo` — `{ veiculo: Veiculo; excluindoId: string | null; onExcluir: (id: string) => void }`. Usado por `ListaReordenavel` (via `renderItem`, Task 3) e diretamente pela seção estática em `Veiculos.tsx` (Task 4).

Esta é a mesma linha de informação (marca, modelo, ano, preço, status, Editar/Excluir) que hoje existe inline dentro de `<tr>`/`<td>` em `Veiculos.tsx`, extraída pra um componente próprio porque vai ser usada em dois lugares (lista reordenável e lista estática) — ver decisão na spec sobre trocar a `<table>` por listas de cards.

- [ ] **Step 1: Escrever o teste (falhando)**

`src/components/veiculos/LinhaVeiculo.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LinhaVeiculo } from './LinhaVeiculo'
import type { Veiculo } from '@/lib/veiculos'

const veiculo = {
  id: '1',
  marca: 'Honda',
  modelo: 'Civic',
  ano_modelo: 2024,
  preco: 95000,
  status: 'disponivel',
} as Veiculo

function renderComponente(excluindoId: string | null = null, onExcluir = vi.fn()) {
  return render(
    <MemoryRouter>
      <LinhaVeiculo veiculo={veiculo} excluindoId={excluindoId} onExcluir={onExcluir} />
    </MemoryRouter>
  )
}

describe('LinhaVeiculo', () => {
  it('mostra os dados do veículo', () => {
    renderComponente()

    expect(screen.getByText('Honda')).toBeInTheDocument()
    expect(screen.getByText('Civic')).toBeInTheDocument()
    expect(screen.getByText('disponivel')).toBeInTheDocument()
  })

  it('chama onExcluir com o id após confirmação', async () => {
    const onExcluir = vi.fn()
    const usuario = userEvent.setup()
    renderComponente(null, onExcluir)

    await usuario.click(screen.getByRole('button', { name: /excluir/i }))
    await usuario.click(screen.getByRole('button', { name: /confirmar exclusão/i }))

    expect(onExcluir).toHaveBeenCalledWith('1')
  })

  it('desabilita o botão de confirmar quando excluindoId bate com o veículo', async () => {
    const usuario = userEvent.setup()
    renderComponente('1')

    await usuario.click(screen.getByRole('button', { name: /excluir/i }))

    expect(screen.getByRole('button', { name: /confirmar exclusão/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- LinhaVeiculo.test`
Expected: FAIL com erro de módulo `./LinhaVeiculo` não encontrado

- [ ] **Step 3: Implementar**

`src/components/veiculos/LinhaVeiculo.tsx`:

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
}

export function LinhaVeiculo({ veiculo, excluindoId, onExcluir }: LinhaVeiculoProps) {
  return (
    <div className="flex flex-1 flex-wrap items-center justify-between gap-2 text-sm">
      <div className="flex flex-1 flex-wrap gap-4">
        <span>{veiculo.marca}</span>
        <span>{veiculo.modelo}</span>
        <span>{veiculo.ano_modelo}</span>
        <span>{veiculo.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        <span>{veiculo.status}</span>
      </div>
      <div className="flex items-center gap-2">
        <Link to={`/veiculos/${veiculo.id}/editar`} className="underline">
          Editar
        </Link>
        <Dialog>
          <DialogTrigger render={<Button variant="destructive" size="sm" />}>Excluir</DialogTrigger>
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

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- LinhaVeiculo.test`
Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add src/components/veiculos/LinhaVeiculo.tsx src/components/veiculos/LinhaVeiculo.test.tsx
git commit -m "feat: extrai LinhaVeiculo pra reaproveitar entre lista reordenável e estática

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Componente `ListaReordenavel` (drag-and-drop com dnd-kit)

**Files:**
- Create: `src/components/veiculos/ListaReordenavel.tsx`
- Create: `src/components/veiculos/ListaReordenavel.test.tsx`

**Interfaces:**
- Consumes: nenhuma (componente genérico, não sabe nada sobre `Veiculo`).
- Produces: `ListaReordenavel<T extends { id: string }>` — props `{ itens: T[]; onReordenar: (novaOrdem: T[]) => void; renderItem: (item: T) => ReactNode }`. Usado por `Veiculos.tsx` (Task 4) com `T = Veiculo` e `renderItem` passando `LinhaVeiculo` (Task 2).

- [ ] **Step 1: Instalar as dependências**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Escrever os testes (falhando)**

`src/components/veiculos/ListaReordenavel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ListaReordenavel } from './ListaReordenavel'

interface ItemTeste {
  id: string
  nome: string
}

const itens: ItemTeste[] = [
  { id: '1', nome: 'Primeiro' },
  { id: '2', nome: 'Segundo' },
  { id: '3', nome: 'Terceiro' },
]

// dnd-kit mede a posição de cada item arrastável via getBoundingClientRect pra
// decidir, ao pressionar uma seta, qual é o "próximo" item na direção
// pressionada. jsdom retorna 0 pra tudo por padrão, então sem esse mock todos
// os itens teriam o mesmo retângulo e o sensor de teclado não encontraria uma
// posição diferente pra mover — o índice é lido pela posição real do item no
// DOM (não por um contador), porque dnd-kit mede os retângulos várias vezes
// por interação.
function mockarRetangulos() {
  const alturaItem = 50
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement
  ) {
    const itensNoDom = Array.from(document.querySelectorAll<HTMLElement>('li'))
    const indice = itensNoDom.indexOf(this)
    const topo = indice >= 0 ? indice * alturaItem : 0
    return {
      width: 300,
      height: alturaItem,
      top: topo,
      left: 0,
      right: 300,
      bottom: topo + alturaItem,
      x: 0,
      y: topo,
      toJSON() {},
    } as DOMRect
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('ListaReordenavel', () => {
  it('renderiza os itens na ordem recebida', () => {
    render(<ListaReordenavel itens={itens} onReordenar={vi.fn()} renderItem={(item) => item.nome} />)

    const linhas = screen.getAllByRole('listitem')
    expect(linhas.map((linha) => linha.textContent)).toEqual(['Primeiro', 'Segundo', 'Terceiro'])
  })

  it('move um item pra baixo via teclado e chama onReordenar com a nova ordem', async () => {
    mockarRetangulos()
    const aoReordenar = vi.fn()
    render(<ListaReordenavel itens={itens} onReordenar={aoReordenar} renderItem={(item) => item.nome} />)

    const [alcaPrimeiro] = screen.getAllByRole('button', { name: /arrastar para reordenar/i })
    alcaPrimeiro.focus()

    // Space ativa o modo de arrastar do dnd-kit. O listener de teclado que
    // trata as setas só é registrado num setTimeout(0) logo após a ativação
    // (ver KeyboardSensor.attach em @dnd-kit/core) — por isso é preciso
    // esperar um tick antes de disparar a seta, senão ela chega cedo demais
    // e é ignorada.
    fireEvent.keyDown(alcaPrimeiro, { code: 'Space' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    fireEvent.keyDown(alcaPrimeiro, { code: 'ArrowDown' })
    fireEvent.keyDown(alcaPrimeiro, { code: 'Space' })

    expect(aoReordenar).toHaveBeenCalledWith([
      { id: '2', nome: 'Segundo' },
      { id: '1', nome: 'Primeiro' },
      { id: '3', nome: 'Terceiro' },
    ])
  })

  it('não chama onReordenar quando o item é solto na mesma posição', async () => {
    mockarRetangulos()
    const aoReordenar = vi.fn()
    render(<ListaReordenavel itens={itens} onReordenar={aoReordenar} renderItem={(item) => item.nome} />)

    const [alcaPrimeiro] = screen.getAllByRole('button', { name: /arrastar para reordenar/i })
    alcaPrimeiro.focus()

    fireEvent.keyDown(alcaPrimeiro, { code: 'Space' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    fireEvent.keyDown(alcaPrimeiro, { code: 'Space' })

    expect(aoReordenar).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -- ListaReordenavel.test`
Expected: FAIL com erro de módulo `./ListaReordenavel` não encontrado

- [ ] **Step 4: Implementar**

`src/components/veiculos/ListaReordenavel.tsx`:

```tsx
import type { ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

interface ItemComId {
  id: string
}

interface ListaReordenavelProps<T extends ItemComId> {
  itens: T[]
  onReordenar: (novaOrdem: T[]) => void
  renderItem: (item: T) => ReactNode
}

export function ListaReordenavel<T extends ItemComId>({
  itens,
  onReordenar,
  renderItem,
}: ListaReordenavelProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function aoTerminarDrag(evento: DragEndEvent) {
    const { active, over } = evento
    if (!over || active.id === over.id) return

    const indiceAntigo = itens.findIndex((item) => item.id === active.id)
    const indiceNovo = itens.findIndex((item) => item.id === over.id)
    onReordenar(arrayMove(itens, indiceAntigo, indiceNovo))
  }

  return (
    <DndContext sensors={sensors} onDragEnd={aoTerminarDrag}>
      <SortableContext items={itens.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2">
          {itens.map((item) => (
            <ItemArrastavel key={item.id} id={item.id}>
              {renderItem(item)}
            </ItemArrastavel>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function ItemArrastavel({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })

  const estilo = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li ref={setNodeRef} style={estilo} className="flex items-center gap-2 rounded-md border p-2">
      <button
        type="button"
        aria-label="Arrastar para reordenar"
        className="cursor-grab touch-none text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="flex-1">{children}</div>
    </li>
  )
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm test -- ListaReordenavel.test`
Expected: PASS (3 testes)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/veiculos/ListaReordenavel.tsx src/components/veiculos/ListaReordenavel.test.tsx
git commit -m "feat: componente genérico de lista reordenável por drag-and-drop

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Integração final — duas seções em `Veiculos.tsx` com persistência otimista

**Files:**
- Modify: `src/pages/Veiculos.tsx`
- Modify: `src/pages/Veiculos.test.tsx`

**Interfaces:**
- Consumes: `useVeiculos` (já existente), `deleteVeiculo`, `reorderVeiculos`, `type Veiculo` (Task 1); `LinhaVeiculo` (Task 2); `ListaReordenavel` (Task 3).
- Produces: nenhuma nova — é a tela final.

Troca a `<table>` única de hoje por duas seções: "Disponíveis" (reordenável, veículos com `status` `disponivel`/`reservado`) e "Vendidos/Inativos" (lista estática, só aparece se houver algum). Ao soltar um item na seção "Disponíveis", a nova ordem é aplicada otimisticamente na tela e persistida via `reorderVeiculos`; se a chamada falhar, a posição volta ao que era antes e um erro aparece.

- [ ] **Step 1: Escrever os testes (falhando)**

Substituir o conteúdo inteiro de `src/pages/Veiculos.test.tsx` por:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import VeiculosPage from '@/pages/Veiculos'
import { listVeiculos, deleteVeiculo, reorderVeiculos } from '@/lib/veiculos'

vi.mock('@/lib/veiculos', () => ({
  listVeiculos: vi.fn(),
  deleteVeiculo: vi.fn(),
  reorderVeiculos: vi.fn(),
}))

// dnd-kit mede a posição de cada item arrastável via getBoundingClientRect
// pra decidir, ao pressionar uma seta, qual é o "próximo" item na direção
// pressionada — ver a mesma explicação em ListaReordenavel.test.tsx.
function mockarRetangulos() {
  const alturaItem = 50
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement
  ) {
    const itensNoDom = Array.from(document.querySelectorAll<HTMLElement>('li'))
    const indice = itensNoDom.indexOf(this)
    const topo = indice >= 0 ? indice * alturaItem : 0
    return {
      width: 300,
      height: alturaItem,
      top: topo,
      left: 0,
      right: 300,
      bottom: topo + alturaItem,
      x: 0,
      y: topo,
      toJSON() {},
    } as DOMRect
  })
}

beforeEach(() => {
  vi.mocked(listVeiculos).mockReset()
  vi.mocked(deleteVeiculo).mockReset()
  vi.mocked(reorderVeiculos).mockReset()
  vi.restoreAllMocks()
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

  it('separa os veículos em seções de Disponíveis e Vendidos/Inativos', async () => {
    vi.mocked(listVeiculos).mockResolvedValue([
      { id: '1', marca: 'Honda', modelo: 'Civic', ano_modelo: 2024, preco: 95000, status: 'disponivel' } as never,
      { id: '2', marca: 'Toyota', modelo: 'Corolla', ano_modelo: 2022, preco: 90000, status: 'vendido' } as never,
    ])

    renderPagina()

    // Espera pelo conteúdo da seção "Disponíveis" (não só pelo título dela):
    // ele só aparece depois que o efeito que separa `veiculos` em
    // `disponiveis` roda, um instante depois do título já estar na tela.
    expect(await screen.findByText('Honda')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /disponíveis/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /vendidos\/inativos/i })).toBeInTheDocument()
    expect(screen.getByText('Toyota')).toBeInTheDocument()
  })

  it('não mostra a seção Vendidos/Inativos quando não há nenhum', async () => {
    vi.mocked(listVeiculos).mockResolvedValue([
      { id: '1', marca: 'Honda', modelo: 'Civic', ano_modelo: 2024, preco: 95000, status: 'disponivel' } as never,
    ])

    renderPagina()

    await screen.findByText('Honda')
    expect(screen.queryByRole('heading', { name: /vendidos\/inativos/i })).not.toBeInTheDocument()
  })

  it('mostra mensagem quando só há veículos indisponíveis pra reordenar', async () => {
    vi.mocked(listVeiculos).mockResolvedValue([
      { id: '1', marca: 'Toyota', modelo: 'Corolla', ano_modelo: 2022, preco: 90000, status: 'inativo' } as never,
    ])

    renderPagina()

    expect(await screen.findByText(/nenhum veículo disponível pra reordenar/i)).toBeInTheDocument()
  })

  it('reordena via teclado e persiste a nova ordem', async () => {
    mockarRetangulos()
    vi.mocked(listVeiculos).mockResolvedValue([
      { id: '1', marca: 'Honda', modelo: 'Civic', ano_modelo: 2024, preco: 95000, status: 'disponivel', ordem: 0 } as never,
      { id: '2', marca: 'Toyota', modelo: 'Corolla', ano_modelo: 2022, preco: 90000, status: 'disponivel', ordem: 1 } as never,
    ])
    vi.mocked(reorderVeiculos).mockResolvedValue(undefined)

    renderPagina()
    await screen.findByText('Honda')

    const [alcaPrimeiro] = screen.getAllByRole('button', { name: /arrastar para reordenar/i })
    alcaPrimeiro.focus()

    fireEvent.keyDown(alcaPrimeiro, { code: 'Space' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    fireEvent.keyDown(alcaPrimeiro, { code: 'ArrowDown' })
    fireEvent.keyDown(alcaPrimeiro, { code: 'Space' })

    await waitFor(() =>
      expect(reorderVeiculos).toHaveBeenCalledWith([
        { id: '2', ordem: 0 },
        { id: '1', ordem: 1 },
      ])
    )
  })

  it('reverte a ordem e mostra erro quando falha ao salvar', async () => {
    mockarRetangulos()
    vi.mocked(listVeiculos).mockResolvedValue([
      { id: '1', marca: 'Honda', modelo: 'Civic', ano_modelo: 2024, preco: 95000, status: 'disponivel', ordem: 0 } as never,
      { id: '2', marca: 'Toyota', modelo: 'Corolla', ano_modelo: 2022, preco: 90000, status: 'disponivel', ordem: 1 } as never,
    ])
    vi.mocked(reorderVeiculos).mockRejectedValue(new Error('falha de rede'))

    renderPagina()
    await screen.findByText('Honda')

    const [alcaPrimeiro] = screen.getAllByRole('button', { name: /arrastar para reordenar/i })
    alcaPrimeiro.focus()

    fireEvent.keyDown(alcaPrimeiro, { code: 'Space' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    fireEvent.keyDown(alcaPrimeiro, { code: 'ArrowDown' })
    fireEvent.keyDown(alcaPrimeiro, { code: 'Space' })

    expect(await screen.findByText('falha de rede')).toBeInTheDocument()

    const linhas = screen.getAllByRole('listitem')
    expect(linhas[0].textContent).toContain('Honda')
    expect(linhas[1].textContent).toContain('Toyota')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- Veiculos.test`
Expected: FAIL — `reorderVeiculos` não é exportado pelo mock, os títulos de seção ("Disponíveis"/"Vendidos/Inativos") não existem, e a alça "Arrastar para reordenar" não existe.

- [ ] **Step 3: Implementar**

`src/pages/Veiculos.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useVeiculos } from '@/hooks/useVeiculos'
import { deleteVeiculo, reorderVeiculos, type Veiculo } from '@/lib/veiculos'
import { Button } from '@/components/ui/button'
import { ListaReordenavel } from '@/components/veiculos/ListaReordenavel'
import { LinhaVeiculo } from '@/components/veiculos/LinhaVeiculo'

const STATUS_REORDENAVEL = ['disponivel', 'reservado']

export default function VeiculosPage() {
  const { veiculos, carregando, erro, recarregar } = useVeiculos()
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [disponiveis, setDisponiveis] = useState<Veiculo[]>([])
  const [salvandoOrdem, setSalvandoOrdem] = useState(false)
  const [erroOrdem, setErroOrdem] = useState<string | null>(null)

  useEffect(() => {
    setDisponiveis(veiculos.filter((veiculo) => STATUS_REORDENAVEL.includes(veiculo.status)))
  }, [veiculos])

  const indisponiveis = veiculos.filter((veiculo) => !STATUS_REORDENAVEL.includes(veiculo.status))

  async function excluir(idVeiculo: string) {
    setExcluindoId(idVeiculo)
    try {
      await deleteVeiculo(idVeiculo)
      recarregar()
    } finally {
      setExcluindoId(null)
    }
  }

  async function aoReordenar(novaLista: Veiculo[]) {
    const anterior = disponiveis
    const comNovaOrdem = novaLista.map((veiculo, indice) => ({ ...veiculo, ordem: indice }))

    setErroOrdem(null)
    setDisponiveis(comNovaOrdem)

    const atualizacoes = comNovaOrdem
      .filter((veiculo) => anterior.find((v) => v.id === veiculo.id)?.ordem !== veiculo.ordem)
      .map((veiculo) => ({ id: veiculo.id, ordem: veiculo.ordem }))

    if (atualizacoes.length === 0) return

    setSalvandoOrdem(true)
    try {
      await reorderVeiculos(atualizacoes)
    } catch (e) {
      setDisponiveis(anterior)
      setErroOrdem((e as Error).message)
    } finally {
      setSalvandoOrdem(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Veículos</h1>
        <Button render={<Link to="/veiculos/novo">Novo veículo</Link>} />
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
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Disponíveis</h2>

            {erroOrdem && (
              <p role="alert" className="text-sm text-destructive">
                {erroOrdem}
              </p>
            )}
            {salvandoOrdem && (
              <p role="status" className="text-sm text-muted-foreground">
                Salvando ordem...
              </p>
            )}

            {disponiveis.length === 0 && (
              <p className="text-muted-foreground">Nenhum veículo disponível pra reordenar.</p>
            )}

            {disponiveis.length > 0 && (
              <ListaReordenavel
                itens={disponiveis}
                onReordenar={aoReordenar}
                renderItem={(veiculo) => (
                  <LinhaVeiculo veiculo={veiculo} excluindoId={excluindoId} onExcluir={excluir} />
                )}
              />
            )}
          </section>

          {indisponiveis.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold">Vendidos/Inativos</h2>
              <ul className="flex flex-col gap-2">
                {indisponiveis.map((veiculo) => (
                  <li key={veiculo.id} className="flex items-center gap-2 rounded-md border p-2">
                    <LinhaVeiculo veiculo={veiculo} excluindoId={excluindoId} onExcluir={excluir} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- Veiculos.test`
Expected: PASS (9 testes)

- [ ] **Step 5: Rodar a suíte inteira, o type-check e o lint**

Run: `npm test`
Expected: PASS (todos os arquivos, incluindo os das Tasks 1-3)

Run: `npx tsc -b`
Expected: sem erros

Run: `npm run lint`
Expected: sem erros novos (o aviso `react(set-state-in-effect)` no `useEffect` que separa `disponiveis` é esperado — o mesmo padrão já existe em `useVeiculos.ts` e `useLoja.ts` neste projeto)

- [ ] **Step 6: Verificação manual**

Run: `npm run dev`, acessar `/veiculos` com pelo menos dois veículos `disponivel`/`reservado` cadastrados. Confirmar que:
- a seção "Disponíveis" mostra os veículos com uma alça de arrastar à esquerda;
- arrastar um item (mouse) pra outra posição persiste a nova ordem — recarregar a página e confirmar que a ordem se manteve;
- com um veículo `vendido`/`inativo` cadastrado, ele aparece na seção "Vendidos/Inativos", sem alça de arrastar;
- com o foco na alça de um item, `Space` → seta → `Space` também reordena.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Veiculos.tsx src/pages/Veiculos.test.tsx
git commit -m "feat: reordenação manual dos veículos em /veiculos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Atualizar o roteiro em `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** nenhuma — só documentação.

- [ ] **Step 1: Adicionar a referência da spec/plano**

Em `CLAUDE.md`, logo depois das linhas:

```
Spec de Configurações da loja: `docs/superpowers/specs/2026-09-14-configuracoes-loja-design.md`
Plano de implementação de Configurações da loja: `docs/superpowers/plans/2026-09-14-configuracoes-loja.md`
```

adicionar:

```
Spec de Reordenação manual dos veículos: `docs/superpowers/specs/2026-09-14-reordenacao-veiculos-design.md`
Plano de implementação de Reordenação manual dos veículos: `docs/superpowers/plans/2026-09-14-reordenacao-veiculos.md`
```

- [ ] **Step 2: Marcar o item 3b como completo**

Trocar a linha:

```
   - 3b. Reordenação manual dos veículos (`ordem`) — drag-and-drop em `/veiculos`, adiada do CRUD de veículos.
```

por:

```
   - 3b. ~~Reordenação manual dos veículos~~ ✅ completo.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: marca Reordenação manual dos veículos (3b) como completo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

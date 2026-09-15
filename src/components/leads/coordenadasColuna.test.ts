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

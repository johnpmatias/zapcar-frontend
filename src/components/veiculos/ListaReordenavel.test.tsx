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

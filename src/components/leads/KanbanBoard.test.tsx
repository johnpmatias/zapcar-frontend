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

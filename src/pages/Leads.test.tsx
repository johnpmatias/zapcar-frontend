import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

    ;(await screen.findByRole('button', { name: 'Maria Silva' })).click()

    expect(await screen.findByRole('button', { name: 'Assumir conversa' })).toBeInTheDocument()
  })
})

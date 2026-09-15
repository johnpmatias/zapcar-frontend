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

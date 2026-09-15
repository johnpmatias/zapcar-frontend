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

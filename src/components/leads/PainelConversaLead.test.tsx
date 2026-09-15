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

  it('ignora resposta desatualizada quando o lead muda antes do getInteracoes resolver', async () => {
    const leadA = lead
    const leadB: Lead = { ...lead, id: '2', nome: 'João Souza' }

    let resolverA!: (dados: Interacao[]) => void
    let resolverB!: (dados: Interacao[]) => void
    const promiseA = new Promise<Interacao[]>((resolve) => {
      resolverA = resolve
    })
    const promiseB = new Promise<Interacao[]>((resolve) => {
      resolverB = resolve
    })

    vi.mocked(getInteracoes).mockImplementation((leadId: string) => {
      if (leadId === leadA.id) return promiseA
      if (leadId === leadB.id) return promiseB
      throw new Error('lead inesperado')
    })

    const { rerender } = render(
      <PainelConversaLead lead={leadA} onFechar={vi.fn()} onBotAtivoAlterado={vi.fn()} />
    )

    // Usuário troca de lead antes da requisição do lead A voltar (ex.: clica em outro card do Kanban).
    rerender(<PainelConversaLead lead={leadB} onFechar={vi.fn()} onBotAtivoAlterado={vi.fn()} />)

    // A requisição do lead B (mais recente) volta primeiro...
    resolverB([
      {
        id: 'b1',
        lead_id: leadB.id,
        remetente: 'LEAD',
        tipo: 'conversation',
        conteudo: 'Mensagem do lead B',
        created_at: '2026-09-14T10:02:00.000Z',
      },
    ])
    await screen.findByText('Mensagem do lead B')

    // ...e só depois a requisição desatualizada do lead A (que já não deveria mais importar).
    resolverA(interacoes)

    // Dá tempo pra cadeia .then/.catch/.finally da promise desatualizada terminar de
    // processar (se não houvesse guarda, é nesse momento que ela sobrescreveria o estado).
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(screen.getByText('Mensagem do lead B')).toBeInTheDocument()
    expect(screen.queryByText('Oi, quero saber do Civic')).not.toBeInTheDocument()
  })

  it('mostra o rótulo do tipo junto com o conteúdo real (transcrição/descrição), sem escondê-lo', async () => {
    vi.mocked(getInteracoes).mockResolvedValue([
      {
        id: '3',
        lead_id: '1',
        remetente: 'LEAD',
        tipo: 'audioMessage',
        conteudo: 'Transcrição: quero agendar um test drive amanhã de manhã',
        created_at: '2026-09-14T10:03:00.000Z',
      },
    ])

    render(<PainelConversaLead lead={lead} onFechar={vi.fn()} onBotAtivoAlterado={vi.fn()} />)

    expect(await screen.findByText('🎤 Áudio')).toBeInTheDocument()
    expect(
      screen.getByText('Transcrição: quero agendar um test drive amanhã de manhã')
    ).toBeInTheDocument()
  })
})

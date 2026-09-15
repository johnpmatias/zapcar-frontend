import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AssinaturaPage from '@/pages/Assinatura'
import { useAssinatura } from '@/hooks/useAssinatura'
import { criarAssinatura, listarCobrancas } from '@/lib/asaas'

vi.mock('@/hooks/useAssinatura', () => ({
  useAssinatura: vi.fn(),
}))

vi.mock('@/lib/asaas', () => ({
  criarAssinatura: vi.fn(),
  listarCobrancas: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(useAssinatura).mockReset()
  vi.mocked(criarAssinatura).mockReset()
  vi.mocked(listarCobrancas).mockReset().mockResolvedValue([])
  vi.stubGlobal('location', { ...window.location, href: '' })
})

describe('AssinaturaPage', () => {
  it('mostra a contagem de dias restantes durante o trial', async () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: 'trial',
      diasRestantesTrial: 4,
      temAcessoCompleto: true,
      carregando: false,
      erro: null,
      recarregar: vi.fn(),
    })

    render(<AssinaturaPage />)

    expect(await screen.findByText(/4 dias/i)).toBeInTheDocument()
  })

  it('mostra o aviso de modo leitura quando a assinatura venceu', async () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: 'overdue',
      diasRestantesTrial: null,
      temAcessoCompleto: false,
      carregando: false,
      erro: null,
      recarregar: vi.fn(),
    })

    render(<AssinaturaPage />)

    expect(await screen.findByText(/modo leitura/i)).toBeInTheDocument()
  })

  it('mostra "Assinatura ativa" quando o status é active', async () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: 'active',
      diasRestantesTrial: null,
      temAcessoCompleto: true,
      carregando: false,
      erro: null,
      recarregar: vi.fn(),
    })

    render(<AssinaturaPage />)

    expect(await screen.findByText(/assinatura ativa/i)).toBeInTheDocument()
  })

  it('redireciona pro link de pagamento ao clicar em Assinar agora', async () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: 'overdue',
      diasRestantesTrial: null,
      temAcessoCompleto: false,
      carregando: false,
      erro: null,
      recarregar: vi.fn(),
    })
    vi.mocked(criarAssinatura).mockResolvedValue('https://sandbox.asaas.com/i/abc123')

    render(<AssinaturaPage />)
    await userEvent.click(screen.getByRole('button', { name: /assinar agora/i }))

    await waitFor(() => expect(window.location.href).toBe('https://sandbox.asaas.com/i/abc123'))
  })

  it('mostra o histórico de cobranças', async () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: 'active',
      diasRestantesTrial: null,
      temAcessoCompleto: true,
      carregando: false,
      erro: null,
      recarregar: vi.fn(),
    })
    vi.mocked(listarCobrancas).mockResolvedValue([
      { id: 'pay_1', valor: 97, status: 'CONFIRMED', vencimento: '2026-10-01' },
    ])

    render(<AssinaturaPage />)

    expect(await screen.findByText('CONFIRMED')).toBeInTheDocument()
  })

  it('mostra um erro quando o histórico de cobranças falha ao carregar', async () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: 'active',
      diasRestantesTrial: null,
      temAcessoCompleto: true,
      carregando: false,
      erro: null,
      recarregar: vi.fn(),
    })
    vi.mocked(listarCobrancas).mockRejectedValue(new Error('Falha ao carregar cobranças.'))

    render(<AssinaturaPage />)

    expect(await screen.findByText('Falha ao carregar cobranças.')).toBeInTheDocument()
    expect(screen.queryByText(/nenhuma cobrança ainda/i)).not.toBeInTheDocument()
  })
})

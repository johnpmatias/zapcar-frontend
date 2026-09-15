import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AssinaturaBanner } from '@/components/AssinaturaBanner'
import { useAssinatura } from '@/hooks/useAssinatura'

vi.mock('@/hooks/useAssinatura', () => ({
  useAssinatura: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(useAssinatura).mockReset()
})

function renderBanner() {
  return render(
    <MemoryRouter>
      <AssinaturaBanner />
    </MemoryRouter>
  )
}

describe('AssinaturaBanner', () => {
  it('não mostra nada enquanto carrega', () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: null,
      diasRestantesTrial: null,
      temAcessoCompleto: false,
      carregando: true,
      erro: null,
      recarregar: vi.fn(),
    })
    const { container } = renderBanner()
    expect(container).toBeEmptyDOMElement()
  })

  it('não mostra nada quando a assinatura está ativa', () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: 'active',
      diasRestantesTrial: null,
      temAcessoCompleto: true,
      carregando: false,
      erro: null,
      recarregar: vi.fn(),
    })
    const { container } = renderBanner()
    expect(container).toBeEmptyDOMElement()
  })

  it('mostra a contagem regressiva durante o trial', () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: 'trial',
      diasRestantesTrial: 3,
      temAcessoCompleto: true,
      carregando: false,
      erro: null,
      recarregar: vi.fn(),
    })
    renderBanner()
    expect(screen.getByText(/acaba em 3 dias/i)).toBeInTheDocument()
  })

  it('mostra o aviso de modo leitura quando o acesso está bloqueado', () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: 'overdue',
      diasRestantesTrial: null,
      temAcessoCompleto: false,
      carregando: false,
      erro: null,
      recarregar: vi.fn(),
    })
    renderBanner()
    expect(screen.getByText(/modo leitura/i)).toBeInTheDocument()
  })
})

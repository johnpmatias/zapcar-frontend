import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { RequireAssinaturaAtiva } from '@/components/RequireAssinaturaAtiva'
import { useAssinatura } from '@/hooks/useAssinatura'

vi.mock('@/hooks/useAssinatura', () => ({
  useAssinatura: vi.fn(),
}))

function renderComGuard() {
  return render(
    <MemoryRouter initialEntries={['/veiculos/novo']}>
      <Routes>
        <Route
          path="/veiculos/novo"
          element={
            <RequireAssinaturaAtiva>
              <div>Formulário conteúdo</div>
            </RequireAssinaturaAtiva>
          }
        />
        <Route path="/assinatura" element={<div>Assinatura conteúdo</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.mocked(useAssinatura).mockReset()
})

describe('RequireAssinaturaAtiva', () => {
  it('mostra o estado de carregamento enquanto a assinatura ainda não foi resolvida', () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: null,
      diasRestantesTrial: null,
      temAcessoCompleto: false,
      carregando: true,
      erro: null,
      recarregar: vi.fn(),
    })
    renderComGuard()
    expect(screen.getByText('Carregando...')).toBeInTheDocument()
  })

  it('renderiza os children quando há acesso completo', () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: 'trial',
      diasRestantesTrial: 3,
      temAcessoCompleto: true,
      carregando: false,
      erro: null,
      recarregar: vi.fn(),
    })
    renderComGuard()
    expect(screen.getByText('Formulário conteúdo')).toBeInTheDocument()
  })

  it('redireciona para /assinatura quando não há acesso completo', () => {
    vi.mocked(useAssinatura).mockReturnValue({
      status: 'overdue',
      diasRestantesTrial: null,
      temAcessoCompleto: false,
      carregando: false,
      erro: null,
      recarregar: vi.fn(),
    })
    renderComGuard()
    expect(screen.getByText('Assinatura conteúdo')).toBeInTheDocument()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAuth } from '@/hooks/useAuth'
import { useAssinatura } from '@/hooks/useAssinatura'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/hooks/useAssinatura', () => ({
  useAssinatura: vi.fn(),
}))

function renderComProtectedRoute() {
  return render(
    <MemoryRouter initialEntries={['/painel']}>
      <Routes>
        <Route
          path="/painel"
          element={
            <ProtectedRoute>
              <div>Painel conteúdo</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>Login conteúdo</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.mocked(useAuth).mockReset()
  vi.mocked(useAssinatura).mockReturnValue({
    status: 'active',
    diasRestantesTrial: null,
    temAcessoCompleto: true,
    carregando: false,
    erro: null,
    recarregar: vi.fn(),
  })
})

describe('ProtectedRoute', () => {
  it('mostra o estado de carregamento enquanto a sessão ainda não foi resolvida', () => {
    vi.mocked(useAuth).mockReturnValue({ session: null, user: null, loading: true, signOut: vi.fn() })
    renderComProtectedRoute()
    expect(screen.getByText('Carregando...')).toBeInTheDocument()
  })

  it('redireciona para /login quando não há sessão', () => {
    vi.mocked(useAuth).mockReturnValue({ session: null, user: null, loading: false, signOut: vi.fn() })
    renderComProtectedRoute()
    expect(screen.getByText('Login conteúdo')).toBeInTheDocument()
  })

  it('renderiza os children e o banner de assinatura quando há sessão', () => {
    vi.mocked(useAuth).mockReturnValue({
      session: {} as never,
      user: { id: 'user-1' } as never,
      loading: false,
      signOut: vi.fn(),
    })
    vi.mocked(useAssinatura).mockReturnValue({
      status: 'trial',
      diasRestantesTrial: 5,
      temAcessoCompleto: true,
      carregando: false,
      erro: null,
      recarregar: vi.fn(),
    })

    renderComProtectedRoute()

    expect(screen.getByText('Painel conteúdo')).toBeInTheDocument()
    expect(screen.getByText(/acaba em 5 dias/i)).toBeInTheDocument()
  })
})

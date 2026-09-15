import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { PublicHomeRoute } from '@/components/PublicHomeRoute'
import { useAuth } from '@/hooks/useAuth'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

function renderComPublicHomeRoute() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={
            <PublicHomeRoute>
              <div>Landing conteúdo</div>
            </PublicHomeRoute>
          }
        />
        <Route path="/painel" element={<div>Painel conteúdo</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.mocked(useAuth).mockReset()
})

describe('PublicHomeRoute', () => {
  it('mostra o estado de carregamento enquanto a sessão ainda não foi resolvida', () => {
    vi.mocked(useAuth).mockReturnValue({
      session: null,
      user: null,
      loading: true,
      signOut: vi.fn(),
    })

    renderComPublicHomeRoute()

    expect(screen.getByText('Carregando...')).toBeInTheDocument()
  })

  it('renderiza os children (landing) quando não há sessão', () => {
    vi.mocked(useAuth).mockReturnValue({
      session: null,
      user: null,
      loading: false,
      signOut: vi.fn(),
    })

    renderComPublicHomeRoute()

    expect(screen.getByText('Landing conteúdo')).toBeInTheDocument()
  })

  it('redireciona para /painel quando há sessão', () => {
    vi.mocked(useAuth).mockReturnValue({
      session: {} as never,
      user: { id: 'user-1' } as never,
      loading: false,
      signOut: vi.fn(),
    })

    renderComPublicHomeRoute()

    expect(screen.getByText('Painel conteúdo')).toBeInTheDocument()
    expect(screen.queryByText('Landing conteúdo')).not.toBeInTheDocument()
  })
})

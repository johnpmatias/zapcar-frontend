import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import VeiculoFormPage from '@/pages/VeiculoForm'
import { createVeiculo } from '@/lib/veiculos'
import { useAuth } from '@/hooks/useAuth'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

vi.mock('@/lib/veiculos', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/veiculos')>()),
  createVeiculo: vi.fn(),
  getVeiculo: vi.fn(),
  updateVeiculo: vi.fn(),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}))

beforeEach(() => {
  vi.mocked(createVeiculo).mockReset()
  navigateMock.mockReset()
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'loja-1' } as never,
    session: {} as never,
    loading: false,
    signOut: vi.fn(),
  })
})

function renderFormulario() {
  return render(
    <MemoryRouter initialEntries={['/veiculos/novo']}>
      <Routes>
        <Route path="/veiculos/novo" element={<VeiculoFormPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('VeiculoFormPage — cadastro', () => {
  it('cria um veículo com os campos essenciais e redireciona para a listagem', async () => {
    let resolverCriacao: (veiculo: unknown) => void = () => {}
    vi.mocked(createVeiculo).mockReturnValue(
      new Promise((resolve) => {
        resolverCriacao = resolve
      }) as never
    )
    const usuario = userEvent.setup()

    renderFormulario()

    await usuario.type(screen.getByLabelText(/marca/i), 'Honda')
    await usuario.type(screen.getByLabelText(/^modelo/i), 'Civic')
    await usuario.clear(screen.getByLabelText(/ano de fabricação/i))
    await usuario.type(screen.getByLabelText(/ano de fabricação/i), '2023')
    await usuario.clear(screen.getByLabelText(/ano do modelo/i))
    await usuario.type(screen.getByLabelText(/ano do modelo/i), '2024')
    await usuario.clear(screen.getByLabelText(/^preço$/i))
    await usuario.type(screen.getByLabelText(/^preço$/i), '95000')
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/salvando/i)).toBeInTheDocument()
    expect(createVeiculo).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        loja_id: 'loja-1',
        marca: 'Honda',
        modelo: 'Civic',
        ano_fabricacao: 2023,
        ano_modelo: 2024,
        preco: 95000,
        titulo: 'Honda Civic 2024',
      })
    )

    resolverCriacao({ id: 'novo-id' })
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/veiculos'))
  })

  it('mostra erro de validação quando falta a marca', async () => {
    const usuario = userEvent.setup()
    renderFormulario()

    await usuario.type(screen.getByLabelText(/^modelo/i), 'Civic')
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/informe a marca/i)).toBeInTheDocument()
    expect(createVeiculo).not.toHaveBeenCalled()
  })

  it('envia os campos de seleção e o switch de aceita troca', async () => {
    vi.mocked(createVeiculo).mockResolvedValue({ id: 'novo-id' } as never)
    const usuario = userEvent.setup()

    renderFormulario()

    await usuario.type(screen.getByLabelText(/marca/i), 'Honda')
    await usuario.type(screen.getByLabelText(/^modelo/i), 'Civic')
    await usuario.clear(screen.getByLabelText(/ano de fabricação/i))
    await usuario.type(screen.getByLabelText(/ano de fabricação/i), '2023')
    await usuario.clear(screen.getByLabelText(/ano do modelo/i))
    await usuario.type(screen.getByLabelText(/ano do modelo/i), '2024')
    await usuario.clear(screen.getByLabelText(/^preço$/i))
    await usuario.type(screen.getByLabelText(/^preço$/i), '95000')
    await usuario.click(screen.getByRole('switch', { name: /aceita troca/i }))
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    await waitFor(() =>
      expect(createVeiculo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ aceita_troca: true })
      )
    )
  })
})

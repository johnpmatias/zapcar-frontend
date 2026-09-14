import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import VeiculosPage from '@/pages/Veiculos'
import { listVeiculos, deleteVeiculo } from '@/lib/veiculos'

vi.mock('@/lib/veiculos', () => ({
  listVeiculos: vi.fn(),
  deleteVeiculo: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(listVeiculos).mockReset()
})

function renderPagina() {
  return render(
    <MemoryRouter>
      <VeiculosPage />
    </MemoryRouter>
  )
}

describe('VeiculosPage', () => {
  it('mostra estado de carregamento e depois a lista', async () => {
    vi.mocked(listVeiculos).mockResolvedValue([
      {
        id: '1',
        marca: 'Honda',
        modelo: 'Civic',
        ano_modelo: 2024,
        preco: 95000,
        status: 'disponivel',
      } as never,
    ])

    renderPagina()

    expect(screen.getByText(/carregando/i)).toBeInTheDocument()
    expect(await screen.findByText('Honda')).toBeInTheDocument()
    expect(screen.getByText('Civic')).toBeInTheDocument()
  })

  it('mostra mensagem de vazio quando não há veículos', async () => {
    vi.mocked(listVeiculos).mockResolvedValue([])

    renderPagina()

    expect(await screen.findByText(/nenhum veículo cadastrado/i)).toBeInTheDocument()
  })

  it('mostra erro com botão de tentar novamente', async () => {
    vi.mocked(listVeiculos).mockRejectedValue(new Error('falha de rede'))

    renderPagina()

    expect(await screen.findByText('falha de rede')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument()
  })

  it('exclui um veículo após confirmação', async () => {
    vi.mocked(listVeiculos).mockResolvedValue([
      { id: '1', marca: 'Honda', modelo: 'Civic', ano_modelo: 2024, preco: 95000, status: 'disponivel' } as never,
    ])
    vi.mocked(deleteVeiculo).mockResolvedValue(undefined)
    const usuario = userEvent.setup()

    renderPagina()

    await usuario.click(await screen.findByRole('button', { name: /excluir/i }))
    await usuario.click(screen.getByRole('button', { name: /confirmar exclusão/i }))

    expect(deleteVeiculo).toHaveBeenCalledWith('1')
  })
})

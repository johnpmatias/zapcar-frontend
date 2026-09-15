import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LinhaVeiculo } from '@/components/veiculos/LinhaVeiculo'
import type { Veiculo } from '@/lib/veiculos'

const veiculoExemplo = {
  id: 'v1',
  marca: 'Toyota',
  modelo: 'Corolla',
  ano_modelo: 2022,
  preco: 120000,
  status: 'disponivel',
} as Veiculo

function renderLinha(temAcessoCompleto: boolean) {
  return render(
    <MemoryRouter>
      <LinhaVeiculo
        veiculo={veiculoExemplo}
        excluindoId={null}
        onExcluir={vi.fn()}
        temAcessoCompleto={temAcessoCompleto}
      />
    </MemoryRouter>
  )
}

describe('LinhaVeiculo', () => {
  it('mostra os links de editar/excluir quando há acesso completo', () => {
    renderLinha(true)
    expect(screen.getByText('Editar')).toBeInTheDocument()
    expect(screen.getByText('Excluir')).not.toBeDisabled()
  })

  it('esconde editar e desabilita excluir em modo leitura', () => {
    renderLinha(false)
    expect(screen.queryByText('Editar')).not.toBeInTheDocument()
    expect(screen.getByText('Excluir')).toBeDisabled()
  })
})

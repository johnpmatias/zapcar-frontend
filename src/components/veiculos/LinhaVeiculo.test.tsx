import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LinhaVeiculo } from '@/components/veiculos/LinhaVeiculo'
import type { Veiculo } from '@/lib/veiculos'

const veiculo = {
  id: '1',
  marca: 'Honda',
  modelo: 'Civic',
  ano_modelo: 2024,
  preco: 95000,
  status: 'disponivel',
} as Veiculo

function renderComponente({
  excluindoId = null,
  onExcluir = vi.fn(),
  temAcessoCompleto = true,
}: {
  excluindoId?: string | null
  onExcluir?: (id: string) => void
  temAcessoCompleto?: boolean
} = {}) {
  return render(
    <MemoryRouter>
      <LinhaVeiculo
        veiculo={veiculo}
        excluindoId={excluindoId}
        onExcluir={onExcluir}
        temAcessoCompleto={temAcessoCompleto}
      />
    </MemoryRouter>
  )
}

describe('LinhaVeiculo', () => {
  it('mostra os dados do veículo', () => {
    renderComponente()

    expect(screen.getByText('Honda')).toBeInTheDocument()
    expect(screen.getByText('Civic')).toBeInTheDocument()
    expect(screen.getByText('disponivel')).toBeInTheDocument()
  })

  it('chama onExcluir com o id após confirmação', async () => {
    const onExcluir = vi.fn()
    const usuario = userEvent.setup()
    renderComponente({ onExcluir })

    await usuario.click(screen.getByRole('button', { name: /excluir/i }))
    await usuario.click(screen.getByRole('button', { name: /confirmar exclusão/i }))

    expect(onExcluir).toHaveBeenCalledWith('1')
  })

  it('desabilita o botão de confirmar quando excluindoId bate com o veículo', async () => {
    const usuario = userEvent.setup()
    renderComponente({ excluindoId: '1' })

    await usuario.click(screen.getByRole('button', { name: /excluir/i }))

    expect(screen.getByRole('button', { name: /confirmar exclusão/i })).toBeDisabled()
  })

  it('mostra os links de editar/excluir quando há acesso completo', () => {
    renderComponente({ temAcessoCompleto: true })
    expect(screen.getByText('Editar')).toBeInTheDocument()
    expect(screen.getByText('Excluir')).not.toBeDisabled()
  })

  it('esconde editar e desabilita excluir em modo leitura', () => {
    renderComponente({ temAcessoCompleto: false })
    expect(screen.queryByText('Editar')).not.toBeInTheDocument()
    expect(screen.getByText('Excluir')).toBeDisabled()
  })
})

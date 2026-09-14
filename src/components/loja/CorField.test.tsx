import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CorField } from '@/components/loja/CorField'

function CorFieldControlado() {
  const [valor, setValor] = useState<string | undefined>(undefined)
  return <CorField id="cor" label="Cor primária" value={valor} onChange={setValor} />
}

describe('CorField', () => {
  it('atualiza o valor ao digitar o hexadecimal', async () => {
    const usuario = userEvent.setup()
    render(<CorFieldControlado />)

    await usuario.type(screen.getByLabelText('Cor primária'), '#1e40af')

    expect(screen.getByLabelText('Cor primária')).toHaveValue('#1e40af')
  })

  it('atualiza o valor ao usar o seletor de cor nativo', () => {
    render(<CorFieldControlado />)

    fireEvent.change(screen.getByLabelText('Selecionar cor primária'), {
      target: { value: '#00ff00' },
    })

    expect(screen.getByLabelText('Cor primária')).toHaveValue('#00ff00')
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OpcionaisField } from '@/components/veiculos/OpcionaisField'

describe('OpcionaisField', () => {
  it('adiciona um item ao digitar e pressionar Enter', async () => {
    const onChange = vi.fn()
    const usuario = userEvent.setup()

    render(<OpcionaisField value={[]} onChange={onChange} />)

    await usuario.type(screen.getByLabelText(/adicionar opcional/i), 'Ar condicionado{Enter}')

    expect(onChange).toHaveBeenCalledWith(['Ar condicionado'])
  })

  it('remove um item existente', async () => {
    const onChange = vi.fn()
    const usuario = userEvent.setup()

    render(<OpcionaisField value={['Ar condicionado', 'Vidro elétrico']} onChange={onChange} />)

    await usuario.click(screen.getByRole('button', { name: /remover ar condicionado/i }))

    expect(onChange).toHaveBeenCalledWith(['Vidro elétrico'])
  })
})

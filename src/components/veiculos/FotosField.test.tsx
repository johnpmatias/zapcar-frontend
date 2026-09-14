import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FotosField } from '@/components/veiculos/FotosField'
import { uploadFotoVeiculo, removerFotoVeiculo } from '@/lib/veiculo-fotos'

vi.mock('@/lib/veiculo-fotos', () => ({
  uploadFotoVeiculo: vi.fn(),
  removerFotoVeiculo: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(uploadFotoVeiculo).mockReset()
  vi.mocked(removerFotoVeiculo).mockReset()
})

describe('FotosField', () => {
  it('sobe um arquivo selecionado e define como capa quando é a primeira foto', async () => {
    vi.mocked(uploadFotoVeiculo).mockResolvedValue('https://exemplo/foto1.jpg')
    const onChange = vi.fn()
    const usuario = userEvent.setup()
    const arquivo = new File(['conteudo'], 'foto1.jpg', { type: 'image/jpeg' })

    render(<FotosField lojaId="loja-1" veiculoId="veiculo-1" fotos={[]} fotoCapa={null} onChange={onChange} />)

    await usuario.upload(screen.getByLabelText(/adicionar fotos/i), arquivo)

    expect(uploadFotoVeiculo).toHaveBeenCalledWith('loja-1', 'veiculo-1', arquivo)
    expect(onChange).toHaveBeenCalledWith(['https://exemplo/foto1.jpg'], 'https://exemplo/foto1.jpg')
  })

  it('remove uma foto existente', async () => {
    vi.mocked(removerFotoVeiculo).mockResolvedValue(undefined)
    const onChange = vi.fn()
    const usuario = userEvent.setup()

    render(
      <FotosField
        lojaId="loja-1"
        veiculoId="veiculo-1"
        fotos={['https://exemplo/foto1.jpg', 'https://exemplo/foto2.jpg']}
        fotoCapa="https://exemplo/foto1.jpg"
        onChange={onChange}
      />
    )

    await usuario.click(screen.getAllByRole('button', { name: /remover foto/i })[0])

    expect(removerFotoVeiculo).toHaveBeenCalledWith('https://exemplo/foto1.jpg')
    expect(onChange).toHaveBeenCalledWith(['https://exemplo/foto2.jpg'], 'https://exemplo/foto2.jpg')
  })
})

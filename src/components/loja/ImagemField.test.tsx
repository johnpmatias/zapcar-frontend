import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImagemField } from '@/components/loja/ImagemField'
import { uploadImagemLoja, removerImagemLoja } from '@/lib/loja-imagens'

vi.mock('@/lib/loja-imagens', () => ({
  uploadImagemLoja: vi.fn(),
  removerImagemLoja: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(uploadImagemLoja).mockReset()
  vi.mocked(removerImagemLoja).mockReset()
})

describe('ImagemField', () => {
  it('sobe o arquivo selecionado e chama onChange com a URL', async () => {
    vi.mocked(uploadImagemLoja).mockResolvedValue('https://exemplo.com/logo.png')
    const onChange = vi.fn()
    const usuario = userEvent.setup()
    const arquivo = new File(['conteudo'], 'logo.png', { type: 'image/png' })

    render(<ImagemField lojaId="loja-1" campo="logo" label="Logo" value={undefined} onChange={onChange} />)

    await usuario.upload(screen.getByLabelText('Logo'), arquivo)

    expect(uploadImagemLoja).toHaveBeenCalledWith('loja-1', 'logo', arquivo)
    expect(onChange).toHaveBeenCalledWith('https://exemplo.com/logo.png')
  })

  it('mostra erro inline quando o upload falha', async () => {
    vi.mocked(uploadImagemLoja).mockRejectedValue(new Error('falha no upload'))
    const onChange = vi.fn()
    const usuario = userEvent.setup()
    const arquivo = new File(['conteudo'], 'logo.png', { type: 'image/png' })

    render(<ImagemField lojaId="loja-1" campo="logo" label="Logo" value={undefined} onChange={onChange} />)

    await usuario.upload(screen.getByLabelText('Logo'), arquivo)

    expect(await screen.findByText('falha no upload')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('remove a imagem existente', async () => {
    vi.mocked(removerImagemLoja).mockResolvedValue(undefined)
    const onChange = vi.fn()
    const usuario = userEvent.setup()

    render(
      <ImagemField lojaId="loja-1" campo="logo" label="Logo" value="https://exemplo.com/logo.png" onChange={onChange} />
    )

    await usuario.click(screen.getByRole('button', { name: /remover/i }))

    expect(removerImagemLoja).toHaveBeenCalledWith('https://exemplo.com/logo.png')
    expect(onChange).toHaveBeenCalledWith(undefined)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlacaLookup } from '@/components/veiculos/PlacaLookup'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('PlacaLookup', () => {
  it('preenche direto quando há uma única correspondência Fipe', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        ok: true,
        data: {
          marca: 'VW',
          modelo: 'CROSSFOX',
          anoFabricacao: 2007,
          anoModelo: 2007,
          cor: 'Prata',
          combustivel: 'Flex',
          versoes: [{ texto: 'CROSSFOX 1.6 Total Flex', valorFipe: 28799, score: 101 }],
        },
      }),
    } as never)
    const onDadosEncontrados = vi.fn()
    const usuario = userEvent.setup()

    render(<PlacaLookup placaAtual="INT8C36" onDadosEncontrados={onDadosEncontrados} />)
    await usuario.click(screen.getByRole('button', { name: /buscar dados/i }))

    expect(await screen.findByText(/dados encontrados/i)).toBeInTheDocument()
    expect(onDadosEncontrados).toHaveBeenCalledWith(
      expect.objectContaining({ marca: 'VW', modelo: 'CROSSFOX', versao: 'CROSSFOX 1.6 Total Flex' })
    )
  })

  it('mostra seletor quando há múltiplas correspondências Fipe', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        ok: true,
        data: {
          marca: 'VW',
          modelo: 'CROSSFOX',
          anoFabricacao: 2007,
          anoModelo: 2007,
          versoes: [
            { texto: 'Versão B', valorFipe: 22000, score: 95 },
            { texto: 'Versão A', valorFipe: 20000, score: 80 },
          ],
        },
      }),
    } as never)
    const onDadosEncontrados = vi.fn()
    const usuario = userEvent.setup()

    render(<PlacaLookup placaAtual="INT8C36" onDadosEncontrados={onDadosEncontrados} />)
    await usuario.click(screen.getByRole('button', { name: /buscar dados/i }))

    expect(await screen.findByText('Versão B')).toBeInTheDocument()
    expect(onDadosEncontrados).not.toHaveBeenCalled()

    await usuario.click(screen.getByRole('button', { name: /usar esta versão/i }))

    expect(onDadosEncontrados).toHaveBeenCalledWith(expect.objectContaining({ versao: 'Versão B' }))
  })

  it('permite escolher uma versão diferente da pré-selecionada', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        ok: true,
        data: {
          marca: 'VW',
          modelo: 'CROSSFOX',
          anoFabricacao: 2007,
          anoModelo: 2007,
          versoes: [
            { texto: 'Versão B', valorFipe: 22000, score: 95 },
            { texto: 'Versão A', valorFipe: 20000, score: 80 },
          ],
        },
      }),
    } as never)
    const onDadosEncontrados = vi.fn()
    const usuario = userEvent.setup()

    render(<PlacaLookup placaAtual="INT8C36" onDadosEncontrados={onDadosEncontrados} />)
    await usuario.click(screen.getByRole('button', { name: /buscar dados/i }))
    await screen.findByText('Versão A')

    await usuario.click(screen.getByRole('radio', { name: /versão a/i }))
    await usuario.click(screen.getByRole('button', { name: /usar esta versão/i }))

    expect(onDadosEncontrados).toHaveBeenCalledWith(
      expect.objectContaining({ versao: 'Versão A', valorFipeReferencia: 20000 })
    )
  })

  it('valida o formato da placa localmente antes de chamar a API', async () => {
    const usuario = userEvent.setup()

    render(<PlacaLookup placaAtual="AB1234" onDadosEncontrados={vi.fn()} />)
    await usuario.click(screen.getByRole('button', { name: /buscar dados/i }))

    expect(await screen.findByText(/placa inválida/i)).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('mostra mensagem quando a placa não é encontrada', async () => {
    vi.mocked(fetch).mockResolvedValue({ json: async () => ({ ok: false, error: 'nao_encontrada' }) } as never)
    const usuario = userEvent.setup()

    render(<PlacaLookup placaAtual="AAA0000" onDadosEncontrados={vi.fn()} />)
    await usuario.click(screen.getByRole('button', { name: /buscar dados/i }))

    expect(await screen.findByText(/placa não encontrada/i)).toBeInTheDocument()
  })
})

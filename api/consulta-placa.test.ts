import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buscarDadosPlaca } from './consulta-placa.js'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('buscarDadosPlaca', () => {
  it('retorna os dados normalizados quando há uma única correspondência Fipe', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        marca: 'VW',
        modelo: 'CROSSFOX',
        ano: '2007',
        anoModelo: '2007',
        cor: 'Prata',
        extra: { combustivel: 'Alcool / Gasolina', caixa_cambio: '', carroceria: '' },
        fipe: {
          dados: [
            {
              texto_modelo: 'CROSSFOX 1.6 Mi Total Flex 8V 5p',
              texto_valor: 'R$ 28.799,00',
              score: 101,
            },
          ],
        },
      }),
    } as never)

    const resultado = await buscarDadosPlaca('INT8C36', 'token-teste')

    expect(resultado).toEqual({
      ok: true,
      data: {
        marca: 'VW',
        modelo: 'CROSSFOX',
        anoFabricacao: 2007,
        anoModelo: 2007,
        cor: 'Prata',
        combustivel: 'Flex',
        cambio: undefined,
        carroceria: undefined,
        versoes: [{ texto: 'CROSSFOX 1.6 Mi Total Flex 8V 5p', valorFipe: 28799, score: 101 }],
      },
    })
  })

  it('ordena múltiplas correspondências Fipe da maior pra menor pontuação', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        marca: 'VW',
        modelo: 'CROSSFOX',
        ano: '2007',
        anoModelo: '2007',
        cor: 'Prata',
        extra: {},
        fipe: {
          dados: [
            { texto_modelo: 'Versão A', texto_valor: 'R$ 20.000,00', score: 80 },
            { texto_modelo: 'Versão B', texto_valor: 'R$ 22.000,00', score: 95 },
          ],
        },
      }),
    } as never)

    const resultado = await buscarDadosPlaca('INT8C36', 'token-teste')

    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.data.versoes.map((v) => v.texto)).toEqual(['Versão B', 'Versão A'])
    }
  })

  it('mapeia placa não encontrada (406)', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 406, json: async () => ({}) } as never)

    const resultado = await buscarDadosPlaca('AAA0000', 'token-teste')

    expect(resultado).toEqual({ ok: false, codigo: 'nao_encontrada' })
  })

  it('mapeia placa inválida (401)', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 401, json: async () => ({}) } as never)

    const resultado = await buscarDadosPlaca('AAA0000', 'token-teste')

    expect(resultado).toEqual({ ok: false, codigo: 'placa_invalida' })
  })

  it('mapeia limite de consultas atingido (429)', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 429, json: async () => ({}) } as never)

    const resultado = await buscarDadosPlaca('AAA0000', 'token-teste')

    expect(resultado).toEqual({ ok: false, codigo: 'limite_excedido' })
  })

  it('mapeia qualquer outro erro como indisponível', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('timeout'))

    const resultado = await buscarDadosPlaca('AAA0000', 'token-teste')

    expect(resultado).toEqual({ ok: false, codigo: 'indisponivel' })
  })
})

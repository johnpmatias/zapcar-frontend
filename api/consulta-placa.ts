import type { VercelRequest, VercelResponse } from '@vercel/node'

export interface VersaoFipe {
  texto: string
  valorFipe: number
  score: number
}

export interface DadosPlaca {
  marca: string
  modelo: string
  anoFabricacao: number
  anoModelo: number
  cor?: string
  combustivel?: string
  cambio?: string
  carroceria?: string
  versoes: VersaoFipe[]
}

export type CodigoErroConsultaPlaca =
  | 'placa_invalida'
  | 'nao_encontrada'
  | 'token_invalido'
  | 'limite_excedido'
  | 'indisponivel'

export type ResultadoConsultaPlaca =
  | { ok: true; data: DadosPlaca }
  | { ok: false; codigo: CodigoErroConsultaPlaca }

interface RespostaApiPlacas {
  marca: string
  modelo: string
  ano: string
  anoModelo: string
  cor?: string
  extra?: {
    combustivel?: string
    caixa_cambio?: string
    carroceria?: string
  }
  fipe?: {
    dados?: Array<{ texto_modelo: string; texto_valor: string; score: number }>
  }
}

function normalizarCombustivel(valor: string | undefined): string | undefined {
  if (!valor) return undefined
  const texto = valor.toLowerCase()
  const temAlcool = texto.includes('alcool') || texto.includes('etanol') || texto.includes('álcool')
  const temGasolina = texto.includes('gasolina')
  if (temAlcool && temGasolina) return 'Flex'
  if (texto.includes('flex')) return 'Flex'
  if (temGasolina) return 'Gasolina'
  if (temAlcool) return 'Etanol'
  if (texto.includes('diesel')) return 'Diesel'
  if (texto.includes('híbrido') || texto.includes('hibrido')) return 'Híbrido'
  if (texto.includes('elétrico') || texto.includes('eletrico')) return 'Elétrico'
  return undefined
}

function paraNumero(valorEmReais: string): number {
  const limpo = valorEmReais.replace(/[^\d,]/g, '').replace(',', '.')
  return Number(limpo)
}

function vazioParaUndefined(valor: string | undefined): string | undefined {
  return valor ? valor : undefined
}

export async function buscarDadosPlaca(placa: string, token: string): Promise<ResultadoConsultaPlaca> {
  try {
    const resposta = await fetch(`https://wdapi2.com.br/consulta/${placa}/${token}`)

    if (!resposta.ok) {
      if (resposta.status === 401) return { ok: false, codigo: 'placa_invalida' }
      if (resposta.status === 402) return { ok: false, codigo: 'token_invalido' }
      if (resposta.status === 406) return { ok: false, codigo: 'nao_encontrada' }
      if (resposta.status === 429) return { ok: false, codigo: 'limite_excedido' }
      return { ok: false, codigo: 'indisponivel' }
    }

    const corpo = (await resposta.json()) as RespostaApiPlacas

    const versoes: VersaoFipe[] = (corpo.fipe?.dados ?? [])
      .map((item: { texto_modelo: string; texto_valor: string; score: number }) => ({
        texto: item.texto_modelo,
        valorFipe: paraNumero(item.texto_valor),
        score: item.score,
      }))
      .sort((a: VersaoFipe, b: VersaoFipe) => b.score - a.score)

    return {
      ok: true,
      data: {
        marca: corpo.marca,
        modelo: corpo.modelo,
        anoFabricacao: Number(corpo.ano),
        anoModelo: Number(corpo.anoModelo),
        cor: vazioParaUndefined(corpo.cor),
        combustivel: normalizarCombustivel(corpo.extra?.combustivel),
        cambio: vazioParaUndefined(corpo.extra?.caixa_cambio),
        carroceria: vazioParaUndefined(corpo.extra?.carroceria),
        versoes,
      },
    }
  } catch {
    return { ok: false, codigo: 'indisponivel' }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const placa = req.query.placa
  if (typeof placa !== 'string' || placa.trim() === '') {
    res.status(400).json({ error: 'placa_invalida' })
    return
  }

  const token = process.env.APIPLACAS_TOKEN
  if (!token) {
    res.status(500).json({ error: 'token_invalido' })
    return
  }

  const resultado = await buscarDadosPlaca(placa.trim().toUpperCase(), token)

  if (resultado.ok) {
    res.status(200).json({ ok: true, data: resultado.data })
    return
  }

  const statusPorCodigo: Record<CodigoErroConsultaPlaca, number> = {
    placa_invalida: 400,
    nao_encontrada: 404,
    token_invalido: 500,
    limite_excedido: 429,
    indisponivel: 502,
  }

  res.status(statusPorCodigo[resultado.codigo]).json({ ok: false, error: resultado.codigo })
}

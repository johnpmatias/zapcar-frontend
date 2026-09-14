import { z } from 'zod'

export const COMBUSTIVEL_OPTIONS = [
  'Gasolina',
  'Etanol',
  'Flex',
  'Diesel',
  'Híbrido',
  'Elétrico',
] as const

export const CAMBIO_OPTIONS = ['Manual', 'Automático', 'CVT'] as const

export const CARROCERIA_OPTIONS = [
  'Sedã',
  'Hatch',
  'SUV',
  'Picape',
  'Perua/SW',
  'Minivan',
  'Conversível',
] as const

export const STATUS_OPTIONS = ['disponivel', 'reservado', 'vendido', 'inativo'] as const

export const PLACA_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/

const paraIndefinidoSeVazio = (valor: unknown) =>
  valor === '' || valor === null || valor === undefined ? undefined : valor

const numeroOpcional = (schema: z.ZodType<number>) =>
  z.preprocess(paraIndefinidoSeVazio, schema.optional())

const textoOpcional = () => z.preprocess(paraIndefinidoSeVazio, z.string().trim().optional())

export const veiculoSchema = z
  .object({
    marca: z.coerce.string().trim().min(1, 'Informe a marca.'),
    modelo: z.coerce.string().trim().min(1, 'Informe o modelo.'),
    versao: textoOpcional(),
    ano_fabricacao: z.coerce
      .number({ error: 'Informe um ano válido.' })
      .int()
      .min(1950, 'Ano de fabricação inválido.')
      .max(new Date().getFullYear() + 1, 'Ano de fabricação inválido.'),
    ano_modelo: z.coerce
      .number({ error: 'Informe um ano válido.' })
      .int()
      .min(1950, 'Ano do modelo inválido.')
      .max(new Date().getFullYear() + 2, 'Ano do modelo inválido.'),
    cor: textoOpcional(),
    km: numeroOpcional(
      z.coerce.number({ error: 'Informe uma quilometragem válida.' }).int().min(0, 'Quilometragem não pode ser negativa.')
    ),
    combustivel: z.preprocess(paraIndefinidoSeVazio, z.enum(COMBUSTIVEL_OPTIONS).optional()),
    cambio: z.preprocess(paraIndefinidoSeVazio, z.enum(CAMBIO_OPTIONS).optional()),
    carroceria: z.preprocess(paraIndefinidoSeVazio, z.enum(CARROCERIA_OPTIONS).optional()),
    portas: numeroOpcional(z.coerce.number().int().min(1, 'Número de portas inválido.').max(6, 'Número de portas inválido.')),
    placa: z.preprocess(
      (valor) => {
        const semVazio = paraIndefinidoSeVazio(valor)
        return semVazio === undefined ? undefined : String(semVazio).trim().toUpperCase()
      },
      z.string().regex(PLACA_REGEX, 'Placa inválida. Use o formato AAA0X00 ou AAA9999.').optional()
    ),
    preco: z.coerce
      .number({ error: 'Informe um preço válido.' })
      .positive('O preço deve ser maior que zero.'),
    preco_promocional: numeroOpcional(
      z.coerce.number({ error: 'Informe um preço válido.' }).positive('O preço promocional deve ser maior que zero.')
    ),
    aceita_troca: z.coerce.boolean().default(false),
    destaque: z.coerce.boolean().default(false),
    descricao: textoOpcional(),
    opcionais: z.array(z.string().trim().min(1)).default([]),
    status: z.enum(STATUS_OPTIONS).default('disponivel'),
  })
  .refine((dados) => dados.preco_promocional === undefined || dados.preco_promocional < dados.preco, {
    message: 'O preço promocional deve ser menor que o preço normal.',
    path: ['preco_promocional'],
  })

export type VeiculoFormValues = z.infer<typeof veiculoSchema>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase'
import {
  listVeiculos,
  getVeiculo,
  createVeiculo,
  updateVeiculo,
  deleteVeiculo,
  reorderVeiculos,
  type VeiculoPayload,
} from '@/lib/veiculos'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

const payloadExemplo: VeiculoPayload = {
  loja_id: 'loja-1',
  marca: 'Honda',
  modelo: 'Civic',
  versao: null,
  ano_fabricacao: 2023,
  ano_modelo: 2024,
  cor: null,
  km: null,
  combustivel: null,
  cambio: null,
  carroceria: null,
  portas: null,
  placa: null,
  placa_final: null,
  preco: 95000,
  preco_promocional: null,
  aceita_troca: false,
  destaque: false,
  descricao: null,
  opcionais: [],
  status: 'disponivel',
  fotos: [],
  foto_capa: null,
  titulo: 'Honda Civic 2024',
}

beforeEach(() => {
  vi.mocked(supabase.from).mockReset()
})

describe('listVeiculos', () => {
  it('ordena por ordem manual, com data de criação como desempate', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    }
    builder.order.mockReturnValueOnce(builder).mockResolvedValueOnce({
      data: [{ id: '1', ...payloadExemplo }],
      error: null,
    })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const resultado = await listVeiculos()

    expect(supabase.from).toHaveBeenCalledWith('veiculos')
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.order).toHaveBeenNthCalledWith(1, 'ordem', { ascending: true })
    expect(builder.order).toHaveBeenNthCalledWith(2, 'created_at', { ascending: false })
    expect(resultado).toHaveLength(1)
  })

  it('lança erro quando o Supabase retorna erro', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    }
    builder.order.mockReturnValueOnce(builder).mockResolvedValueOnce({
      data: null,
      error: { message: 'falha de rede' },
    })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await expect(listVeiculos()).rejects.toThrow('falha de rede')
  })
})

describe('reorderVeiculos', () => {
  it('atualiza a ordem de cada veículo alterado', async () => {
    const builder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await reorderVeiculos([
      { id: '1', ordem: 0 },
      { id: '2', ordem: 1 },
    ])

    expect(builder.update).toHaveBeenNthCalledWith(1, { ordem: 0 })
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'id', '1')
    expect(builder.update).toHaveBeenNthCalledWith(2, { ordem: 1 })
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'id', '2')
  })

  it('lança erro quando algum update falha', async () => {
    const builder = {
      update: vi.fn().mockReturnThis(),
      eq: vi
        .fn()
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: { message: 'falha de rede' } }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await expect(
      reorderVeiculos([
        { id: '1', ordem: 0 },
        { id: '2', ordem: 1 },
      ])
    ).rejects.toThrow('falha de rede')
  })
})

describe('getVeiculo', () => {
  it('retorna o veículo pelo id', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: '1', ...payloadExemplo }, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const resultado = await getVeiculo('1')

    expect(builder.eq).toHaveBeenCalledWith('id', '1')
    expect(resultado?.id).toBe('1')
  })

  it('retorna null quando não encontra', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    expect(await getVeiculo('inexistente')).toBeNull()
  })
})

describe('createVeiculo', () => {
  it('insere o veículo com o id informado', async () => {
    const builder = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'novo-id', ...payloadExemplo }, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const resultado = await createVeiculo('novo-id', payloadExemplo)

    expect(builder.insert).toHaveBeenCalledWith({ id: 'novo-id', ...payloadExemplo })
    expect(resultado.id).toBe('novo-id')
  })
})

describe('updateVeiculo', () => {
  it('atualiza o veículo pelo id', async () => {
    const builder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: '1', ...payloadExemplo }, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await updateVeiculo('1', payloadExemplo)

    expect(builder.update).toHaveBeenCalledWith(payloadExemplo)
    expect(builder.eq).toHaveBeenCalledWith('id', '1')
  })
})

describe('deleteVeiculo', () => {
  it('remove o veículo pelo id', async () => {
    const builder = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await deleteVeiculo('1')

    expect(builder.eq).toHaveBeenCalledWith('id', '1')
  })
})

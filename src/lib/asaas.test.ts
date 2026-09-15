import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase'
import { criarAssinatura, listarCobrancas } from '@/lib/asaas'

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}))

beforeEach(() => {
  vi.mocked(supabase.functions.invoke).mockReset()
})

describe('criarAssinatura', () => {
  it('retorna o link de pagamento', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { linkPagamento: 'https://sandbox.asaas.com/i/abc123' },
      error: null,
    } as never)

    const link = await criarAssinatura()

    expect(supabase.functions.invoke).toHaveBeenCalledWith('criar-assinatura')
    expect(link).toBe('https://sandbox.asaas.com/i/abc123')
  })

  it('lança erro quando a invocação falha', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: { message: 'falha de rede' },
    } as never)

    await expect(criarAssinatura()).rejects.toThrow('falha de rede')
  })

  it('lança o erro retornado no corpo quando a função responde sem link', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { error: 'Loja não encontrada.' },
      error: null,
    } as never)

    await expect(criarAssinatura()).rejects.toThrow('Loja não encontrada.')
  })
})

describe('listarCobrancas', () => {
  it('retorna a lista de cobranças', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { cobrancas: [{ id: 'pay_1', valor: 97, status: 'CONFIRMED', vencimento: '2026-10-01' }] },
      error: null,
    } as never)

    const cobrancas = await listarCobrancas()

    expect(supabase.functions.invoke).toHaveBeenCalledWith('listar-cobrancas-asaas')
    expect(cobrancas).toEqual([{ id: 'pay_1', valor: 97, status: 'CONFIRMED', vencimento: '2026-10-01' }])
  })

  it('retorna lista vazia quando não há cobrancas', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { cobrancas: [] }, error: null } as never)

    expect(await listarCobrancas()).toEqual([])
  })
})

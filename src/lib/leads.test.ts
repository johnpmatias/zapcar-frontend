import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase'
import { getLeads, updateLeadTemperatura, getInteracoes, setLeadBotAtivo } from '@/lib/leads'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

beforeEach(() => {
  vi.mocked(supabase.from).mockReset()
})

describe('getLeads', () => {
  it('busca todos os leads ordenados pela última atualização', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ id: '1', nome: 'Fulano' }],
        error: null,
      }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const resultado = await getLeads()

    expect(supabase.from).toHaveBeenCalledWith('leads')
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.order).toHaveBeenCalledWith('updated_at', { ascending: false })
    expect(resultado).toHaveLength(1)
  })

  it('lança erro quando o Supabase retorna erro', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'falha de rede' } }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await expect(getLeads()).rejects.toThrow('falha de rede')
  })
})

describe('updateLeadTemperatura', () => {
  it('atualiza a temperatura do lead', async () => {
    const builder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await updateLeadTemperatura('lead-1', 'Quente')

    expect(supabase.from).toHaveBeenCalledWith('leads')
    expect(builder.update).toHaveBeenCalledWith({ temperatura: 'Quente' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'lead-1')
  })

  it('lança erro quando o Supabase retorna erro', async () => {
    const builder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: { message: 'falha de rede' } }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await expect(updateLeadTemperatura('lead-1', 'Quente')).rejects.toThrow('falha de rede')
  })
})

describe('getInteracoes', () => {
  it('busca as interações do lead em ordem cronológica', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ id: '1', lead_id: 'lead-1', remetente: 'LEAD', tipo: 'conversation', conteudo: 'Oi' }],
        error: null,
      }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const resultado = await getInteracoes('lead-1')

    expect(supabase.from).toHaveBeenCalledWith('Interacoes')
    expect(builder.eq).toHaveBeenCalledWith('lead_id', 'lead-1')
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(resultado).toHaveLength(1)
  })

  it('lança erro quando o Supabase retorna erro', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'falha de rede' } }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await expect(getInteracoes('lead-1')).rejects.toThrow('falha de rede')
  })
})

describe('setLeadBotAtivo', () => {
  it('atualiza bot_ativo do lead', async () => {
    const builder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await setLeadBotAtivo('lead-1', false)

    expect(builder.update).toHaveBeenCalledWith({ bot_ativo: false })
    expect(builder.eq).toHaveBeenCalledWith('id', 'lead-1')
  })

  it('lança erro quando o Supabase retorna erro', async () => {
    const builder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: { message: 'falha de rede' } }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await expect(setLeadBotAtivo('lead-1', false)).rejects.toThrow('falha de rede')
  })
})

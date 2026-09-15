import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase'
import { getLojaPublica, listVeiculosPublicos, ehUrlSegura } from '@/lib/vitrine'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

beforeEach(() => {
  vi.mocked(supabase.from).mockReset()
})

describe('getLojaPublica', () => {
  it('busca a loja pelo slug, só quando a vitrine está pública', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { id: 'loja-1', nome_loja: 'Auto Center Silva' }, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const resultado = await getLojaPublica('auto-center-silva')

    expect(supabase.from).toHaveBeenCalledWith('lojas')
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'slug', 'auto-center-silva')
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'vitrine_publica', true)
    expect(resultado?.id).toBe('loja-1')
  })

  it('retorna null quando não encontra (slug inexistente ou vitrine desativada)', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    expect(await getLojaPublica('inexistente')).toBeNull()
  })

  it('lança erro quando o Supabase retorna erro', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'falha de rede' } }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await expect(getLojaPublica('auto-center-silva')).rejects.toThrow('falha de rede')
  })
})

describe('listVeiculosPublicos', () => {
  it('busca os veículos da loja ordenados pela ordem manual', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    }
    builder.order.mockReturnValueOnce(builder).mockResolvedValueOnce({
      data: [{ id: 'v1' }],
      error: null,
    })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const resultado = await listVeiculosPublicos('loja-1')

    expect(supabase.from).toHaveBeenCalledWith('veiculos')
    expect(builder.select).toHaveBeenCalledWith(
      'id,marca,modelo,versao,ano_modelo,km,preco,preco_promocional,status,fotos,foto_capa,ordem'
    )
    expect(builder.select).not.toHaveBeenCalledWith('*')
    expect(builder.eq).toHaveBeenCalledWith('loja_id', 'loja-1')
    expect(builder.order).toHaveBeenNthCalledWith(1, 'ordem', { ascending: true })
    expect(builder.order).toHaveBeenNthCalledWith(2, 'created_at', { ascending: false })
    expect(resultado).toHaveLength(1)
  })

  it('lança erro quando o Supabase retorna erro', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    }
    builder.order.mockReturnValueOnce(builder).mockResolvedValueOnce({
      data: null,
      error: { message: 'falha de rede' },
    })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await expect(listVeiculosPublicos('loja-1')).rejects.toThrow('falha de rede')
  })
})

describe('ehUrlSegura', () => {
  it('aceita URLs http e https', () => {
    expect(ehUrlSegura('https://exemplo.com')).toBe(true)
    expect(ehUrlSegura('http://exemplo.com')).toBe(true)
    expect(ehUrlSegura('HTTPS://exemplo.com')).toBe(true)
  })

  it('rejeita esquemas perigosos, vazio e nulo/indefinido', () => {
    expect(ehUrlSegura("javascript:alert('xss')")).toBe(false)
    expect(ehUrlSegura('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(ehUrlSegura('')).toBe(false)
    expect(ehUrlSegura(null)).toBe(false)
    expect(ehUrlSegura(undefined)).toBe(false)
  })
})

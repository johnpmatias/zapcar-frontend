import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase'
import { getLoja, updateLoja, type LojaPayload } from '@/lib/loja'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

const payloadExemplo: LojaPayload = {
  nome_loja: 'Auto Center Silva',
  descricao: null,
  telefone_contato: null,
  email_contato: null,
  logradouro: null,
  numero: null,
  bairro: null,
  cidade: null,
  estado: null,
  cep: null,
  google_maps_link: null,
  horario_semana_abertura: null,
  horario_semana_fechamento: null,
  horario_sabado_abertura: null,
  horario_sabado_fechamento: null,
  horario_domingo_abertura: null,
  horario_domingo_fechamento: null,
  logo_url: null,
  banner_url: null,
  cor_primaria: null,
  cor_secundaria: null,
  slug: null,
  vitrine_headline: null,
  vitrine_subheadline: null,
  vitrine_cta_texto: null,
  vitrine_cta_destino: null,
  vitrine_destaque_url: null,
  vitrine_destaque_tipo: null,
  meta_titulo: null,
  meta_descricao: null,
  og_image_url: null,
  instagram_url: null,
  facebook_url: null,
  tiktok_url: null,
  youtube_url: null,
  meta_pixel_id: null,
  google_tag_id: null,
}

beforeEach(() => {
  vi.mocked(supabase.from).mockReset()
})

describe('getLoja', () => {
  it('retorna a loja do usuário', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: '1', ...payloadExemplo }, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const resultado = await getLoja('user-1')

    expect(supabase.from).toHaveBeenCalledWith('lojas')
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(resultado?.id).toBe('1')
  })

  it('retorna null quando não encontra', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    expect(await getLoja('user-1')).toBeNull()
  })

  it('lança erro quando o Supabase retorna erro', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'falha de rede' } }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await expect(getLoja('user-1')).rejects.toThrow('falha de rede')
  })
})

describe('updateLoja', () => {
  it('atualiza a loja do usuário', async () => {
    const builder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: '1', ...payloadExemplo }, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await updateLoja('user-1', payloadExemplo)

    expect(builder.update).toHaveBeenCalledWith(payloadExemplo)
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('mapeia erro de slug duplicado (código 23505) pra mensagem amigável', async () => {
    const builder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await expect(updateLoja('user-1', payloadExemplo)).rejects.toThrow(
      'Esse endereço já está em uso, escolha outro.'
    )
  })

  it('lança a mensagem original quando o erro não é de duplicidade', async () => {
    const builder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: '23514', message: 'falha de rede' } }),
    }
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await expect(updateLoja('user-1', payloadExemplo)).rejects.toThrow('falha de rede')
  })
})

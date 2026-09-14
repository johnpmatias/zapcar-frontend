import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase'
import { uploadImagemLoja, removerImagemLoja } from '@/lib/loja-imagens'

vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: vi.fn() } },
}))

beforeEach(() => {
  vi.mocked(supabase.storage.from).mockReset()
})

describe('uploadImagemLoja', () => {
  it('sobe o arquivo e retorna a URL pública', async () => {
    const bucket = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://exemplo.supabase.co/storage/v1/object/public/lojas-imagens/loja-1/logo/img.png' },
      }),
    }
    vi.mocked(supabase.storage.from).mockReturnValue(bucket as never)
    const arquivo = new File(['conteudo'], 'logo.png', { type: 'image/png' })

    const url = await uploadImagemLoja('loja-1', 'logo', arquivo)

    expect(supabase.storage.from).toHaveBeenCalledWith('lojas-imagens')
    expect(bucket.upload).toHaveBeenCalled()
    expect(url).toBe('https://exemplo.supabase.co/storage/v1/object/public/lojas-imagens/loja-1/logo/img.png')
  })

  it('lança erro quando o upload falha', async () => {
    const bucket = {
      upload: vi.fn().mockResolvedValue({ error: { message: 'falha no upload' } }),
      getPublicUrl: vi.fn(),
    }
    vi.mocked(supabase.storage.from).mockReturnValue(bucket as never)
    const arquivo = new File(['conteudo'], 'logo.png', { type: 'image/png' })

    await expect(uploadImagemLoja('loja-1', 'logo', arquivo)).rejects.toThrow('falha no upload')
  })
})

describe('removerImagemLoja', () => {
  it('remove pelo caminho extraído da URL pública', async () => {
    const bucket = { remove: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.storage.from).mockReturnValue(bucket as never)

    await removerImagemLoja('https://exemplo.supabase.co/storage/v1/object/public/lojas-imagens/loja-1/logo/img.png')

    expect(bucket.remove).toHaveBeenCalledWith(['loja-1/logo/img.png'])
  })

  it('não faz nada quando a URL não pertence ao bucket', async () => {
    const bucket = { remove: vi.fn() }
    vi.mocked(supabase.storage.from).mockReturnValue(bucket as never)

    await removerImagemLoja('https://outro-dominio.com/img.png')

    expect(bucket.remove).not.toHaveBeenCalled()
  })
})

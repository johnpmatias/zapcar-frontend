import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase'
import { uploadFotoVeiculo, removerFotoVeiculo } from '@/lib/veiculo-fotos'

vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: vi.fn() } },
}))

beforeEach(() => {
  vi.mocked(supabase.storage.from).mockReset()
})

describe('uploadFotoVeiculo', () => {
  it('sobe o arquivo e retorna a URL pública', async () => {
    const bucket = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://exemplo.supabase.co/storage/v1/object/public/veiculos-fotos/loja-1/veiculo-1/foto.jpg' },
      }),
    }
    vi.mocked(supabase.storage.from).mockReturnValue(bucket as never)
    const arquivo = new File(['conteudo'], 'foto.jpg', { type: 'image/jpeg' })

    const url = await uploadFotoVeiculo('loja-1', 'veiculo-1', arquivo)

    expect(supabase.storage.from).toHaveBeenCalledWith('veiculos-fotos')
    expect(bucket.upload).toHaveBeenCalled()
    expect(url).toBe('https://exemplo.supabase.co/storage/v1/object/public/veiculos-fotos/loja-1/veiculo-1/foto.jpg')
  })

  it('lança erro quando o upload falha', async () => {
    const bucket = {
      upload: vi.fn().mockResolvedValue({ error: { message: 'falha no upload' } }),
      getPublicUrl: vi.fn(),
    }
    vi.mocked(supabase.storage.from).mockReturnValue(bucket as never)
    const arquivo = new File(['conteudo'], 'foto.jpg', { type: 'image/jpeg' })

    await expect(uploadFotoVeiculo('loja-1', 'veiculo-1', arquivo)).rejects.toThrow('falha no upload')
  })
})

describe('removerFotoVeiculo', () => {
  it('remove pelo caminho extraído da URL pública', async () => {
    const bucket = { remove: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.storage.from).mockReturnValue(bucket as never)

    await removerFotoVeiculo(
      'https://exemplo.supabase.co/storage/v1/object/public/veiculos-fotos/loja-1/veiculo-1/foto.jpg'
    )

    expect(bucket.remove).toHaveBeenCalledWith(['loja-1/veiculo-1/foto.jpg'])
  })

  it('não faz nada quando a URL não pertence ao bucket', async () => {
    const bucket = { remove: vi.fn() }
    vi.mocked(supabase.storage.from).mockReturnValue(bucket as never)

    await removerFotoVeiculo('https://outro-dominio.com/foto.jpg')

    expect(bucket.remove).not.toHaveBeenCalled()
  })
})

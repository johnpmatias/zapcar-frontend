import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ehBotDePreview, buscarDadosPreview, montarHtmlPreview } from './vitrine-preview.js'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('ehBotDePreview', () => {
  it('reconhece bots conhecidos de preview de link', () => {
    expect(ehBotDePreview('facebookexternalhit/1.1')).toBe(true)
    expect(ehBotDePreview('WhatsApp/2.23.20.0')).toBe(true)
    expect(ehBotDePreview('Twitterbot/1.0')).toBe(true)
  })

  it('não reconhece um navegador comum', () => {
    expect(ehBotDePreview('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(false)
  })

  it('retorna falso quando não há User-Agent', () => {
    expect(ehBotDePreview(undefined)).toBe(false)
  })
})

describe('buscarDadosPreview', () => {
  it('retorna os dados da loja quando encontrada', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [
        {
          nome_loja: 'Auto Center Silva',
          vitrine_headline: 'Os melhores seminovos da região',
          meta_titulo: null,
          meta_descricao: null,
          og_image_url: null,
        },
      ],
    } as never)

    const dados = await buscarDadosPreview('auto-center-silva', 'https://exemplo.supabase.co', 'chave-publica')

    expect(dados).toEqual({
      nomeLoja: 'Auto Center Silva',
      headline: 'Os melhores seminovos da região',
      metaTitulo: null,
      metaDescricao: null,
      ogImageUrl: null,
    })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('slug=eq.auto-center-silva'),
      expect.objectContaining({ headers: { apikey: 'chave-publica', Authorization: 'Bearer chave-publica' } })
    )
  })

  it('retorna null quando não encontra a loja', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => [] } as never)

    expect(await buscarDadosPreview('inexistente', 'https://exemplo.supabase.co', 'chave-publica')).toBeNull()
  })

  it('retorna null quando a requisição falha', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as never)

    expect(
      await buscarDadosPreview('auto-center-silva', 'https://exemplo.supabase.co', 'chave-publica')
    ).toBeNull()
  })
})

describe('montarHtmlPreview', () => {
  it('monta o HTML com os dados da loja', () => {
    const html = montarHtmlPreview({
      nomeLoja: 'Auto Center Silva',
      headline: 'Os melhores seminovos da região',
      metaTitulo: 'Auto Center Silva - Seminovos',
      metaDescricao: 'Os melhores seminovos da região',
      ogImageUrl: 'https://exemplo.com/og.png',
    })

    expect(html).toContain('<title>Auto Center Silva - Seminovos</title>')
    expect(html).toContain('property="og:title" content="Auto Center Silva - Seminovos"')
    expect(html).toContain('property="og:image" content="https://exemplo.com/og.png"')
  })

  it('monta um HTML genérico quando não há dados (loja não encontrada ou vitrine desativada)', () => {
    const html = montarHtmlPreview(null)

    expect(html).toContain('<title>Vitrine ZapCar</title>')
    expect(html).not.toContain('og:image')
  })
})

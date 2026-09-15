import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import VitrinePage from '@/pages/Vitrine'
import { getLojaPublica, listVeiculosPublicos } from '@/lib/vitrine'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

vi.mock('@/lib/vitrine', () => ({
  getLojaPublica: vi.fn(),
  listVeiculosPublicos: vi.fn(),
  ehUrlSegura: (url: string | null | undefined) => Boolean(url) && /^https?:\/\//i.test(url as string),
}))

const lojaExemplo = {
  id: 'loja-1',
  nome_loja: 'Auto Center Silva',
  descricao: null,
  telefone_contato: '11999998888',
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
  vitrine_headline: 'Os melhores seminovos da região',
  vitrine_subheadline: null,
  vitrine_cta_texto: null,
  vitrine_cta_destino: null,
  vitrine_destaque_url: null,
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

const veiculoExemplo = {
  id: 'v1',
  loja_id: 'loja-1',
  marca: 'Chevrolet',
  modelo: 'Onix',
  versao: null,
  ano_fabricacao: 2022,
  ano_modelo: 2022,
  cor: null,
  km: 42000,
  combustivel: null,
  cambio: null,
  carroceria: null,
  portas: null,
  placa: null,
  placa_final: null,
  preco: 62900,
  preco_promocional: null,
  aceita_troca: false,
  destaque: false,
  descricao: null,
  opcionais: [],
  status: 'disponivel',
  fotos: [],
  foto_capa: null,
  titulo: 'Chevrolet Onix',
  ordem: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.mocked(getLojaPublica).mockReset()
  vi.mocked(listVeiculosPublicos).mockReset()
  document.head.innerHTML = ''
})

function renderPagina(slug = 'auto-center-silva') {
  return render(
    <MemoryRouter initialEntries={[`/v/${slug}`]}>
      <Routes>
        <Route path="/v/:slug" element={<VitrinePage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('VitrinePage', () => {
  it('mostra estado de carregamento e depois a loja e os veículos', async () => {
    vi.mocked(getLojaPublica).mockResolvedValue(lojaExemplo as never)
    vi.mocked(listVeiculosPublicos).mockResolvedValue([veiculoExemplo] as never)

    renderPagina()

    expect(screen.getByText(/carregando/i)).toBeInTheDocument()
    expect(await screen.findByText('Auto Center Silva')).toBeInTheDocument()
    expect(screen.getByText(/os melhores seminovos da região/i)).toBeInTheDocument()
    expect(screen.getByText('Chevrolet Onix')).toBeInTheDocument()
  })

  it('mostra "vitrine não encontrada" quando a loja não existe ou está desativada', async () => {
    vi.mocked(getLojaPublica).mockResolvedValue(null)

    renderPagina('inexistente')

    expect(await screen.findByText(/vitrine não encontrada/i)).toBeInTheDocument()
    expect(listVeiculosPublicos).not.toHaveBeenCalled()
  })

  it('mostra mensagem de vazio quando a loja não tem veículos', async () => {
    vi.mocked(getLojaPublica).mockResolvedValue(lojaExemplo as never)
    vi.mocked(listVeiculosPublicos).mockResolvedValue([])

    renderPagina()

    expect(await screen.findByText(/nenhum veículo disponível no momento/i)).toBeInTheDocument()
  })

  it('mostra erro com botão de tentar novamente quando falha ao carregar', async () => {
    vi.mocked(getLojaPublica).mockRejectedValue(new Error('falha de rede'))

    renderPagina()

    expect(await screen.findByText('falha de rede')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument()
  })

  it('monta o link de WhatsApp do card com o número da loja', async () => {
    vi.mocked(getLojaPublica).mockResolvedValue(lojaExemplo as never)
    vi.mocked(listVeiculosPublicos).mockResolvedValue([veiculoExemplo] as never)

    renderPagina()

    const link = await screen.findByRole('link', { name: /falar no whatsapp/i })
    expect(link.getAttribute('href')).toContain('https://wa.me/5511999998888')
  })

  it('injeta o script de tracking quando meta_pixel_id está preenchido', async () => {
    vi.mocked(getLojaPublica).mockResolvedValue({ ...lojaExemplo, meta_pixel_id: '999999999999999' } as never)
    vi.mocked(listVeiculosPublicos).mockResolvedValue([])

    renderPagina()

    await screen.findByText('Auto Center Silva')
    expect(document.getElementById('zapcar-meta-pixel')).not.toBeNull()
  })

  it('não renderiza o CTA nem redes sociais quando os destinos usam esquema javascript:', async () => {
    vi.mocked(getLojaPublica).mockResolvedValue({
      ...lojaExemplo,
      telefone_contato: null,
      vitrine_cta_destino: "javascript:alert('xss')",
      instagram_url: "javascript:alert('xss')",
      google_maps_link: "javascript:alert('xss')",
    } as never)
    vi.mocked(listVeiculosPublicos).mockResolvedValue([])

    renderPagina()

    await screen.findByText('Auto Center Silva')
    expect(screen.queryByRole('link', { name: /fale com a gente/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /instagram/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /ver no mapa/i })).toBeNull()
    expect(document.querySelector('a[href^="javascript:"]')).toBeNull()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ConfiguracoesPage from '@/pages/Configuracoes'
import { getLoja, updateLoja } from '@/lib/loja'
import { useAuth } from '@/hooks/useAuth'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

vi.mock('@/lib/loja', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/loja')>()),
  getLoja: vi.fn(),
  updateLoja: vi.fn(),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

const lojaExemplo = {
  id: 'user-1',
  user_id: 'user-1',
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
  vitrine_publica: false,
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
  created_at: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.mocked(getLoja).mockReset()
  vi.mocked(updateLoja).mockReset()
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'user-1' } as never,
    session: {} as never,
    loading: false,
    signOut: vi.fn(),
  })
})

function renderPagina() {
  return render(
    <MemoryRouter>
      <ConfiguracoesPage />
    </MemoryRouter>
  )
}

describe('ConfiguracoesPage', () => {
  it('carrega e mostra os dados básicos existentes', async () => {
    vi.mocked(getLoja).mockResolvedValue(lojaExemplo as never)

    renderPagina()

    expect(screen.getByText(/carregando/i)).toBeInTheDocument()
    expect(await screen.findByLabelText(/nome da loja/i)).toHaveValue('Auto Center Silva')
  })

  it('edita e salva os dados básicos', async () => {
    vi.mocked(getLoja).mockResolvedValue(lojaExemplo as never)
    vi.mocked(updateLoja).mockResolvedValue(lojaExemplo as never)
    const usuario = userEvent.setup()

    renderPagina()

    const campoTelefone = await screen.findByLabelText(/telefone/i)
    await usuario.type(campoTelefone, '11999999999')
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/alterações salvas/i)).toBeInTheDocument()
    expect(updateLoja).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ nome_loja: 'Auto Center Silva', telefone_contato: '11999999999' })
    )
  })

  it('mostra erro de validação quando o nome da loja fica vazio', async () => {
    vi.mocked(getLoja).mockResolvedValue(lojaExemplo as never)
    const usuario = userEvent.setup()

    renderPagina()

    const campoNome = await screen.findByLabelText(/nome da loja/i)
    await usuario.clear(campoNome)
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/informe o nome da loja/i)).toBeInTheDocument()
    expect(updateLoja).not.toHaveBeenCalled()
  })

  it('mostra erro com botão de tentar novamente quando falha ao carregar', async () => {
    vi.mocked(getLoja).mockRejectedValue(new Error('falha de rede'))

    renderPagina()

    expect(await screen.findByText('falha de rede')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument()
  })
})

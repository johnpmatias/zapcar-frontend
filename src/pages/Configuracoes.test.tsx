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

vi.mock('@/lib/loja-imagens', () => ({
  uploadImagemLoja: vi.fn(),
  removerImagemLoja: vi.fn(),
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

  it('mostra erro de validação quando a cor primária é inválida e não salva', async () => {
    vi.mocked(getLoja).mockResolvedValue(lojaExemplo as never)
    const usuario = userEvent.setup()

    renderPagina()

    await screen.findByLabelText(/nome da loja/i)
    await usuario.click(screen.getByRole('tab', { name: /aparência/i }))
    await usuario.type(screen.getByLabelText('Cor primária'), 'não-é-cor')
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText('Cor inválida. Use o formato #RRGGBB.')).toBeInTheDocument()
    expect(updateLoja).not.toHaveBeenCalled()
  })

  it('mostra um aviso genérico quando há erro de validação em uma aba oculta', async () => {
    vi.mocked(getLoja).mockResolvedValue(lojaExemplo as never)
    const usuario = userEvent.setup()

    renderPagina()

    const campoNome = await screen.findByLabelText(/nome da loja/i)
    await usuario.clear(campoNome)
    await usuario.click(screen.getByRole('tab', { name: /aparência/i }))
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/há campos inválidos — verifique as abas/i)).toBeInTheDocument()
    expect(updateLoja).not.toHaveBeenCalled()
  })

  it('mostra erro com botão de tentar novamente quando falha ao carregar', async () => {
    vi.mocked(getLoja).mockRejectedValue(new Error('falha de rede'))

    renderPagina()

    expect(await screen.findByText('falha de rede')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument()
  })

  it('edita e salva um campo de endereço na aba Endereço', async () => {
    vi.mocked(getLoja).mockResolvedValue(lojaExemplo as never)
    vi.mocked(updateLoja).mockResolvedValue(lojaExemplo as never)
    const usuario = userEvent.setup()

    renderPagina()

    await screen.findByLabelText(/nome da loja/i)
    await usuario.click(screen.getByRole('tab', { name: /endereço/i }))
    await usuario.type(screen.getByLabelText(/^cidade$/i), 'São Paulo')
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/alterações salvas/i)).toBeInTheDocument()
    expect(updateLoja).toHaveBeenCalledWith('user-1', expect.objectContaining({ cidade: 'São Paulo' }))
  })

  it('edita e salva a cor primária na aba Aparência', async () => {
    vi.mocked(getLoja).mockResolvedValue(lojaExemplo as never)
    vi.mocked(updateLoja).mockResolvedValue(lojaExemplo as never)
    const usuario = userEvent.setup()

    renderPagina()

    await screen.findByLabelText(/nome da loja/i)
    await usuario.click(screen.getByRole('tab', { name: /aparência/i }))
    await usuario.type(screen.getByLabelText('Cor primária'), '#112233')
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/alterações salvas/i)).toBeInTheDocument()
    expect(updateLoja).toHaveBeenCalledWith('user-1', expect.objectContaining({ cor_primaria: '#112233' }))
  })

  it('sobe a logo e envia a URL ao salvar', async () => {
    const { uploadImagemLoja } = await import('@/lib/loja-imagens')
    vi.mocked(uploadImagemLoja).mockResolvedValue('https://exemplo.com/logo.png')
    vi.mocked(getLoja).mockResolvedValue(lojaExemplo as never)
    vi.mocked(updateLoja).mockResolvedValue(lojaExemplo as never)
    const usuario = userEvent.setup()
    const arquivo = new File(['conteudo'], 'logo.png', { type: 'image/png' })

    renderPagina()

    await screen.findByLabelText(/nome da loja/i)
    await usuario.click(screen.getByRole('tab', { name: /aparência/i }))
    await usuario.upload(screen.getByLabelText('Logo'), arquivo)
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/alterações salvas/i)).toBeInTheDocument()
    expect(updateLoja).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ logo_url: 'https://exemplo.com/logo.png' })
    )
  })

  it('sugere o slug automaticamente a partir do nome enquanto ele estiver vazio', async () => {
    vi.mocked(getLoja).mockResolvedValue({ ...lojaExemplo, nome_loja: '', slug: null } as never)
    const usuario = userEvent.setup()

    renderPagina()

    await usuario.type(await screen.findByLabelText(/nome da loja/i), 'Auto Center Silva')
    await usuario.click(screen.getByRole('tab', { name: /vitrine/i }))

    expect(screen.getByLabelText(/endereço da vitrine/i)).toHaveValue('auto-center-silva')
  })

  it('para de sugerir o slug depois que o lojista edita o campo manualmente', async () => {
    vi.mocked(getLoja).mockResolvedValue({ ...lojaExemplo, nome_loja: '', slug: null } as never)
    const usuario = userEvent.setup()

    renderPagina()

    await usuario.type(await screen.findByLabelText(/nome da loja/i), 'Auto Center Silva')
    await usuario.click(screen.getByRole('tab', { name: /vitrine/i }))
    const campoSlug = screen.getByLabelText(/endereço da vitrine/i)
    await usuario.clear(campoSlug)
    await usuario.type(campoSlug, 'minha-loja-top')
    await usuario.click(screen.getByRole('tab', { name: /dados básicos/i }))
    await usuario.type(screen.getByLabelText(/nome da loja/i), ' Ltda')
    await usuario.click(screen.getByRole('tab', { name: /vitrine/i }))

    expect(screen.getByLabelText(/endereço da vitrine/i)).toHaveValue('minha-loja-top')
  })

  it('mostra erro no campo slug quando o Supabase retorna duplicidade', async () => {
    vi.mocked(getLoja).mockResolvedValue(lojaExemplo as never)
    vi.mocked(updateLoja).mockRejectedValue(new Error('Esse endereço já está em uso, escolha outro.'))
    const usuario = userEvent.setup()

    renderPagina()

    await screen.findByLabelText(/nome da loja/i)
    await usuario.click(screen.getByRole('tab', { name: /vitrine/i }))
    await usuario.type(screen.getByLabelText(/endereço da vitrine/i), 'ja-existe')
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText('Esse endereço já está em uso, escolha outro.')).toBeInTheDocument()
  })

  it('sobe a imagem de destaque da vitrine e grava o tipo como imagem', async () => {
    const { uploadImagemLoja } = await import('@/lib/loja-imagens')
    vi.mocked(uploadImagemLoja).mockResolvedValue('https://exemplo.com/destaque.png')
    vi.mocked(getLoja).mockResolvedValue(lojaExemplo as never)
    vi.mocked(updateLoja).mockResolvedValue(lojaExemplo as never)
    const usuario = userEvent.setup()
    const arquivo = new File(['conteudo'], 'destaque.png', { type: 'image/png' })

    renderPagina()

    await screen.findByLabelText(/nome da loja/i)
    await usuario.click(screen.getByRole('tab', { name: /vitrine/i }))
    await usuario.upload(screen.getByLabelText(/imagem de destaque/i), arquivo)
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/alterações salvas/i)).toBeInTheDocument()
    expect(updateLoja).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ vitrine_destaque_url: 'https://exemplo.com/destaque.png', vitrine_destaque_tipo: 'imagem' })
    )
  })

  it('edita e salva os campos de SEO', async () => {
    vi.mocked(getLoja).mockResolvedValue(lojaExemplo as never)
    vi.mocked(updateLoja).mockResolvedValue(lojaExemplo as never)
    const usuario = userEvent.setup()

    renderPagina()

    await screen.findByLabelText(/nome da loja/i)
    await usuario.click(screen.getByRole('tab', { name: /seo/i }))
    await usuario.type(screen.getByLabelText(/título para busca/i), 'Auto Center Silva - Carros seminovos')
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/alterações salvas/i)).toBeInTheDocument()
    expect(updateLoja).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ meta_titulo: 'Auto Center Silva - Carros seminovos' })
    )
  })

  it('edita e salva redes sociais e tracking', async () => {
    vi.mocked(getLoja).mockResolvedValue(lojaExemplo as never)
    vi.mocked(updateLoja).mockResolvedValue(lojaExemplo as never)
    const usuario = userEvent.setup()

    renderPagina()

    await screen.findByLabelText(/nome da loja/i)
    await usuario.click(screen.getByRole('tab', { name: /redes sociais/i }))
    await usuario.type(screen.getByLabelText(/instagram/i), 'https://instagram.com/autocentersilva')
    await usuario.type(screen.getByLabelText(/meta pixel/i), '123456789')
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/alterações salvas/i)).toBeInTheDocument()
    expect(updateLoja).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        instagram_url: 'https://instagram.com/autocentersilva',
        meta_pixel_id: '123456789',
      })
    )
  })

  it('mostra o switch de vitrine pública desabilitado quando não há slug', async () => {
    vi.mocked(getLoja).mockResolvedValue({ ...lojaExemplo, slug: null, nome_loja: '' } as never)
    const usuario = userEvent.setup()

    renderPagina()

    await screen.findByLabelText(/nome da loja/i)
    await usuario.click(screen.getByRole('tab', { name: /vitrine/i }))

    expect(screen.getByRole('switch', { name: /vitrine pública ativa/i })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    expect(screen.getByText(/defina um endereço antes de ativar/i)).toBeInTheDocument()
  })

  it('ativa e salva a vitrine pública quando há slug', async () => {
    vi.mocked(getLoja).mockResolvedValue({ ...lojaExemplo, slug: 'auto-center-silva' } as never)
    vi.mocked(updateLoja).mockResolvedValue(lojaExemplo as never)
    const usuario = userEvent.setup()

    renderPagina()

    await screen.findByLabelText(/nome da loja/i)
    await usuario.click(screen.getByRole('tab', { name: /vitrine/i }))
    await usuario.click(screen.getByRole('switch', { name: /vitrine pública ativa/i }))
    await usuario.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/alterações salvas/i)).toBeInTheDocument()
    expect(updateLoja).toHaveBeenCalledWith('user-1', expect.objectContaining({ vitrine_publica: true }))
  })
})

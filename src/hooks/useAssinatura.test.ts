import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAssinatura } from './useAssinatura'
import { useAuth } from '@/hooks/useAuth'
import { getLoja, type Loja } from '@/lib/loja'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/lib/loja', () => ({
  getLoja: vi.fn(),
}))

function lojaComStatus(overrides: Partial<Loja>): Loja {
  return {
    id: 'loja-1',
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
    subscription_status: 'trial',
    trial_ends_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    asaas_customer_id: null,
    asaas_subscription_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'user-1' } as never,
    session: {} as never,
    loading: false,
    signOut: vi.fn(),
  })
  vi.mocked(getLoja).mockReset()
})

describe('useAssinatura', () => {
  it('dá acesso completo e sem contagem quando a assinatura está ativa', async () => {
    vi.mocked(getLoja).mockResolvedValue(lojaComStatus({ subscription_status: 'active' }))

    const { result } = renderHook(() => useAssinatura())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.status).toBe('active')
    expect(result.current.temAcessoCompleto).toBe(true)
    expect(result.current.diasRestantesTrial).toBeNull()
  })

  it('dá acesso completo e conta os dias restantes durante o trial', async () => {
    vi.mocked(getLoja).mockResolvedValue(
      lojaComStatus({
        subscription_status: 'trial',
        trial_ends_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      })
    )

    const { result } = renderHook(() => useAssinatura())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.temAcessoCompleto).toBe(true)
    expect(result.current.diasRestantesTrial).toBeGreaterThanOrEqual(2)
    expect(result.current.diasRestantesTrial).toBeLessThanOrEqual(3)
  })

  it('bloqueia o acesso quando o trial já venceu', async () => {
    vi.mocked(getLoja).mockResolvedValue(
      lojaComStatus({
        subscription_status: 'trial',
        trial_ends_at: new Date(Date.now() - 86_400_000).toISOString(),
      })
    )

    const { result } = renderHook(() => useAssinatura())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.temAcessoCompleto).toBe(false)
    expect(result.current.diasRestantesTrial).toBeNull()
  })

  it('bloqueia o acesso quando a assinatura está em atraso ou cancelada', async () => {
    vi.mocked(getLoja).mockResolvedValue(lojaComStatus({ subscription_status: 'overdue' }))
    const { result: overdue } = renderHook(() => useAssinatura())
    await waitFor(() => expect(overdue.current.carregando).toBe(false))
    expect(overdue.current.temAcessoCompleto).toBe(false)

    vi.mocked(getLoja).mockResolvedValue(lojaComStatus({ subscription_status: 'canceled' }))
    const { result: canceled } = renderHook(() => useAssinatura())
    await waitFor(() => expect(canceled.current.carregando).toBe(false))
    expect(canceled.current.temAcessoCompleto).toBe(false)
  })

  it('não dá acesso completo enquanto a loja ainda não carregou', () => {
    vi.mocked(getLoja).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useAssinatura())

    expect(result.current.carregando).toBe(true)
    expect(result.current.temAcessoCompleto).toBe(false)
    expect(result.current.status).toBeNull()
  })
})

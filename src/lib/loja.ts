import { supabase } from '@/lib/supabase'

export interface Loja {
  id: string
  user_id: string
  nome_loja: string | null
  descricao: string | null
  telefone_contato: string | null
  email_contato: string | null
  logradouro: string | null
  numero: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
  google_maps_link: string | null
  horario_semana_abertura: string | null
  horario_semana_fechamento: string | null
  horario_sabado_abertura: string | null
  horario_sabado_fechamento: string | null
  horario_domingo_abertura: string | null
  horario_domingo_fechamento: string | null
  logo_url: string | null
  banner_url: string | null
  cor_primaria: string | null
  cor_secundaria: string | null
  slug: string | null
  vitrine_publica: boolean | null
  vitrine_headline: string | null
  vitrine_subheadline: string | null
  vitrine_cta_texto: string | null
  vitrine_cta_destino: string | null
  vitrine_destaque_url: string | null
  vitrine_destaque_tipo: string | null
  meta_titulo: string | null
  meta_descricao: string | null
  og_image_url: string | null
  instagram_url: string | null
  facebook_url: string | null
  tiktok_url: string | null
  youtube_url: string | null
  meta_pixel_id: string | null
  google_tag_id: string | null
  subscription_status: 'trial' | 'active' | 'overdue' | 'canceled'
  trial_ends_at: string
  asaas_customer_id: string | null
  asaas_subscription_id: string | null
  created_at: string
}

export type LojaPayload = Omit<
  Loja,
  | 'id'
  | 'user_id'
  | 'created_at'
  | 'subscription_status'
  | 'trial_ends_at'
  | 'asaas_customer_id'
  | 'asaas_subscription_id'
>

export const ERRO_SLUG_DUPLICADO = 'Esse endereço já está em uso, escolha outro.'

export async function getLoja(userId: string): Promise<Loja | null> {
  const { data, error } = await supabase.from('lojas').select('*').eq('user_id', userId).maybeSingle()

  if (error) throw new Error(error.message)
  return (data as Loja | null) ?? null
}

export async function updateLoja(userId: string, payload: LojaPayload): Promise<Loja> {
  const { data, error } = await supabase
    .from('lojas')
    .update(payload)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new Error(ERRO_SLUG_DUPLICADO)
    throw new Error(error.message)
  }
  return data as Loja
}

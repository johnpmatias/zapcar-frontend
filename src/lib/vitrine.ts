import { supabase } from '@/lib/supabase'
import type { Loja } from '@/lib/loja'
import type { Veiculo } from '@/lib/veiculos'

export type LojaPublica = Pick<
  Loja,
  | 'id'
  | 'nome_loja'
  | 'descricao'
  | 'telefone_contato'
  | 'logradouro'
  | 'numero'
  | 'bairro'
  | 'cidade'
  | 'estado'
  | 'cep'
  | 'google_maps_link'
  | 'horario_semana_abertura'
  | 'horario_semana_fechamento'
  | 'horario_sabado_abertura'
  | 'horario_sabado_fechamento'
  | 'horario_domingo_abertura'
  | 'horario_domingo_fechamento'
  | 'logo_url'
  | 'banner_url'
  | 'cor_primaria'
  | 'cor_secundaria'
  | 'vitrine_headline'
  | 'vitrine_subheadline'
  | 'vitrine_cta_texto'
  | 'vitrine_cta_destino'
  | 'vitrine_destaque_url'
  | 'meta_titulo'
  | 'meta_descricao'
  | 'og_image_url'
  | 'instagram_url'
  | 'facebook_url'
  | 'tiktok_url'
  | 'youtube_url'
  | 'meta_pixel_id'
  | 'google_tag_id'
>

const COLUNAS_LOJA_PUBLICA =
  'id,nome_loja,descricao,telefone_contato,logradouro,numero,bairro,cidade,estado,cep,google_maps_link,' +
  'horario_semana_abertura,horario_semana_fechamento,horario_sabado_abertura,horario_sabado_fechamento,' +
  'horario_domingo_abertura,horario_domingo_fechamento,logo_url,banner_url,cor_primaria,cor_secundaria,' +
  'vitrine_headline,vitrine_subheadline,vitrine_cta_texto,vitrine_cta_destino,vitrine_destaque_url,' +
  'meta_titulo,meta_descricao,og_image_url,instagram_url,facebook_url,tiktok_url,youtube_url,meta_pixel_id,google_tag_id'

export async function getLojaPublica(slug: string): Promise<LojaPublica | null> {
  const { data, error } = await supabase
    .from('lojas')
    .select(COLUNAS_LOJA_PUBLICA)
    .eq('slug', slug)
    .eq('vitrine_publica', true)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as LojaPublica | null) ?? null
}

export async function listVeiculosPublicos(lojaId: string): Promise<Veiculo[]> {
  const { data, error } = await supabase
    .from('veiculos')
    .select('*')
    .eq('loja_id', lojaId)
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Veiculo[]
}

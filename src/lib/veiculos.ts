import { supabase } from '@/lib/supabase'

export interface Veiculo {
  id: string
  loja_id: string
  marca: string
  modelo: string
  versao: string | null
  ano_fabricacao: number
  ano_modelo: number
  cor: string | null
  km: number | null
  combustivel: string | null
  cambio: string | null
  carroceria: string | null
  portas: number | null
  placa: string | null
  placa_final: string | null
  preco: number
  preco_promocional: number | null
  aceita_troca: boolean
  destaque: boolean
  descricao: string | null
  opcionais: string[]
  status: string
  fotos: string[]
  foto_capa: string | null
  titulo: string
  ordem: number
  created_at: string
  updated_at: string
}

export type VeiculoPayload = Omit<Veiculo, 'id' | 'ordem' | 'created_at' | 'updated_at'>

export async function listVeiculos(): Promise<Veiculo[]> {
  const { data, error } = await supabase
    .from('veiculos')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Veiculo[]
}

export async function getVeiculo(id: string): Promise<Veiculo | null> {
  const { data, error } = await supabase.from('veiculos').select('*').eq('id', id).maybeSingle()

  if (error) throw new Error(error.message)
  return (data as Veiculo | null) ?? null
}

export async function createVeiculo(id: string, payload: VeiculoPayload): Promise<Veiculo> {
  const { data, error } = await supabase
    .from('veiculos')
    .insert({ id, ...payload })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Veiculo
}

export async function updateVeiculo(id: string, payload: VeiculoPayload): Promise<Veiculo> {
  const { data, error } = await supabase
    .from('veiculos')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Veiculo
}

export async function deleteVeiculo(id: string): Promise<void> {
  const { error } = await supabase.from('veiculos').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

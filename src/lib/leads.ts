import { supabase } from '@/lib/supabase'

export type TemperaturaLead = 'Frio' | 'Morno' | 'Quente' | 'Agendado'
export type ColunaId = TemperaturaLead | 'novo'

export interface Lead {
  id: string
  loja_id: string
  nome: string | null
  telefone: string | null
  whatsapp: string
  bot_ativo: boolean
  temperatura: TemperaturaLead | null
  resumo_diario: string | null
  data_ultimo_resumo: string | null
  created_at: string
  updated_at: string
}

export interface Interacao {
  id: string
  lead_id: string
  remetente: 'LEAD' | 'LOJA' | 'BOT'
  tipo: string
  conteudo: string
  created_at: string
}

export async function getLeads(): Promise<Lead[]> {
  const { data, error } = await supabase.from('leads').select('*').order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Lead[]
}

export async function updateLeadTemperatura(leadId: string, temperatura: TemperaturaLead): Promise<void> {
  const { error } = await supabase.from('leads').update({ temperatura }).eq('id', leadId)
  if (error) throw new Error(error.message)
}

export async function getInteracoes(leadId: string): Promise<Interacao[]> {
  const { data, error } = await supabase
    .from('Interacoes')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as Interacao[]
}

export async function setLeadBotAtivo(leadId: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from('leads').update({ bot_ativo: ativo }).eq('id', leadId)
  if (error) throw new Error(error.message)
}

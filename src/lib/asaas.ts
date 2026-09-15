import { supabase } from '@/lib/supabase'

export interface Cobranca {
  id: string
  valor: number
  status: string
  vencimento: string
}

export async function criarAssinatura(): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ linkPagamento?: string; error?: string }>(
    'criar-assinatura'
  )
  if (error) throw new Error(error.message)
  if (!data?.linkPagamento) throw new Error(data?.error ?? 'Não foi possível gerar o link de pagamento.')
  return data.linkPagamento
}

export async function listarCobrancas(): Promise<Cobranca[]> {
  const { data, error } = await supabase.functions.invoke<{ cobrancas?: Cobranca[]; error?: string }>(
    'listar-cobrancas-asaas'
  )
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data?.cobrancas ?? []
}

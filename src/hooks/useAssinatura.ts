import { useAuth } from '@/hooks/useAuth'
import { useLoja } from '@/hooks/useLoja'

export type StatusAssinatura = 'trial' | 'active' | 'overdue' | 'canceled'

export interface EstadoAssinatura {
  status: StatusAssinatura | null
  diasRestantesTrial: number | null
  temAcessoCompleto: boolean
  carregando: boolean
  erro: string | null
}

const UM_DIA_MS = 24 * 60 * 60 * 1000

export function useAssinatura(): EstadoAssinatura & { recarregar: () => void } {
  const { user } = useAuth()
  const { loja, carregando, erro, recarregar } = useLoja(user?.id)

  if (!loja) {
    return { status: null, diasRestantesTrial: null, temAcessoCompleto: false, carregando, erro, recarregar }
  }

  const status = loja.subscription_status
  const trialValido = status === 'trial' && new Date(loja.trial_ends_at).getTime() > Date.now()
  const temAcessoCompleto = status === 'active' || trialValido
  const diasRestantesTrial = trialValido
    ? Math.max(0, Math.ceil((new Date(loja.trial_ends_at).getTime() - Date.now()) / UM_DIA_MS))
    : null

  return { status, diasRestantesTrial, temAcessoCompleto, carregando, erro, recarregar }
}

import { Link } from 'react-router-dom'
import { useAssinatura } from '@/hooks/useAssinatura'

export function AssinaturaBanner() {
  const { status, diasRestantesTrial, temAcessoCompleto, carregando } = useAssinatura()

  if (carregando || status === null || status === 'active') return null

  if (temAcessoCompleto) {
    return (
      <div role="status" className="bg-muted px-4 py-2 text-center text-sm">
        Seu trial acaba em {diasRestantesTrial} {diasRestantesTrial === 1 ? 'dia' : 'dias'}.{' '}
        <Link to="/assinatura" className="underline">
          Assinar agora
        </Link>
      </div>
    )
  }

  return (
    <div role="alert" className="bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
      Sua conta está em modo leitura — assine para voltar a criar e editar.{' '}
      <Link to="/assinatura" className="underline">
        Assinar agora
      </Link>
    </div>
  )
}

import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAssinatura } from '@/hooks/useAssinatura'

export function RequireAssinaturaAtiva({ children }: { children: ReactNode }) {
  const { carregando, temAcessoCompleto } = useAssinatura()

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  if (!temAcessoCompleto) {
    return <Navigate to="/assinatura" replace />
  }

  return <>{children}</>
}

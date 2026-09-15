import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const { user, signOut } = useAuth()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-2xl font-semibold">Painel em construção</h1>
      <p className="text-muted-foreground">Logado como {user?.email}</p>
      <Link to="/veiculos" className="underline">
        Ver veículos
      </Link>
      <Link to="/leads" className="underline">
        CRM
      </Link>
      <Link to="/configuracoes" className="underline">
        Configurações da loja
      </Link>
      <Button variant="outline" onClick={() => signOut()}>
        Sair
      </Button>
    </div>
  )
}

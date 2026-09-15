import { useEffect, useState } from 'react'
import { useAssinatura } from '@/hooks/useAssinatura'
import { criarAssinatura, listarCobrancas, type Cobranca } from '@/lib/asaas'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function textoStatus(status: string | null, diasRestantesTrial: number | null): string {
  if (status === 'active') return 'Assinatura ativa.'
  if (status === 'trial' && diasRestantesTrial !== null) {
    return `Você está no trial gratuito — restam ${diasRestantesTrial} ${diasRestantesTrial === 1 ? 'dia' : 'dias'}.`
  }
  return 'Sua conta está em modo leitura. Assine para voltar a criar e editar.'
}

export default function AssinaturaPage() {
  const { status, diasRestantesTrial, temAcessoCompleto, carregando } = useAssinatura()
  const [assinando, setAssinando] = useState(false)
  const [erroAssinar, setErroAssinar] = useState<string | null>(null)
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([])
  const [carregandoCobrancas, setCarregandoCobrancas] = useState(true)

  useEffect(() => {
    listarCobrancas()
      .then(setCobrancas)
      .finally(() => setCarregandoCobrancas(false))
  }, [])

  async function assinar() {
    setErroAssinar(null)
    setAssinando(true)
    try {
      const link = await criarAssinatura()
      window.location.href = link
    } catch (e) {
      setErroAssinar((e as Error).message)
      setAssinando(false)
    }
  }

  if (carregando) {
    return <p className="p-4 text-muted-foreground">Carregando...</p>
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Assinatura</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p>{textoStatus(status, diasRestantesTrial)}</p>

          {erroAssinar && (
            <p role="alert" className="text-sm text-destructive">
              {erroAssinar}
            </p>
          )}

          {!temAcessoCompleto && (
            <Button onClick={assinar} disabled={assinando}>
              {assinando ? 'Gerando link de pagamento...' : 'Assinar agora'}
            </Button>
          )}

          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Histórico de cobranças</h2>
            {carregandoCobrancas && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {!carregandoCobrancas && cobrancas.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma cobrança ainda.</p>
            )}
            {cobrancas.length > 0 && (
              <ul className="flex flex-col gap-2">
                {cobrancas.map((cobranca) => (
                  <li key={cobranca.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <span>{cobranca.vencimento}</span>
                    <span>{cobranca.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    <span>{cobranca.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

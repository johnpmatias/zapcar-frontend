import type { Veiculo } from '@/lib/veiculos'
import { montarLinkWhatsapp } from '@/lib/whatsapp'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface CardVeiculoProps {
  veiculo: Veiculo
  numeroWhatsapp: string | null
}

function formatarPreco(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function CardVeiculo({ veiculo, numeroWhatsapp }: CardVeiculoProps) {
  const foto = veiculo.foto_capa ?? veiculo.fotos[0] ?? null
  const titulo = [veiculo.marca, veiculo.modelo, veiculo.versao].filter(Boolean).join(' ')
  const temPromocao = veiculo.preco_promocional != null && veiculo.preco_promocional < veiculo.preco

  const link = numeroWhatsapp
    ? montarLinkWhatsapp(
        numeroWhatsapp,
        `Olá! Vi o anúncio do ${veiculo.marca} ${veiculo.modelo} ${veiculo.ano_modelo} na vitrine e gostaria de mais informações.`
      )
    : null

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border">
      {foto ? (
        <img src={foto} alt={titulo} className="h-40 w-full object-cover" />
      ) : (
        <div className="flex h-40 items-center justify-center bg-muted text-sm text-muted-foreground">
          Sem foto
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{titulo}</h3>
          {veiculo.status === 'reservado' && <Badge variant="secondary">Reservado</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          {veiculo.ano_modelo}
          {veiculo.km != null ? ` · ${veiculo.km.toLocaleString('pt-BR')} km` : ''}
        </p>
        <div className="mt-1 flex items-baseline gap-2">
          {temPromocao ? (
            <>
              <span className="text-xs text-muted-foreground line-through">{formatarPreco(veiculo.preco)}</span>
              <span className="text-sm font-bold">{formatarPreco(veiculo.preco_promocional as number)}</span>
            </>
          ) : (
            <span className="text-sm font-bold">{formatarPreco(veiculo.preco)}</span>
          )}
        </div>
        {link && (
          <Button className="mt-2" render={<a href={link} target="_blank" rel="noreferrer" />}>
            Falar no WhatsApp
          </Button>
        )}
      </div>
    </div>
  )
}

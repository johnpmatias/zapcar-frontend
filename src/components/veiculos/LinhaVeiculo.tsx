import { Link } from 'react-router-dom'
import type { Veiculo } from '@/lib/veiculos'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface LinhaVeiculoProps {
  veiculo: Veiculo
  excluindoId: string | null
  onExcluir: (id: string) => void
  temAcessoCompleto: boolean
}

export function LinhaVeiculo({ veiculo, excluindoId, onExcluir, temAcessoCompleto }: LinhaVeiculoProps) {
  return (
    <div className="flex flex-1 flex-wrap items-center justify-between gap-2 text-sm">
      <div className="flex flex-1 flex-wrap gap-4">
        <span>{veiculo.marca}</span>
        <span>{veiculo.modelo}</span>
        <span>{veiculo.ano_modelo}</span>
        <span>{veiculo.preco != null ? veiculo.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</span>
        <span>{veiculo.status}</span>
      </div>
      <div className="flex items-center gap-2">
        {temAcessoCompleto && (
          <Link to={`/veiculos/${veiculo.id}/editar`} className="underline">
            Editar
          </Link>
        )}
        <Dialog>
          <DialogTrigger
            render={<Button variant="destructive" size="sm" disabled={!temAcessoCompleto} />}
          >
            Excluir
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir veículo</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir {veiculo.marca} {veiculo.modelo}? Essa ação não pode ser
              desfeita.
            </p>
            <DialogFooter>
              <Button
                variant="destructive"
                disabled={excluindoId === veiculo.id}
                onClick={() => onExcluir(veiculo.id)}
              >
                Confirmar exclusão
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useVeiculos } from '@/hooks/useVeiculos'
import { deleteVeiculo } from '@/lib/veiculos'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export default function VeiculosPage() {
  const { veiculos, carregando, erro, recarregar } = useVeiculos()
  const [excluindoId, setExcluindoId] = useState<string | null>(null)

  async function excluir(idVeiculo: string) {
    setExcluindoId(idVeiculo)
    try {
      await deleteVeiculo(idVeiculo)
      recarregar()
    } finally {
      setExcluindoId(null)
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Veículos</h1>
        <Button render={<Link to="/veiculos/novo">Novo veículo</Link>} />
      </div>

      {carregando && <p className="text-muted-foreground">Carregando...</p>}

      {!carregando && erro && (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
          <Button variant="outline" onClick={recarregar}>
            Tentar novamente
          </Button>
        </div>
      )}

      {!carregando && !erro && veiculos.length === 0 && (
        <p className="text-muted-foreground">Nenhum veículo cadastrado ainda.</p>
      )}

      {!carregando && !erro && veiculos.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2">Marca</th>
              <th className="py-2">Modelo</th>
              <th className="py-2">Ano</th>
              <th className="py-2">Preço</th>
              <th className="py-2">Status</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {veiculos.map((veiculo) => (
              <tr key={veiculo.id} className="border-b">
                <td className="py-2">{veiculo.marca}</td>
                <td className="py-2">{veiculo.modelo}</td>
                <td className="py-2">{veiculo.ano_modelo}</td>
                <td className="py-2">
                  {veiculo.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="py-2">{veiculo.status}</td>
                <td className="py-2 text-right">
                  <Link to={`/veiculos/${veiculo.id}/editar`} className="mr-2 text-sm underline">
                    Editar
                  </Link>
                  <Dialog>
                    <DialogTrigger render={<Button variant="destructive" size="sm" />}>
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
                          onClick={() => excluir(veiculo.id)}
                        >
                          Confirmar exclusão
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

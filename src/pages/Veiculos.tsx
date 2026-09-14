import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useVeiculos } from '@/hooks/useVeiculos'
import { deleteVeiculo, reorderVeiculos, type Veiculo } from '@/lib/veiculos'
import { Button } from '@/components/ui/button'
import { ListaReordenavel } from '@/components/veiculos/ListaReordenavel'
import { LinhaVeiculo } from '@/components/veiculos/LinhaVeiculo'

const STATUS_REORDENAVEL = ['disponivel', 'reservado']

export default function VeiculosPage() {
  const { veiculos, carregando, erro, recarregar } = useVeiculos()
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [disponiveis, setDisponiveis] = useState<Veiculo[]>([])
  const [salvandoOrdem, setSalvandoOrdem] = useState(false)
  const [erroOrdem, setErroOrdem] = useState<string | null>(null)

  useEffect(() => {
    setDisponiveis(veiculos.filter((veiculo) => STATUS_REORDENAVEL.includes(veiculo.status)))
  }, [veiculos])

  const indisponiveis = veiculos.filter((veiculo) => !STATUS_REORDENAVEL.includes(veiculo.status))

  async function excluir(idVeiculo: string) {
    setExcluindoId(idVeiculo)
    try {
      await deleteVeiculo(idVeiculo)
      recarregar()
    } finally {
      setExcluindoId(null)
    }
  }

  async function aoReordenar(novaLista: Veiculo[]) {
    const anterior = disponiveis
    const comNovaOrdem = novaLista.map((veiculo, indice) => ({ ...veiculo, ordem: indice }))

    setErroOrdem(null)
    setDisponiveis(comNovaOrdem)

    const atualizacoes = comNovaOrdem
      .filter((veiculo) => anterior.find((v) => v.id === veiculo.id)?.ordem !== veiculo.ordem)
      .map((veiculo) => ({ id: veiculo.id, ordem: veiculo.ordem }))

    if (atualizacoes.length === 0) return

    setSalvandoOrdem(true)
    try {
      await reorderVeiculos(atualizacoes)
    } catch (e) {
      setDisponiveis(anterior)
      setErroOrdem((e as Error).message)
    } finally {
      setSalvandoOrdem(false)
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
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Disponíveis</h2>

            {erroOrdem && (
              <p role="alert" className="text-sm text-destructive">
                {erroOrdem}
              </p>
            )}
            {salvandoOrdem && (
              <p role="status" className="text-sm text-muted-foreground">
                Salvando ordem...
              </p>
            )}

            {disponiveis.length === 0 && (
              <p className="text-muted-foreground">Nenhum veículo disponível pra reordenar.</p>
            )}

            {disponiveis.length > 0 && (
              <ListaReordenavel
                itens={disponiveis}
                onReordenar={aoReordenar}
                renderItem={(veiculo) => (
                  <LinhaVeiculo veiculo={veiculo} excluindoId={excluindoId} onExcluir={excluir} />
                )}
              />
            )}
          </section>

          {indisponiveis.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold">Vendidos/Inativos</h2>
              <ul className="flex flex-col gap-2">
                {indisponiveis.map((veiculo) => (
                  <li key={veiculo.id} className="flex items-center gap-2 rounded-md border p-2">
                    <LinhaVeiculo veiculo={veiculo} excluindoId={excluindoId} onExcluir={excluir} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

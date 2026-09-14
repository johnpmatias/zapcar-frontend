import { Link } from 'react-router-dom'
import { useVeiculos } from '@/hooks/useVeiculos'
import { Button } from '@/components/ui/button'

export default function VeiculosPage() {
  const { veiculos, carregando, erro, recarregar } = useVeiculos()

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
                  <Link to={`/veiculos/${veiculo.id}/editar`} className="text-sm underline">
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

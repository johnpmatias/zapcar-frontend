import type { ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { uploadFotoVeiculo, removerFotoVeiculo } from '@/lib/veiculo-fotos'

interface FotosFieldProps {
  lojaId: string
  veiculoId: string
  fotos: string[]
  fotoCapa: string | null
  onChange: (fotos: string[], fotoCapa: string | null) => void
}

export function FotosField({ lojaId, veiculoId, fotos, fotoCapa, onChange }: FotosFieldProps) {
  async function aoSelecionarArquivos(evento: ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(evento.target.files ?? [])
    evento.target.value = ''

    const novasUrls: string[] = []
    for (const arquivo of arquivos) {
      const url = await uploadFotoVeiculo(lojaId, veiculoId, arquivo)
      novasUrls.push(url)
    }

    const todasAsFotos = [...fotos, ...novasUrls]
    const novaCapa = fotoCapa ?? novasUrls[0] ?? null
    onChange(todasAsFotos, novaCapa)
  }

  async function remover(url: string) {
    await removerFotoVeiculo(url)
    const restantes = fotos.filter((f) => f !== url)
    const novaCapa = fotoCapa === url ? (restantes[0] ?? null) : fotoCapa
    onChange(restantes, novaCapa)
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="fotos-input">Adicionar fotos</Label>
      <input id="fotos-input" type="file" accept="image/*" multiple onChange={aoSelecionarArquivos} />

      <div className="flex flex-wrap gap-3">
        {fotos.map((url) => (
          <div key={url} className="flex flex-col items-center gap-1">
            <img src={url} alt="Foto do veículo" className="h-20 w-28 rounded object-cover" />
            <div className="flex gap-1">
              <Button
                type="button"
                variant={url === fotoCapa ? 'default' : 'outline'}
                size="xs"
                onClick={() => onChange(fotos, url)}
              >
                {url === fotoCapa ? 'Capa' : 'Definir capa'}
              </Button>
              <Button type="button" variant="destructive" size="xs" aria-label="Remover foto" onClick={() => remover(url)}>
                Remover
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

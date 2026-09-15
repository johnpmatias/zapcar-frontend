import { useCallback, useEffect, useState } from 'react'
import { getLojaPublica, listVeiculosPublicos, type LojaPublica } from '@/lib/vitrine'
import type { Veiculo } from '@/lib/veiculos'

interface EstadoVitrine {
  loja: LojaPublica | null
  veiculos: Veiculo[]
  carregando: boolean
  erro: string | null
}

const ESTADO_INICIAL: EstadoVitrine = { loja: null, veiculos: [], carregando: true, erro: null }

export function useVitrine(slug: string) {
  const [estado, setEstado] = useState<EstadoVitrine>(ESTADO_INICIAL)

  const carregar = useCallback(() => {
    setEstado({ loja: null, veiculos: [], carregando: true, erro: null })

    getLojaPublica(slug)
      .then(async (loja) => {
        if (!loja) {
          setEstado({ loja: null, veiculos: [], carregando: false, erro: null })
          return
        }
        const veiculos = await listVeiculosPublicos(loja.id)
        setEstado({ loja, veiculos, carregando: false, erro: null })
      })
      .catch((e: Error) => setEstado({ loja: null, veiculos: [], carregando: false, erro: e.message }))
  }, [slug])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { ...estado, recarregar: carregar }
}

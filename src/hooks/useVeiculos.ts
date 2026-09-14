import { useCallback, useEffect, useState } from 'react'
import { listVeiculos, type Veiculo } from '@/lib/veiculos'

export function useVeiculos() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(() => {
    setCarregando(true)
    setErro(null)
    listVeiculos()
      .then(setVeiculos)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { veiculos, carregando, erro, recarregar: carregar }
}

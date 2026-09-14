import { useCallback, useEffect, useState } from 'react'
import { getLoja, type Loja } from '@/lib/loja'

export function useLoja(userId: string | undefined) {
  const [loja, setLoja] = useState<Loja | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(() => {
    if (!userId) return
    setCarregando(true)
    setErro(null)
    getLoja(userId)
      .then(setLoja)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [userId])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { loja, carregando, erro, recarregar: carregar }
}

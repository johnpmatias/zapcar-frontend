import { useCallback, useEffect, useState } from 'react'
import { getLeads, type Lead } from '@/lib/leads'

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(() => {
    setCarregando(true)
    setErro(null)
    getLeads()
      .then(setLeads)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { leads, carregando, erro, recarregar: carregar }
}

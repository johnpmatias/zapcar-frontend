import type { ColunaId, TemperaturaLead } from '@/lib/leads'

export function decidirMovimentoLead(
  over: { id: string | number } | null,
  colunaAtual: ColunaId
): TemperaturaLead | null {
  if (!over) return null
  if (over.id === 'novo') return null
  if (over.id === colunaAtual) return null
  return over.id as TemperaturaLead
}

import { useDraggable } from '@dnd-kit/core'
import { Badge } from '@/components/ui/badge'
import type { Lead } from '@/lib/leads'

export function tempoRelativo(dataIso: string, agora: Date = new Date()): string {
  const diffMs = agora.getTime() - new Date(dataIso).getTime()
  const minutos = Math.floor(diffMs / 60000)
  if (minutos < 60) return `há ${minutos}min`

  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas}h`

  const dias = Math.floor(horas / 24)
  return `há ${dias}d`
}

interface LeadCardProps {
  lead: Lead
  onAbrir: () => void
}

export function LeadCard({ lead, onAbrir }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id })

  const estilo = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  return (
    <div
      ref={setNodeRef}
      style={estilo}
      className={`flex flex-col gap-1 rounded-md border bg-card p-2 text-sm ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onAbrir} className="text-left font-medium hover:underline">
          {lead.nome || lead.telefone || 'Sem nome'}
        </button>
        <button
          type="button"
          aria-label="Arrastar para outra coluna"
          className="cursor-grab touch-none text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
      </div>
      <span className="text-xs text-muted-foreground">{lead.telefone}</span>
      <p className="line-clamp-2 text-xs text-muted-foreground">{lead.resumo_diario || 'Sem resumo ainda'}</p>
      <div className="flex items-center justify-between">
        <Badge variant={lead.bot_ativo ? 'secondary' : 'default'}>
          {lead.bot_ativo ? 'Bot ativo' : 'Atendimento humano'}
        </Badge>
        <span className="text-xs text-muted-foreground">{tempoRelativo(lead.updated_at)}</span>
      </div>
    </div>
  )
}

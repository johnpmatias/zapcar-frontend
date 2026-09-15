import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { KanbanColuna } from './KanbanColuna'
import { LeadCard } from './LeadCard'
import { coordenadasColuna } from './coordenadasColuna'
import { decidirMovimentoLead } from './decidirMovimentoLead'
import type { ColunaId, Lead, TemperaturaLead } from '@/lib/leads'

const COLUNAS: { id: ColunaId; titulo: string }[] = [
  { id: 'novo', titulo: 'Novo' },
  { id: 'Frio', titulo: 'Frio' },
  { id: 'Morno', titulo: 'Morno' },
  { id: 'Quente', titulo: 'Quente' },
  { id: 'Agendado', titulo: 'Agendado' },
]

interface KanbanBoardProps {
  leads: Lead[]
  onMoverLead: (leadId: string, novaTemperatura: TemperaturaLead) => void
  onAbrirLead: (lead: Lead) => void
}

export function KanbanBoard({ leads, onMoverLead, onAbrirLead }: KanbanBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: coordenadasColuna })
  )

  function aoTerminarDrag(evento: DragEndEvent) {
    const lead = leads.find((l) => l.id === evento.active.id)
    if (!lead) return

    const destino = decidirMovimentoLead(evento.over, lead.temperatura ?? 'novo')
    if (destino) onMoverLead(lead.id, destino)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={aoTerminarDrag}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUNAS.map((coluna) => {
          const leadsColuna = leads.filter((lead) => (lead.temperatura ?? 'novo') === coluna.id)
          return (
            <KanbanColuna key={coluna.id} id={coluna.id} titulo={coluna.titulo} quantidade={leadsColuna.length}>
              {leadsColuna.map((lead) => (
                <LeadCard key={lead.id} lead={lead} onAbrir={() => onAbrirLead(lead)} />
              ))}
            </KanbanColuna>
          )
        })}
      </div>
    </DndContext>
  )
}

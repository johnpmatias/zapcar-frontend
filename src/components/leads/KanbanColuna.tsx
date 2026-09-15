import type { ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'

interface KanbanColunaProps {
  id: string
  titulo: string
  quantidade: number
  children: ReactNode
}

export function KanbanColuna({ id, titulo, quantidade, children }: KanbanColunaProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      data-testid={`coluna-${id}`}
      className={`flex w-72 shrink-0 flex-col gap-2 rounded-md border p-2 ${isOver ? 'bg-muted' : ''}`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        <span className="text-xs text-muted-foreground">{quantidade}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

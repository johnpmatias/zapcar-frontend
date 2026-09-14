import type { ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

interface ItemComId {
  id: string
}

interface ListaReordenavelProps<T extends ItemComId> {
  itens: T[]
  onReordenar: (novaOrdem: T[]) => void
  renderItem: (item: T) => ReactNode
}

export function ListaReordenavel<T extends ItemComId>({
  itens,
  onReordenar,
  renderItem,
}: ListaReordenavelProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function aoTerminarDrag(evento: DragEndEvent) {
    const { active, over } = evento
    if (!over || active.id === over.id) return

    const indiceAntigo = itens.findIndex((item) => item.id === active.id)
    const indiceNovo = itens.findIndex((item) => item.id === over.id)
    onReordenar(arrayMove(itens, indiceAntigo, indiceNovo))
  }

  return (
    <DndContext sensors={sensors} onDragEnd={aoTerminarDrag}>
      <SortableContext items={itens.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2">
          {itens.map((item) => (
            <ItemArrastavel key={item.id} id={item.id}>
              {renderItem(item)}
            </ItemArrastavel>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function ItemArrastavel({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })

  const estilo = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li ref={setNodeRef} style={estilo} className="flex items-center gap-2 rounded-md border p-2">
      <button
        type="button"
        aria-label="Arrastar para reordenar"
        className="cursor-grab touch-none text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="flex-1">{children}</div>
    </li>
  )
}

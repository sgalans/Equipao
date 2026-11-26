import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'
import type { DndData, DragHandle } from './packingDndLogic'

/**
 * Algo arrastrable de la lista única de la maleta (un artículo o la
 * CABECERA de un compartimento), como render prop. La lógica (lista
 * aplanada, dónde se suelta, textos) está en packingDndLogic.ts: un .tsx que
 * exporta algo más que componentes rompe el Fast Refresh de Vite.
 */
export function Draggable({
  id,
  data,
  children,
}: {
  id: string
  data: DndData
  children: (drag: DragHandle) => ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    isDragging,
  } = useSortable({ id, data })
  return children({
    setRowRef: setNodeRef,
    rowStyle: {
      // Solo el desplazamiento, SIN `transition` (decisión del usuario: nada
      // de animaciones): lo demás se aparta al instante.
      transform: CSS.Translate.toString(transform),
      position: 'relative',
      zIndex: isDragging ? 1 : undefined,
    },
    isDragging,
    handleProps: { ...attributes, ...listeners, ref: setActivatorNodeRef },
  })
}

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState, type ReactNode } from 'react'
import type { LuggageEntry } from '../domain/itemQuantityRepository'
import styles from './PackingList.module.css'

/** Lo que una fila necesita para poder arrastrarse por su asa. */
export interface DragHandle {
  /** ref + style de la fila entera (la que se desplaza con el dedo). */
  setRowRef: (node: HTMLElement | null) => void
  rowStyle: React.CSSProperties
  isDragging: boolean
  /** Props del asa ≡ (solo ella inicia el arrastre). */
  handleProps: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    ref: (node: HTMLElement | null) => void
  }
}

/** Textos para el lector de pantalla (dnd-kit los trae en inglés). */
const accessibility = {
  screenReaderInstructions: {
    draggable:
      'Para reordenar, pulsa espacio o Intro, muévelo con las flechas y vuelve a pulsar espacio o Intro para soltarlo. Escape cancela.',
  },
  announcements: {
    onDragStart: () => 'Artículo cogido.',
    onDragOver: () => 'Moviendo.',
    onDragEnd: ({ over }: { over: unknown }) =>
      over ? 'Artículo soltado en su nuevo sitio.' : 'Artículo soltado.',
    onDragCancel: () => 'Movimiento cancelado.',
  },
}

function SortableItem({
  entry,
  renderRow,
}: {
  entry: LuggageEntry
  renderRow: (entry: LuggageEntry, drag: DragHandle) => ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    isDragging,
  } = useSortable({ id: entry.id })
  return renderRow(entry, {
    setRowRef: setNodeRef,
    rowStyle: {
      // Solo el desplazamiento, SIN `transition` (decisión del usuario: nada
      // de animaciones): las filas se apartan al instante.
      transform: CSS.Translate.toString(transform),
      position: 'relative',
      zIndex: isDragging ? 1 : undefined,
    },
    isDragging,
    handleProps: { ...attributes, ...listeners, ref: setActivatorNodeRef },
  })
}

/**
 * Lista de un GRUPO (sueltos o un compartimento) que se ordena arrastrando
 * por el asa ≡ (dnd-kit). Solo dentro del grupo (decisión del usuario): cada
 * grupo tiene su propio DndContext, así que no se puede soltar en otro.
 *
 * Al soltar, `onMove` recibe los vecinos del nuevo sitio (para
 * quantities.reorder) y el nuevo orden se muestra AL MOMENTO (orden
 * optimista) mientras se guarda: sin él se vería un instante el orden viejo.
 */
export function SortableRows({
  rows,
  renderRow,
  onMove,
}: {
  rows: LuggageEntry[]
  renderRow: (entry: LuggageEntry, drag: DragHandle) => ReactNode
  onMove: (
    id: string,
    before: LuggageEntry | undefined,
    after: LuggageEntry | undefined,
  ) => void
}) {
  // Teclado además del dedo: accesible sin pantalla táctil (y probable).
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Orden optimista, válido SOLO para los datos en los que se calculó: en
  // cuanto llega el orden guardado (cambia `rowsKey`), se ignora solo.
  const rowsKey = rows.map((row) => row.id).join(' ')
  const [optimistic, setOptimistic] = useState<{
    basedOn: string
    rows: LuggageEntry[]
  } | null>(null)
  const shown =
    optimistic?.basedOn === rowsKey
      ? // Datos frescos de cada fila, en el orden optimista.
        optimistic.rows.map(
          (stale) => rows.find((row) => row.id === stale.id) ?? stale,
        )
      : rows

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = shown.findIndex((row) => row.id === active.id)
    const to = shown.findIndex((row) => row.id === over.id)
    const reordered = arrayMove(shown, from, to)
    setOptimistic({ basedOn: rowsKey, rows: reordered })
    onMove(String(active.id), reordered[to - 1], reordered[to + 1])
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={accessibility}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={shown.map((row) => row.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className={styles.list}>
          {shown.map((entry) => (
            <SortableItem key={entry.id} entry={entry} renderRow={renderRow} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

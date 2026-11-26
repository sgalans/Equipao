import { arrayMove } from '@dnd-kit/sortable'

/**
 * Lógica del arrastre de la maleta (ver packingDnd.tsx para los
 * componentes). Modelo "árbol aplanado" (flattened tree, decisión del
 * usuario): la maleta entera es UNA sola lista ordenable de filas, en el
 * orden en que se ven:
 *
 *   A, B,            ← sueltos (antes de la primera cabecera)
 *   [Neceser], C, D, ← un compartimento: su cabecera y sus artículos
 *   [Mochila], E     ← el siguiente
 *
 * El compartimento de un artículo NO se guarda en la lista: se deduce de su
 * posición (la cabecera más cercana por encima; ninguna = suelto). Así, al
 * arrastrar, en cuanto un artículo cruza una cabecera ya está dentro, y un
 * compartimento vacío o plegado es una cabecera sin filas debajo. Con un
 * solo tipo de destino (la fila de al lado) no hay saltos entre listas.
 */

/** Qué es cada fila arrastrable. */
export type DndData = { type: 'item' } | { type: 'compartment' }

/** Lo que una fila o una cabecera necesita para arrastrarse por su asa. */
export interface DragHandle {
  /** ref + style del elemento que se desplaza con el dedo. */
  setRowRef: (node: HTMLElement | null) => void
  rowStyle: React.CSSProperties
  isDragging: boolean
  /** Props del asa ≡ (solo ella inicia el arrastre). */
  handleProps: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    ref: (node: HTMLElement | null) => void
  }
}

/** Textos para el lector de pantalla (dnd-kit los trae en inglés). */
export const dndAccessibility = {
  screenReaderInstructions: {
    draggable:
      'Para mover, pulsa espacio o Intro, muévelo con las flechas y vuelve a pulsar espacio o Intro para soltarlo. Escape cancela.',
  },
  announcements: {
    onDragStart: () => 'Cogido.',
    onDragOver: () => 'Moviendo.',
    onDragEnd: ({ over }: { over: unknown }) =>
      over ? 'Soltado en su nuevo sitio.' : 'Soltado.',
    onDragCancel: () => 'Movimiento cancelado.',
  },
}

/** Una lista aplanada repartida por grupos. */
export interface FlatGroups {
  loose: string[]
  compartmentIds: string[]
  /** Artículos de cada compartimento, en orden. */
  items: Record<string, string[]>
}

/**
 * Reparte la lista aplanada: lo de antes de la primera cabecera es suelto;
 * lo de después de cada cabecera, de ese compartimento.
 */
export function parseFlat(
  flat: readonly string[],
  isCompartment: (id: string) => boolean,
): FlatGroups {
  const groups: FlatGroups = { loose: [], compartmentIds: [], items: {} }
  let current = groups.loose
  for (const id of flat) {
    if (isCompartment(id)) {
      groups.compartmentIds.push(id)
      groups.items[id] = []
      current = groups.items[id]
    } else {
      current.push(id)
    }
  }
  return groups
}

/** Dónde queda un ARTÍCULO al soltarlo. */
export interface ItemDrop {
  type: 'item'
  flat: string[]
  /** null = suelto. */
  compartmentId: string | null
  /** Vecinos DENTRO de su grupo (null = sin vecino por ese lado). */
  beforeId: string | null
  afterId: string | null
}

/** Dónde queda un COMPARTIMENTO al soltarlo (entre otros compartimentos). */
export interface CompartmentDrop {
  type: 'compartment'
  flat: string[]
  beforeId: string | null
  afterId: string | null
}

/**
 * Al soltar `activeId` sobre `overId` (lo que hay bajo el dedo): la nueva
 * lista y lo que hay que guardar. Pura y con tests.
 * - Artículo: su compartimento es la cabecera más cercana por encima, y sus
 *   vecinos son los artículos contiguos de ese mismo grupo.
 * - Compartimento: sus vecinos son las cabeceras de antes y después (los
 *   artículos de por medio no cuentan).
 */
export function resolveFlatDrop(
  flat: readonly string[],
  isCompartment: (id: string) => boolean,
  activeId: string,
  overId: string,
): ItemDrop | CompartmentDrop | null {
  const from = flat.indexOf(activeId)
  const to = flat.indexOf(overId)
  if (from < 0 || to < 0) return null
  const next = arrayMove([...flat], from, to)

  if (isCompartment(activeId)) {
    const headers = next.filter(isCompartment)
    const index = headers.indexOf(activeId)
    return {
      type: 'compartment',
      flat: next,
      beforeId: headers[index - 1] ?? null,
      afterId: headers[index + 1] ?? null,
    }
  }

  let compartmentId: string | null = null
  for (let i = to - 1; i >= 0; i--) {
    if (isCompartment(next[i])) {
      compartmentId = next[i]
      break
    }
  }
  const neighbour = (id: string | undefined) =>
    id !== undefined && !isCompartment(id) ? id : null
  return {
    type: 'item',
    flat: next,
    compartmentId,
    beforeId: neighbour(next[to - 1]),
    afterId: neighbour(next[to + 1]),
  }
}

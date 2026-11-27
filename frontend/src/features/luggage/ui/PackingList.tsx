import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useState } from 'react'
import { useRepositories } from '@/shared/di/repositories'
import { reportError } from '@/shared/ui/notifications/notificationStore'
import type { Compartment } from '../domain/compartment'
import type { LuggageEntry } from '../domain/itemQuantityRepository'
import { useCollapsedCompartments } from './collapsedCompartmentsStore'
import { CompartmentSection } from './CompartmentSection'
import { Draggable } from './packingDnd'
import {
  dndAccessibility,
  parseFlat,
  resolveFlatDrop,
  type DragHandle,
} from './packingDndLogic'
import {
  isHiddenCompartment,
  isHiddenEntry,
  type HiddenSnapshot,
} from './packingOrderStore'
import styles from './PackingList.module.css'
import { PackingListRow } from './PackingListRow'

interface PackingListProps {
  entries: LuggageEntry[]
  compartments: Compartment[]
  /** Artículos listos ocultos (ver packingOrderStore); undefined = ninguno. */
  hidden: HiddenSnapshot | undefined
  /** Modo selección: qué líneas están marcadas y cómo cambiar una. */
  selection?: {
    selected: ReadonlySet<string>
    onToggle: (quantityId: string) => void
  }
}

/**
 * Contenido de la maleta, SIEMPRE en el orden del usuario: artículos
 * sueltos y compartimentos. Nada cambia de sitio solo: "Ocultar listos" solo deja de pintar lo listo.
 *
 * Arrastre (decisión del usuario): la maleta es UNA sola lista ordenable
 * ("árbol aplanado", ver packingDndLogic.ts): sueltos, y cada compartimento
 * como su cabecera seguida de sus artículos. Un artículo se mueve dentro de
 * su grupo, a otro compartimento o a sueltos solo por dónde se suelta; los
 * compartimentos se mueven por su cabecera. El HTML sigue agrupado por
 * compartimento (accesible): dnd-kit ordena por la lista de ids, no por el
 * anidamiento del DOM.
 */
export function PackingList({
  entries,
  compartments,
  hidden,
  selection,
}: PackingListProps) {
  // Acordeón: como mucho una fila desplegada EN TODA LA MALETA.
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const collapsed = useCollapsedCompartments((state) => state.collapsed)
  const repositories = useRepositories()
  const { quantities } = repositories

  // Teclado además del dedo: accesible sin pantalla táctil.
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Compartimento que se está arrastrando: se ve plegado mientras tanto.
  const [draggingCompartmentId, setDraggingCompartmentId] = useState<
    string | null
  >(null)

  const isShown = (entry: LuggageEntry) => !isHiddenEntry(entry, hidden)
  const entryById = new Map(entries.map((entry) => [entry.id, entry]))
  const compartmentById = new Map(compartments.map((c) => [c.id, c]))
  const isCompartment = (id: string) => compartmentById.has(id)

  /**
   * La lista aplanada a partir de los DATOS, en el orden de compartimentos
   * dado. Sin los artículos de un compartimento plegado (o del que se
   * arrastra), ni lo oculto con el ojo: lo que no se ve no es un destino.
   */
  function buildFlat(compartmentOrder: Compartment[]): string[] {
    const flat = entries
      .filter((e) => e.compartmentId === null && isShown(e))
      .map((e) => e.id)
    for (const compartment of compartmentOrder) {
      flat.push(compartment.id)
      if (collapsed[compartment.id] || draggingCompartmentId === compartment.id)
        continue
      for (const e of entries) {
        if (e.compartmentId === compartment.id && isShown(e)) flat.push(e.id)
      }
    }
    return flat
  }

  // Los compartimentos completos y ocultos con el ojo no se pintan ni
  // cuentan como vecinos (igual que los artículos).
  const visibleCompartments = compartments.filter(
    (c) => !isHiddenCompartment(c, entries, hidden),
  )

  // Orden optimista al soltar: válido SOLO para los datos en los que se
  // calculó; en cuanto llega lo guardado (cambia `dataKey`), se ignora solo.
  const dataKey =
    entries.map((e) => `${e.id}:${e.compartmentId}`).join(',') +
    '|' +
    compartments.map((c) => c.id).join(',')
  const [optimistic, setOptimistic] = useState<{
    basedOn: string
    flat: string[]
  } | null>(null)
  const flat =
    optimistic?.basedOn === dataKey
      ? optimistic.flat
      : buildFlat(visibleCompartments)
  const groups = parseFlat(flat, isCompartment)

  function handleDragStart({ active }: DragStartEvent) {
    if (isCompartment(String(active.id))) {
      setDraggingCompartmentId(String(active.id))
    }
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggingCompartmentId(null)
    if (!over) return
    // Las reglas (a qué grupo va, entre qué vecinos) están en
    // resolveFlatDrop, pura y con tests: aquí solo se aplica y se guarda.
    const drop = resolveFlatDrop(
      flat,
      isCompartment,
      String(active.id),
      String(over.id),
    )
    if (!drop) return
    const id = String(active.id)

    if (drop.type === 'compartment') {
      // La lista se recompone desde los datos con el nuevo orden (sus
      // artículos van con él, aunque en la lista se soltara entre otros).
      const order = parseFlat(drop.flat, isCompartment).compartmentIds
      setOptimistic({
        basedOn: dataKey,
        flat: buildFlat(
          order.map((cid) => compartmentById.get(cid)).filter((c) => !!c),
        ),
      })
      void repositories.compartments
        .reorder(id, drop.beforeId, drop.afterId)
        .catch(reportError)
      return
    }

    // Si en su nuevo grupo no tiene vecinos a la vista (compartimento
    // plegado, o todo lo demás oculto), va al FINAL de ese grupo en los
    // datos: si no, la clave se generaría sin referencia.
    let beforeId = drop.beforeId
    if (beforeId === null && drop.afterId === null) {
      const rest = entries.filter(
        (e) => e.compartmentId === drop.compartmentId && e.id !== id,
      )
      beforeId = rest.at(-1)?.id ?? null
    }
    setOptimistic({ basedOn: dataKey, flat: drop.flat })
    void quantities
      .place(id, drop.compartmentId, beforeId, drop.afterId)
      .catch(reportError)
  }

  /**
   * "Subir"/"Bajar" respecto a los vecinos VISIBLES de su grupo (lo oculto
   * con el ojo no cuenta). Subir = entre el de dos más arriba y el de encima.
   */
  function reorderHandlers(ids: string[], index: number) {
    const move = (before?: string, after?: string) => () =>
      void quantities
        .reorder(ids[index], before ?? null, after ?? null)
        .catch(reportError)
    return {
      onMoveUp: index > 0 ? move(ids[index - 2], ids[index - 1]) : null,
      onMoveDown:
        index < ids.length - 1 ? move(ids[index + 1], ids[index + 2]) : null,
    }
  }

  /** Una fila; `drag` = asa para arrastrar (sin ella, en modo selección). */
  function renderRow(ids: string[], entry: LuggageEntry, drag?: DragHandle) {
    return (
      <PackingListRow
        {...reorderHandlers(ids, ids.indexOf(entry.id))}
        key={entry.id}
        entry={entry}
        drag={drag}
        isExpanded={expandedId === entry.id}
        compartments={compartments}
        selection={
          selection && {
            isSelected: selection.selected.has(entry.id),
            onToggle: () => selection.onToggle(entry.id),
          }
        }
        onToggleExpanded={() =>
          setExpandedId((current) => (current === entry.id ? null : entry.id))
        }
      />
    )
  }

  /** Las filas de un grupo (ids según la lista aplanada). */
  function renderRows(ids: string[]) {
    const known = ids.filter((id) => entryById.has(id))
    return (
      <ul className={styles.list}>
        {known.map((id) => {
          const entry = entryById.get(id)!
          // En modo selección las filas son casillas: no se arrastran.
          return selection ? (
            renderRow(known, entry)
          ) : (
            <Draggable key={id} id={id} data={{ type: 'item' }}>
              {(drag) => renderRow(known, entry, drag)}
            </Draggable>
          )
        })}
      </ul>
    )
  }

  /** Mueve un compartimento entre dos vecinos (por id; null = borde). */
  function reorderCompartment(id: string, before?: string, after?: string) {
    void repositories.compartments
      .reorder(id, before ?? null, after ?? null)
      .catch(reportError)
  }

  function renderCompartment(compartment: Compartment, drag?: DragHandle) {
    const own = entries.filter(
      (entry) => entry.compartmentId === compartment.id,
    )
    const order = groups.compartmentIds
    const index = order.indexOf(compartment.id)
    const ids = groups.items[compartment.id] ?? []
    // Plegado (o arrastrándose): no está en la lista aplanada, pero hay que
    // saber si tiene algo a la vista para el mensaje ("Todo listo (oculto)").
    const visible = own.filter(isShown)
    return (
      <CompartmentSection
        key={compartment.id}
        compartment={compartment}
        // TODAS sus líneas: el progreso del compartimento ("2 de 3")
        // cuenta también lo oculto.
        entries={own}
        visibleEntries={visible}
        renderRows={() => renderRows(ids)}
        isSelecting={selection !== undefined}
        drag={drag}
        isBeingDragged={draggingCompartmentId === compartment.id}
        // "Subir"/"Bajar" (en ⋯): la alternativa a arrastrar.
        onMoveUp={
          index > 0
            ? () =>
                reorderCompartment(
                  compartment.id,
                  order[index - 2],
                  order[index - 1],
                )
            : null
        }
        onMoveDown={
          index < order.length - 1
            ? () =>
                reorderCompartment(
                  compartment.id,
                  order[index + 1],
                  order[index + 2],
                )
            : null
        }
      />
    )
  }

  const shownCompartments = groups.compartmentIds
    .map((id) => compartmentById.get(id))
    .filter((c) => c !== undefined)

  const content = (
    <>
      {groups.loose.length > 0 && renderRows(groups.loose)}
      {shownCompartments.map((compartment) =>
        selection ? (
          renderCompartment(compartment)
        ) : (
          <Draggable
            key={compartment.id}
            id={compartment.id}
            data={{ type: 'compartment' }}
          >
            {(drag) => renderCompartment(compartment, drag)}
          </Draggable>
        ),
      )}
    </>
  )

  return (
    <div className={styles.contents}>
      {selection ? (
        content
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          accessibility={dndAccessibility}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDraggingCompartmentId(null)}
        >
          {/* UNA sola lista: todas las filas, en el orden en que se ven. */}
          <SortableContext items={flat} strategy={verticalListSortingStrategy}>
            {content}
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

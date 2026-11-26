import { useState } from 'react'
import { useRepositories } from '@/shared/di/repositories'
import { reportError } from '@/shared/ui/notifications/notificationStore'
import type { Compartment } from '../domain/compartment'
import type { LuggageEntry } from '../domain/itemQuantityRepository'
import { CompartmentSection } from './CompartmentSection'
import { NewCompartment } from './NewCompartment'
import {
  isHiddenCompartment,
  isHiddenEntry,
  type HiddenSnapshot,
} from './packingOrderStore'
import styles from './PackingList.module.css'
import { PackingListRow } from './PackingListRow'
import { SortableRows, type DragHandle } from './SortableRows'

interface PackingListProps {
  luggageId: string
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
 * Contenido de la maleta, SIEMPRE en el orden del usuario (hoy, el de
 * añadido): artículos sueltos, compartimentos y "Nuevo compartimento". Nada
 * cambia de sitio: "Ocultar listos" solo deja de pintar los artículos listos
 * y los compartimentos completos (un compartimento a medias se queda con su
 * cabecera y solo oculta sus artículos listos).
 */
export function PackingList({
  luggageId,
  entries,
  compartments,
  hidden,
  selection,
}: PackingListProps) {
  // Acordeón: como mucho una fila desplegada EN TODA LA MALETA (también
  // entre compartimentos). Estado de UI local: nadie más lo necesita.
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const isShown = (entry: LuggageEntry) => !isHiddenEntry(entry, hidden)
  const loose = entries.filter(
    (entry) => entry.compartmentId === null && isShown(entry),
  )

  const { quantities } = useRepositories()

  /**
   * "Subir"/"Bajar" respecto a los vecinos VISIBLES del grupo (lo oculto
   * con el ojo no cuenta: si no, un toque podría no mover nada a la vista).
   * Subir = ponerlo entre el de dos más arriba y el de justo encima.
   */
  function reorderHandlers(rows: LuggageEntry[], index: number) {
    const move =
      (before: LuggageEntry | undefined, after: LuggageEntry | undefined) =>
      () =>
        void quantities
          .reorder(rows[index].id, before?.id ?? null, after?.id ?? null)
          .catch(reportError)
    return {
      onMoveUp: index > 0 ? move(rows[index - 2], rows[index - 1]) : null,
      onMoveDown:
        index < rows.length - 1 ? move(rows[index + 1], rows[index + 2]) : null,
    }
  }

  /** Una fila; `drag` = asa para arrastrar (sin ella, en modo selección). */
  function renderRow(
    rows: LuggageEntry[],
    entry: LuggageEntry,
    drag?: DragHandle,
  ) {
    return (
      <PackingListRow
        {...reorderHandlers(rows, rows.indexOf(entry))}
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

  function renderRows(rows: LuggageEntry[]) {
    // En modo selección las filas son casillas: no se arrastran.
    if (selection) {
      return (
        <ul className={styles.list}>
          {rows.map((entry) => renderRow(rows, entry))}
        </ul>
      )
    }
    return (
      <SortableRows
        rows={rows}
        renderRow={(entry, drag) => renderRow(rows, entry, drag)}
        onMove={(id, before, after) =>
          void quantities
            .reorder(id, before?.id ?? null, after?.id ?? null)
            .catch(reportError)
        }
      />
    )
  }

  const isEmpty = entries.length === 0 && compartments.length === 0

  return (
    <div className={styles.contents}>
      {isEmpty && (
        <p className={styles.empty}>
          Esta maleta está vacía. Escribe arriba lo que quieras llevar.
        </p>
      )}

      {loose.length > 0 && renderRows(loose)}

      {compartments
        .filter((c) => !isHiddenCompartment(c, entries, hidden))
        .map((compartment) => {
          const own = entries.filter(
            (entry) => entry.compartmentId === compartment.id,
          )
          return (
            <CompartmentSection
              key={compartment.id}
              compartment={compartment}
              // TODAS sus líneas: el progreso del compartimento ("2 de 3")
              // cuenta también lo oculto.
              entries={own}
              visibleEntries={own.filter(isShown)}
              renderRows={renderRows}
              isSelecting={selection !== undefined}
            />
          )
        })}

      {selection === undefined && (
        <NewCompartment
          luggageId={luggageId}
          showHelp={compartments.length === 0}
        />
      )}
    </div>
  )
}

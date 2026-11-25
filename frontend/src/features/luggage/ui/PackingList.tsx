import { useState } from 'react'
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

interface PackingListProps {
  luggageId: string
  entries: LuggageEntry[]
  compartments: Compartment[]
  /** Artículos listos ocultos (ver packingOrderStore); undefined = ninguno. */
  hidden: HiddenSnapshot | undefined
  /** Fila a resaltar (p. ej. al intentar añadir algo que ya estaba). */
  highlightedId: string | null
  /** Al intentar añadir algo que ya estaba (desde el "+" de un compartimento). */
  onDuplicate: (itemName: string) => void
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
  highlightedId,
  onDuplicate,
  selection,
}: PackingListProps) {
  // Acordeón: como mucho una fila desplegada EN TODA LA MALETA (también
  // entre compartimentos). Estado de UI local: nadie más lo necesita.
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const isShown = (entry: LuggageEntry) => !isHiddenEntry(entry, hidden)
  const loose = entries.filter(
    (entry) => entry.compartmentId === null && isShown(entry),
  )

  function renderRows(rows: LuggageEntry[]) {
    return (
      <ul className={styles.list}>
        {rows.map((entry) => (
          <PackingListRow
            key={entry.id}
            entry={entry}
            isExpanded={expandedId === entry.id}
            isHighlighted={highlightedId === entry.id}
            compartments={compartments}
            selection={
              selection && {
                isSelected: selection.selected.has(entry.id),
                onToggle: () => selection.onToggle(entry.id),
              }
            }
            onToggleExpanded={() =>
              setExpandedId((current) =>
                current === entry.id ? null : entry.id,
              )
            }
          />
        ))}
      </ul>
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
              luggageEntries={entries}
              onDuplicate={onDuplicate}
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

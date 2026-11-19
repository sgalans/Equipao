import { useState } from 'react'
import type { Compartment } from '../domain/compartment'
import type { LuggageEntry } from '../domain/itemQuantityRepository'
import { CompartmentSection } from './CompartmentSection'
import { NewCompartment } from './NewCompartment'
import styles from './PackingList.module.css'
import { PackingListRow } from './PackingListRow'

interface PackingListProps {
  luggageId: string
  entries: LuggageEntry[]
  compartments: Compartment[]
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
 * Contenido de la maleta: primero los artículos sueltos (sin cabecera, justo
 * bajo el campo de añadir), después cada compartimento como sección
 * plegable y al final "Nuevo compartimento". Orden fijo: el de añadido.
 */
export function PackingList({
  luggageId,
  entries,
  compartments,
  highlightedId,
  onDuplicate,
  selection,
}: PackingListProps) {
  // Acordeón: como mucho una fila desplegada EN TODA LA MALETA (también
  // entre compartimentos). Estado de UI local: nadie más lo necesita.
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loose = entries.filter((entry) => entry.compartmentId === null)

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

      {compartments.map((compartment) => (
        <CompartmentSection
          key={compartment.id}
          compartment={compartment}
          entries={entries.filter(
            (entry) => entry.compartmentId === compartment.id,
          )}
          renderRows={renderRows}
          luggageEntries={entries}
          onDuplicate={onDuplicate}
          isSelecting={selection !== undefined}
        />
      ))}

      {selection === undefined && (
        <NewCompartment
          luggageId={luggageId}
          showHelp={compartments.length === 0}
        />
      )}
    </div>
  )
}

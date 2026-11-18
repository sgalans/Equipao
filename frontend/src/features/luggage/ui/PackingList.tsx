import { useState } from 'react'
import type { LuggageEntry } from '../domain/itemQuantityRepository'
import styles from './PackingList.module.css'
import { PackingListRow } from './PackingListRow'

interface PackingListProps {
  entries: LuggageEntry[]
  /** Fila a resaltar (p. ej. al intentar añadir algo que ya estaba). */
  highlightedId: string | null
}

/** Lista de artículos de la maleta. Orden fijo: el de añadido. */
export function PackingList({ entries, highlightedId }: PackingListProps) {
  // Acordeón: como mucho una fila desplegada. Es estado de UI local, no
  // datos: vive aquí y no en la base de datos (ni en Zustand: nadie más
  // lo necesita).
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (entries.length === 0) {
    return (
      <p className={styles.empty}>
        Esta maleta está vacía. Escribe arriba lo que quieras llevar.
      </p>
    )
  }

  return (
    <ul className={styles.list} aria-label="Artículos de la maleta">
      {entries.map((entry) => (
        <PackingListRow
          key={entry.id}
          entry={entry}
          isExpanded={expandedId === entry.id}
          isHighlighted={highlightedId === entry.id}
          onToggleExpanded={() =>
            setExpandedId((current) => (current === entry.id ? null : entry.id))
          }
        />
      ))}
    </ul>
  )
}

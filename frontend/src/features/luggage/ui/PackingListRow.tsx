import { useId } from 'react'
import { useRepositories } from '@/shared/di/repositories'
import buttons from '@/shared/ui/buttons.module.css'
import { CheckIcon } from '@/shared/ui/icons/CheckIcon'
import { MinusIcon } from '@/shared/ui/icons/MinusIcon'
import { PlusIcon } from '@/shared/ui/icons/PlusIcon'
import { TrashIcon } from '@/shared/ui/icons/TrashIcon'
import type { LuggageEntry } from '../domain/itemQuantityRepository'
import { isFullyPacked } from '../domain/packing'
import styles from './PackingListRow.module.css'

const MAX_UNITS = 99

interface PackingListRowProps {
  entry: LuggageEntry
  isExpanded: boolean
  isHighlighted: boolean
  onToggleExpanded: () => void
}

const units = (n: number) => `${n} ${n === 1 ? 'unidad' : 'unidades'}`

/**
 * Una línea de la maleta:
 *   [círculo]  Nombre ×N        ← tocar el círculo = guardar/sacar
 *              − N +   🗑       ← tocar el nombre despliega esto
 */
export function PackingListRow({
  entry,
  isExpanded,
  isHighlighted,
  onToggleExpanded,
}: PackingListRowProps) {
  const { quantities } = useRepositories()
  const panelId = useId()
  const isDone = isFullyPacked(entry)
  const isPartial = !isDone && entry.nAlreadyPacked > 0

  /** Lanza una operación del repositorio sin bloquear la UI. */
  function run(operation: Promise<unknown>) {
    // No hay nada que actualizar a mano al terminar: useLiveQuery refresca
    // la lista sola. Solo registramos un posible error.
    operation.catch((error: unknown) => console.error(error))
  }

  return (
    <li
      className={[
        styles.row,
        isDone ? styles.done : '',
        isHighlighted ? styles.highlighted : '',
      ].join(' ')}
    >
      <div className={styles.main}>
        <button
          type="button"
          // role="checkbox" + aria-checked: el lector de pantalla dice
          // "Calcetines, casilla, marcada". 'mixed' = a medias (p. ej. 5/6).
          role="checkbox"
          aria-checked={isDone ? true : isPartial ? 'mixed' : false}
          aria-label={entry.itemName}
          className={styles.check}
          onClick={() => run(quantities.togglePacked(entry.id))}
        >
          {isDone ? <CheckIcon /> : isPartial ? entry.nAlreadyPacked : null}
        </button>

        <button
          type="button"
          className={styles.details}
          // aria-expanded/aria-controls: el lector anuncia "contraído /
          // expandido" y sabe qué panel abre este botón.
          aria-expanded={isExpanded}
          aria-controls={panelId}
          aria-label={`${entry.itemName}, ${units(entry.num)}`}
          onClick={onToggleExpanded}
        >
          <span className={styles.name}>{entry.itemName}</span>
          <span className={styles.quantity}>×{entry.num}</span>
        </button>
      </div>

      {isExpanded && (
        <div id={panelId} className={styles.panel}>
          <div className={styles.stepper}>
            <button
              type="button"
              className={buttons.icon}
              aria-label={`Una unidad menos de ${entry.itemName}`}
              // Mínimo 1: para "ninguna", se quita el artículo (papelera).
              disabled={entry.num <= 1}
              onClick={() => run(quantities.resize(entry.id, entry.num - 1))}
            >
              <MinusIcon />
            </button>
            {/* aria-live: al pulsar + o −, se anuncia la nueva cantidad. */}
            <span className={styles.count} aria-live="polite">
              {units(entry.num)}
            </span>
            <button
              type="button"
              className={buttons.icon}
              aria-label={`Una unidad más de ${entry.itemName}`}
              disabled={entry.num >= MAX_UNITS}
              onClick={() => run(quantities.resize(entry.id, entry.num + 1))}
            >
              <PlusIcon />
            </button>
          </div>
          <button
            type="button"
            className={buttons.icon}
            aria-label={`Quitar ${entry.itemName} de la maleta`}
            title="Quitar de la maleta"
            // Sin confirmación (decisión de producto): quitar una línea es
            // poco grave y volver a añadirla cuesta un segundo.
            onClick={() => run(quantities.remove(entry.id))}
          >
            <TrashIcon />
          </button>
        </div>
      )}
    </li>
  )
}

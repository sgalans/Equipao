import { useId } from 'react'
import { useRepositories } from '@/shared/di/repositories'
import { reportError } from '@/shared/ui/notifications/notificationStore'
import buttons from '@/shared/ui/buttons.module.css'
import checkCircle from '@/shared/ui/checkCircle.module.css'
import { CheckIcon } from '@/shared/ui/icons/CheckIcon'
import { GripIcon } from '@/shared/ui/icons/GripIcon'
import { MinusIcon } from '@/shared/ui/icons/MinusIcon'
import { PlusIcon } from '@/shared/ui/icons/PlusIcon'
import { TrashIcon } from '@/shared/ui/icons/TrashIcon'
import type { Compartment } from '../domain/compartment'
import type { LuggageEntry } from '../domain/itemQuantityRepository'
import { isFullyPacked } from '../domain/packing'
import styles from './PackingListRow.module.css'
import type { DragHandle } from './packingDndLogic'

const MAX_UNITS = 99

interface PackingListRowProps {
  entry: LuggageEntry
  isExpanded: boolean
  /** Compartimentos de la maleta, para "Mover a…". */
  compartments: Compartment[]
  onToggleExpanded: () => void
  /**
   * Modo selección (mover o quitar varios): la fila entera es una casilla;
   * no empaqueta ni se despliega.
   */
  selection?: { isSelected: boolean; onToggle: () => void }
  /**
   * "Subir"/"Bajar" (alternativa a arrastrar, WCAG 2.2 SC 2.5.7): null =
   * ya está arriba/abajo del todo de su grupo (botón desactivado).
   */
  onMoveUp?: (() => void) | null
  onMoveDown?: (() => void) | null
  /** Asa para ordenar arrastrando (ver SortableRows); sin ella, no se arrastra. */
  drag?: DragHandle
}

/** Valor del <select> para "suelto": los <option> solo admiten strings. */
const LOOSE = ''

const units = (n: number) => `${n} ${n === 1 ? 'unidad' : 'unidades'}`

/**
 * Una línea de la maleta:
 *   [círculo]  Nombre ×N    ≡   ← círculo = guardar/sacar; ≡ = arrastrar
 *              − N +   🗑       ← tocar el nombre despliega esto
 *              ↑ Subir  ↓ Bajar
 *              Mover a [Neceser ▾]   (si hay compartimentos)
 */
export function PackingListRow({
  entry,
  isExpanded,
  compartments,
  onToggleExpanded,
  selection,
  onMoveUp = null,
  onMoveDown = null,
  drag,
}: PackingListRowProps) {
  const { quantities } = useRepositories()
  const panelId = useId()
  const moveId = useId()
  const isDone = isFullyPacked(entry)
  const isPartial = !isDone && entry.nAlreadyPacked > 0

  /** Lanza una operación del repositorio sin bloquear la UI. */
  function run(operation: Promise<unknown>) {
    // No hay nada que actualizar a mano al terminar: useLiveQuery refresca
    // la lista sola. Si falla, se avisa (antes solo iba a la consola y el
    // usuario tocaba sin que pasara nada).
    operation.catch(reportError)
  }

  if (selection) {
    return (
      <li className={styles.row}>
        {/* Toda la fila es la casilla: zona táctil grande. */}
        <button
          type="button"
          role="checkbox"
          aria-checked={selection.isSelected}
          aria-label={entry.itemName}
          className={styles.selectable}
          onClick={selection.onToggle}
        >
          <span className={checkCircle.check} aria-hidden="true">
            {selection.isSelected && <CheckIcon />}
          </span>
          <span className={styles.name}>{entry.itemName}</span>
          <span className={styles.quantity}>×{entry.num}</span>
        </button>
      </li>
    )
  }

  return (
    <li
      ref={drag?.setRowRef}
      style={drag?.rowStyle}
      className={[
        styles.row,
        isDone ? styles.done : '',
        drag?.isDragging ? styles.dragging : '',
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
          className={checkCircle.check}
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
        {drag && (
          <button
            type="button"
            {...drag.handleProps}
            className={`${buttons.iconGhost} ${styles.handle}`}
            aria-label={`Ordenar ${entry.itemName}`}
          >
            <GripIcon />
          </button>
        )}
      </div>

      {isExpanded && (
        <div id={panelId} className={styles.panel}>
          <div className={styles.panelRow}>
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

          <div className={styles.reorder}>
            <button
              type="button"
              className={buttons.textAction}
              aria-label={`Subir ${entry.itemName}`}
              disabled={onMoveUp === null}
              onClick={() => onMoveUp?.()}
            >
              <span aria-hidden="true">↑</span> Subir
            </button>
            <button
              type="button"
              className={buttons.textAction}
              aria-label={`Bajar ${entry.itemName}`}
              disabled={onMoveDown === null}
              onClick={() => onMoveDown?.()}
            >
              <span aria-hidden="true">↓</span> Bajar
            </button>
          </div>

          {compartments.length > 0 && (
            <div className={styles.move}>
              <label htmlFor={moveId}>Mover a</label>
              {/* <select> nativo: en el iPhone abre el selector de rueda de
                  iOS. Accesible y adaptado al dedo sin construir nada. */}
              <select
                id={moveId}
                value={entry.compartmentId ?? LOOSE}
                onChange={(event) =>
                  run(
                    quantities.moveTo(
                      entry.id,
                      event.target.value === LOOSE ? null : event.target.value,
                    ),
                  )
                }
              >
                <option value={LOOSE}>Suelto en la maleta</option>
                {compartments.map((compartment) => (
                  <option key={compartment.id} value={compartment.id}>
                    {compartment.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

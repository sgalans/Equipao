import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useState } from 'react'
import { MergeItemsDialog } from '@/features/items/ui/MergeItemsDialog'
import { useItemRename } from '@/features/items/ui/useItemRename'
import { useRepositories } from '@/shared/di/repositories'
import { reportError } from '@/shared/ui/notifications/notificationStore'
import buttons from '@/shared/ui/buttons.module.css'
import checkCircle from '@/shared/ui/checkCircle.module.css'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { ArrowIcon } from '@/shared/ui/icons/ArrowIcon'
import { CheckIcon } from '@/shared/ui/icons/CheckIcon'
import { GripIcon } from '@/shared/ui/icons/GripIcon'
import { MinusIcon } from '@/shared/ui/icons/MinusIcon'
import { PencilIcon } from '@/shared/ui/icons/PencilIcon'
import { PlusIcon } from '@/shared/ui/icons/PlusIcon'
import { TrashIcon } from '@/shared/ui/icons/TrashIcon'
import { InlineEditInput } from '@/shared/ui/InlineEditInput'
import type { Compartment } from '../domain/compartment'
import type { LuggageEntry } from '../domain/itemQuantityRepository'
import { isFullyPacked } from '../domain/packing'
import toolbar from '@/shared/ui/toolbar.module.css'
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
  /** Asa para ordenar arrastrando (ver packingDnd); sin ella, no se arrastra. */
  drag?: DragHandle
}

/** Valor del <select> para "suelto": los <option> solo admiten strings. */
const LOOSE = ''

const units = (n: number) => `${n} ${n === 1 ? 'unidad' : 'unidades'}`

/**
 * Una línea de la maleta:
 *   [círculo]  Nombre ×N    ≡   ← círculo = guardar/sacar; ≡ = arrastrar
 *              − N +       ↑ ↓ ✎ 🗑  ← tocar el nombre despliega esto
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
  const { quantities, items } = useRepositories()
  const panelId = useId()
  const [isRenaming, setIsRenaming] = useState(false)
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false)
  const renaming = useItemRename()
  // Solo mientras se renombra: ¿está en OTRAS maletas? (para avisar de que
  // el nombre cambia en todas: es del artículo, no de esta maleta).
  const usedElsewhere = useLiveQuery(
    async () =>
      isRenaming
        ? ((await items.listWithUsage()).find((i) => i.id === entry.itemId)
            ?.luggageNames.length ?? 0) > 1
        : false,
    [isRenaming, items, entry.itemId],
  )
  const moveId = useId()
  const isDone = isFullyPacked(entry)

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
          // "Calcetines, casilla, marcada". Sin estado "a medias": o listo o
          // no (decisión del usuario; nada de números en el círculo).
          role="checkbox"
          aria-checked={isDone}
          aria-label={entry.itemName}
          className={checkCircle.check}
          onClick={() => run(quantities.togglePacked(entry.id))}
        >
          {isDone && <CheckIcon />}
        </button>

        {isRenaming ? (
          <InlineEditInput
            className={styles.renameInput}
            initialValue={entry.itemName}
            ariaLabel="Nombre del artículo"
            onFinish={(name) => {
              setIsRenaming(false)
              if (name !== null) {
                void renaming.rename(entry.itemId, entry.itemName, name)
              }
            }}
          />
        ) : (
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
        )}
        {drag && !isRenaming && (
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
      {isRenaming && usedElsewhere && (
        <p className={styles.hint}>Cambia en todas tus maletas.</p>
      )}
      {renaming.error && (
        <p role="alert" className={styles.error}>
          {renaming.error}
        </p>
      )}

      {isExpanded && !isRenaming && (
        <div id={panelId} className={styles.panel}>
          {/* Barra común con el ⋯ del compartimento (toolbar.module.css):
              mismo aspecto y orden. Izquierda: − N +; derecha: ↑ ↓ ✎ 🗑. */}
          <div className={toolbar.toolbar}>
            <div className={toolbar.group}>
              <button
                type="button"
                className={toolbar.tool}
                aria-label={`Una unidad menos de ${entry.itemName}`}
                // Mínimo 1: para "ninguna", se quita el artículo (papelera).
                disabled={entry.num <= 1}
                onClick={() => run(quantities.resize(entry.id, entry.num - 1))}
              >
                <MinusIcon />
              </button>
              {/* Solo el número a la vista (decisión del usuario); "unidades"
                  oculto a la vista pero leído por VoiceOver. aria-live: al
                  pulsar + o −, se anuncia. */}
              <span className={toolbar.count} aria-live="polite">
                {entry.num}
                <span className="visually-hidden">
                  {' '}
                  {entry.num === 1 ? 'unidad' : 'unidades'}
                </span>
              </span>
              <button
                type="button"
                className={toolbar.tool}
                aria-label={`Una unidad más de ${entry.itemName}`}
                disabled={entry.num >= MAX_UNITS}
                onClick={() => run(quantities.resize(entry.id, entry.num + 1))}
              >
                <PlusIcon />
              </button>
            </div>
            {/* Solo iconos, con el nombre completo en aria-label (VoiceOver).
                ↑ ↓: alternativa a arrastrar (WCAG 2.2 SC 2.5.7). */}
            <div className={toolbar.group}>
              <button
                type="button"
                className={toolbar.tool}
                aria-label={`Subir ${entry.itemName}`}
                title="Subir"
                disabled={onMoveUp === null}
                onClick={() => onMoveUp?.()}
              >
                <ArrowIcon direction="up" />
              </button>
              <button
                type="button"
                className={toolbar.tool}
                aria-label={`Bajar ${entry.itemName}`}
                title="Bajar"
                disabled={onMoveDown === null}
                onClick={() => onMoveDown?.()}
              >
                <ArrowIcon direction="down" />
              </button>
              <button
                type="button"
                className={toolbar.tool}
                aria-label={`Renombrar ${entry.itemName}`}
                title="Renombrar"
                onClick={() => {
                  renaming.clearError()
                  setIsRenaming(true)
                }}
              >
                <PencilIcon />
              </button>
              <button
                type="button"
                className={toolbar.tool}
                aria-label={`Quitar ${entry.itemName} de la maleta`}
                title="Quitar de la maleta"
                // Con confirmación (decisión del usuario): el icono no dice
                // nada más, así que el diálogo explica que se QUITA de esta
                // maleta (no se borra del catálogo).
                onClick={() => setIsConfirmingRemove(true)}
              >
                <TrashIcon />
              </button>
            </div>
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
      <ConfirmDialog
        open={isConfirmingRemove}
        title={`¿Quitar «${entry.itemName}» de la maleta?`}
        confirmLabel="Quitar"
        onCancel={() => setIsConfirmingRemove(false)}
        onConfirm={async () => {
          await quantities.remove(entry.id)
          setIsConfirmingRemove(false)
        }}
      >
        <p>Seguirá en tu catálogo.</p>
      </ConfirmDialog>
      <MergeItemsDialog
        pending={renaming.pending}
        onConfirm={renaming.confirmMerge}
        onCancel={renaming.cancelMerge}
      />
    </li>
  )
}

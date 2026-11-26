import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useRepositories } from '@/shared/di/repositories'
import { reportError } from '@/shared/ui/notifications/notificationStore'
import buttons from '@/shared/ui/buttons.module.css'
import checkCircle from '@/shared/ui/checkCircle.module.css'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { CheckIcon } from '@/shared/ui/icons/CheckIcon'
import { ChevronDownIcon } from '@/shared/ui/icons/ChevronDownIcon'
import { GripIcon } from '@/shared/ui/icons/GripIcon'
import { MoreIcon } from '@/shared/ui/icons/MoreIcon'
import { PlusIcon } from '@/shared/ui/icons/PlusIcon'
import { PencilIcon } from '@/shared/ui/icons/PencilIcon'
import { TrashIcon } from '@/shared/ui/icons/TrashIcon'
import { InlineEditInput } from '@/shared/ui/InlineEditInput'
import type { Compartment } from '../domain/compartment'
import type { LuggageEntry } from '../domain/itemQuantityRepository'
import { itemsProgress } from '../domain/packing'
import { COMPARTMENT_PARAM } from './AddItemsPage'
import {
  useCollapsedCompartments,
  useIsCollapsed,
} from './collapsedCompartmentsStore'
import styles from './CompartmentSection.module.css'
import type { DragHandle } from './packingDndLogic'
import { compartmentStatus } from './progressLabel'

interface CompartmentSectionProps {
  compartment: Compartment
  /** Artículos de ESTE compartimento (todos: para su progreso). */
  entries: LuggageEntry[]
  /** Los que se pintan (sin los listos ocultos con "Ocultar listos"). */
  visibleEntries: LuggageEntry[]
  /**
   * Pinta sus filas (las decide PackingList: mientras se arrastra, pueden
   * incluir un artículo que viene de otra lista).
   */
  renderRows: () => ReactNode
  /**
   * Modo selección de la maleta: solo se eligen artículos, así que se ocultan
   * los controles propios del compartimento ("listo", +, ⋯). Plegar sigue.
   */
  isSelecting?: boolean
  /**
   * Asa para arrastrarlo (ver packingDnd). Lo que se desplaza con el dedo es
   * SOLO la cabecera: sus artículos son filas de la misma lista única y se
   * desplazan por su cuenta (si se moviera la sección entera, se moverían
   * dos veces).
   */
  drag?: DragHandle
  /**
   * Mientras se arrastra ESTE compartimento se ve plegado (decisión del
   * usuario, opción A): un bloque largo sería incómodo de mover.
   */
  isBeingDragged?: boolean
  /** "Subir"/"Bajar" en ⋯ (alternativa a arrastrar); null = en el borde. */
  onMoveUp?: (() => void) | null
  onMoveDown?: (() => void) | null
}

/**
 * Un compartimento dentro de la maleta:
 *   ▾ Neceser · 2 de 3   [+] [⋯] [≡]  ← tocar = plegar; + = añadir (abre
 *                                       el catálogo con este destino);
 *                                       ⋯ = acciones; ≡ = arrastrar
 *     ✎ Renombrar  🗑 Borrar  ↑ Subir  ↓ Bajar   ← solo tras tocar ⋯
 *     (filas de artículos)
 */
export function CompartmentSection({
  compartment,
  entries,
  visibleEntries,
  renderRows,
  isSelecting = false,
  drag,
  isBeingDragged = false,
  onMoveUp = null,
  onMoveDown = null,
}: CompartmentSectionProps) {
  const { compartments } = useRepositories()
  const isCollapsed = useIsCollapsed(compartment.id) || isBeingDragged
  const toggle = useCollapsedCompartments((state) => state.toggle)
  const [isRenaming, setIsRenaming] = useState(false)
  // Acciones poco frecuentes (renombrar, borrar) ocultas tras "⋯": los
  // compartimentos suelen estar desplegados y no deben llenarse de botones.
  const [showActions, setShowActions] = useState(false)
  const actionsId = useId()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  const { done, total } = itemsProgress(entries)
  const status = compartmentStatus(done, total, compartment.isReady)
  const collapse = useCollapsedCompartments((state) => state.collapse)

  async function toggleReady() {
    try {
      const updated = await compartments.toggleReady(compartment.id)
      // Decisión de producto: al marcarlo como listo se pliega solo, para
      // que lo ya hecho deje de ocupar sitio. Al desmarcarlo no se toca.
      if (updated.isReady) collapse(compartment.id)
    } catch (error) {
      reportError(error)
    }
  }

  async function rename(name: string | null) {
    setIsRenaming(false)
    if (name === null || name === '' || name === compartment.name) return
    try {
      await compartments.update(compartment.id, { name })
    } catch (error) {
      reportError(error)
    }
  }

  return (
    <section className={styles.section} aria-label={compartment.name}>
      <div
        ref={drag?.setRowRef}
        style={drag?.rowStyle}
        className={[
          styles.header,
          drag?.isDragging ? styles.dragging : '',
        ].join(' ')}
      >
        {/* Mismo círculo que los artículos (estilo compartido): "listo"
            PROPIO del compartimento, independiente de sus artículos. */}
        {!isSelecting && (
          <button
            type="button"
            role="checkbox"
            aria-checked={compartment.isReady}
            aria-label={`${compartment.name} listo`}
            className={checkCircle.check}
            onClick={() => void toggleReady()}
          >
            {compartment.isReady && <CheckIcon />}
          </button>
        )}
        <h2 className={styles.heading}>
          {isRenaming ? (
            <InlineEditInput
              className={styles.renameInput}
              initialValue={compartment.name}
              ariaLabel="Nombre del compartimento"
              onFinish={(name) => void rename(name)}
            />
          ) : (
            <button
              type="button"
              className={styles.toggle}
              aria-expanded={!isCollapsed}
              aria-label={`${compartment.name}, ${status}`}
              onClick={() => toggle(compartment.id)}
            >
              <span className={styles.chevron}>
                <ChevronDownIcon />
              </span>
              <span className={styles.name}>{compartment.name}</span>
              <span className={styles.progress}>{status}</span>
            </button>
          )}
        </h2>
        {!isSelecting && (
          <>
            <Link
              // Misma pantalla que "Añadir artículos", con ESTE compartimento
              // como destino (decisión de producto: un solo "añadir").
              to={`/luggages/${compartment.luggageId}/add-items?${COMPARTMENT_PARAM}=${compartment.id}`}
              className={`${buttons.iconGhost} ${styles.headerButton}`}
              aria-label={`Añadir a ${compartment.name}`}
              title={`Añadir a ${compartment.name}`}
            >
              <PlusIcon />
            </Link>
            <button
              type="button"
              className={`${buttons.iconGhost} ${styles.headerButton}`}
              aria-label={`Más acciones de ${compartment.name}`}
              title="Más acciones"
              aria-expanded={showActions}
              aria-controls={actionsId}
              onClick={() => setShowActions((current) => !current)}
            >
              <MoreIcon />
            </button>
          </>
        )}
        {drag && (
          <button
            type="button"
            {...drag.handleProps}
            className={`${buttons.iconGhost} ${styles.handle}`}
            aria-label={`Ordenar ${compartment.name}`}
          >
            <GripIcon />
          </button>
        )}
      </div>

      {/* Fuera del contenido plegable: se puede renombrar o borrar un
          compartimento sin desplegarlo. */}
      {showActions && !isSelecting && (
        <div id={actionsId} className={styles.actions}>
          <button
            type="button"
            className={buttons.textAction}
            onClick={() => {
              setShowActions(false)
              setIsRenaming(true)
            }}
          >
            <PencilIcon />
            Renombrar
          </button>
          <button
            type="button"
            className={buttons.textAction}
            onClick={() => {
              setShowActions(false)
              setIsConfirmingDelete(true)
            }}
          >
            <TrashIcon />
            Borrar compartimento
          </button>
          <button
            type="button"
            className={buttons.textAction}
            aria-label={`Subir ${compartment.name}`}
            disabled={onMoveUp === null}
            onClick={() => onMoveUp?.()}
          >
            <span aria-hidden="true">↑</span> Subir
          </button>
          <button
            type="button"
            className={buttons.textAction}
            aria-label={`Bajar ${compartment.name}`}
            disabled={onMoveDown === null}
            onClick={() => onMoveDown?.()}
          >
            <span aria-hidden="true">↓</span> Bajar
          </button>
        </div>
      )}

      {/* Plegado = no se pinta el contenido (ni ocupa sitio ni lo lee el
          lector de pantalla). aria-expanded en el botón anuncia el estado. */}
      {!isCollapsed && (
        <div className={styles.content}>
          {entries.length === 0 ? (
            <p className={styles.empty}>Este compartimento está vacío.</p>
          ) : visibleEntries.length > 0 ? (
            renderRows()
          ) : (
            // Todo listo y oculto: la cabecera se queda (nada salta) y se
            // dice por qué no se ve nada.
            <p className={styles.empty}>Todo listo (oculto).</p>
          )}
        </div>
      )}

      <ConfirmDialog
        open={isConfirmingDelete}
        title={`¿Borrar «${compartment.name}»?`}
        confirmLabel="Borrar"
        onCancel={() => setIsConfirmingDelete(false)}
        onConfirm={async () => {
          await compartments.remove(compartment.id)
        }}
      >
        <p>
          {total === 0
            ? 'El compartimento está vacío.'
            : total === 1
              ? 'Su artículo quedará suelto en la maleta.'
              : `Sus ${total} artículos quedarán sueltos en la maleta.`}
        </p>
      </ConfirmDialog>
    </section>
  )
}

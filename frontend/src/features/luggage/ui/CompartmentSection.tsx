import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { MergeItemsDialog } from '@/features/items/ui/MergeItemsDialog'
import { useItemRename } from '@/features/items/ui/useItemRename'
import { useRepositories } from '@/shared/di/repositories'
import { reportError } from '@/shared/ui/notifications/notificationStore'
import buttons from '@/shared/ui/buttons.module.css'
import checkCircle from '@/shared/ui/checkCircle.module.css'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { ArrowIcon } from '@/shared/ui/icons/ArrowIcon'
import { CheckIcon } from '@/shared/ui/icons/CheckIcon'
import { ChevronDownIcon } from '@/shared/ui/icons/ChevronDownIcon'
import { GripIcon } from '@/shared/ui/icons/GripIcon'
import { MoreIcon } from '@/shared/ui/icons/MoreIcon'
import { ListPlusIcon } from '@/shared/ui/icons/ListPlusIcon'
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
import toolbar from '@/shared/ui/toolbar.module.css'
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
 *     ✎  🗑  ↑  ↓                        ← solo tras tocar ⋯
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
  // ¿Le falta algún artículo? (uno vacío no: no le falta nada)
  const hasPending = done < total

  // Decisión de producto: se pliega SOLO en el momento en que su último
  // artículo queda listo (marques donde marques: la fila, la ventana
  // "Listos"…), para que lo hecho deje de ocupar sitio. Solo en el CAMBIO
  // de "le falta algo" a "todo listo": al abrir una maleta ya completa no se
  // pliega, y si se despliega a mano no se vuelve a plegar solo. useRef
  // guarda el valor del render anterior sin provocar renders.
  const allPacked = total > 0 && !hasPending
  const wasAllPacked = useRef(allPacked)
  useEffect(() => {
    if (allPacked && !wasAllPacked.current) collapse(compartment.id)
    wasAllPacked.current = allPacked
  }, [allPacked, collapse, compartment.id])

  async function toggleReady() {
    try {
      const updated = await compartments.toggleReady(compartment.id)
      // Al marcarlo como listo se pliega, pero SOLO si no le falta ningún
      // artículo (decisión de producto: si falta algo, se queda a la vista).
      // Al desmarcarlo no se toca.
      if (updated.isReady && !hasPending) collapse(compartment.id)
    } catch (error) {
      reportError(error)
    }
  }

  // Renombrar = renombrar su CONTENEDOR del catálogo, como un artículo:
  // cambia en todas las maletas, y si ya hay otro compartimento con ese
  // nombre se propone unirlos (useItemRename, decisión del usuario).
  const renaming = useItemRename()
  // Solo mientras se renombra: ¿está en OTRAS maletas? (el nombre cambia en
  // todas: es del contenedor del catálogo).
  const { items } = useRepositories()
  const usedElsewhere = useLiveQuery(
    async () =>
      isRenaming
        ? ((await items.listWithUsage()).find(
            (i) => i.id === compartment.itemId,
          )?.luggageNames.length ?? 0) > 1
        : false,
    [isRenaming, items, compartment.itemId],
  )
  function rename(name: string | null) {
    setIsRenaming(false)
    if (name !== null) {
      void renaming.rename(compartment.itemId, compartment.name, name)
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
              onFinish={rename}
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
            <button
              type="button"
              // Dos estados a la vista (como a VoiceOver, con aria-expanded):
              // abierto = acento con fondo suave (ver .moreToggle en el CSS).
              className={`${buttons.iconGhost} ${styles.headerButton} ${styles.moreToggle}`}
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
      {isRenaming && usedElsewhere && (
        <p className={styles.hint}>Cambia en todas tus maletas.</p>
      )}
      {renaming.error && (
        <p role="alert" className={styles.error}>
          {renaming.error}
        </p>
      )}

      {showActions && !isSelecting && (
        // Barra común con el panel de los artículos (toolbar.module.css):
        // mismo aspecto y orden. Izquierda: añadir; derecha: ↑ ↓ ✎ 🗑.
        <div id={actionsId} className={`${toolbar.toolbar} ${styles.actions}`}>
          <div className={toolbar.group}>
            <Link
              // Misma pantalla que "Añadir artículos", con ESTE compartimento
              // como destino (un solo "añadir"). Icono de lista con +: no se
              // confunde con el + de las unidades de un artículo.
              to={`/luggages/${compartment.luggageId}/add-items?${COMPARTMENT_PARAM}=${compartment.id}`}
              className={toolbar.tool}
              aria-label={`Añadir a ${compartment.name}`}
              title={`Añadir a ${compartment.name}`}
            >
              <ListPlusIcon />
            </Link>
          </div>
          {/* Solo iconos, con el nombre completo en aria-label. */}
          <div className={toolbar.group}>
            <button
              type="button"
              className={toolbar.tool}
              aria-label={`Subir ${compartment.name}`}
              title="Subir"
              disabled={onMoveUp === null}
              onClick={() => onMoveUp?.()}
            >
              <ArrowIcon direction="up" />
            </button>
            <button
              type="button"
              className={toolbar.tool}
              aria-label={`Bajar ${compartment.name}`}
              title="Bajar"
              disabled={onMoveDown === null}
              onClick={() => onMoveDown?.()}
            >
              <ArrowIcon direction="down" />
            </button>
            <button
              type="button"
              className={toolbar.tool}
              aria-label={`Renombrar ${compartment.name}`}
              title="Renombrar"
              onClick={() => {
                setShowActions(false)
                renaming.clearError()
                setIsRenaming(true)
              }}
            >
              <PencilIcon />
            </button>
            <button
              type="button"
              className={toolbar.tool}
              aria-label={`Quitar ${compartment.name} de la maleta`}
              title="Quitar de la maleta"
              onClick={() => {
                setShowActions(false)
                setIsConfirmingDelete(true)
              }}
            >
              <TrashIcon />
            </button>
          </div>
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
        title={`¿Quitar «${compartment.name}» de la maleta?`}
        confirmLabel="Quitar"
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
              : `Sus ${total} artículos quedarán sueltos en la maleta.`}{' '}
          {/* Es un contenedor del catálogo: se quita de ESTA maleta, no se
              borra (se puede volver a usar en esta u otras). */}
          «{compartment.name}» seguirá en tu catálogo.
        </p>
      </ConfirmDialog>
      <MergeItemsDialog
        pending={renaming.pending}
        onConfirm={renaming.confirmMerge}
        onCancel={renaming.cancelMerge}
      />
    </section>
  )
}

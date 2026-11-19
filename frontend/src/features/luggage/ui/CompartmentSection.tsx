import { useId, useState, type ReactNode } from 'react'
import { useRepositories } from '@/shared/di/repositories'
import { reportError } from '@/shared/ui/notifications/notificationStore'
import buttons from '@/shared/ui/buttons.module.css'
import checkCircle from '@/shared/ui/checkCircle.module.css'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { CheckIcon } from '@/shared/ui/icons/CheckIcon'
import { ChevronDownIcon } from '@/shared/ui/icons/ChevronDownIcon'
import { MoreIcon } from '@/shared/ui/icons/MoreIcon'
import { PlusIcon } from '@/shared/ui/icons/PlusIcon'
import { PencilIcon } from '@/shared/ui/icons/PencilIcon'
import { TrashIcon } from '@/shared/ui/icons/TrashIcon'
import { InlineEditInput } from '@/shared/ui/InlineEditInput'
import type { Compartment } from '../domain/compartment'
import type { LuggageEntry } from '../domain/itemQuantityRepository'
import { itemsProgress } from '../domain/packing'
import { AddItemForm } from './AddItemForm'
import {
  useCollapsedCompartments,
  useIsCollapsed,
} from './collapsedCompartmentsStore'
import styles from './CompartmentSection.module.css'
import { compartmentStatus } from './progressLabel'

interface CompartmentSectionProps {
  compartment: Compartment
  /** Artículos de ESTE compartimento. */
  entries: LuggageEntry[]
  /** Pinta la lista de filas (la comparte con los artículos sueltos). */
  renderRows: (entries: LuggageEntry[]) => ReactNode
  /** TODAS las líneas de la maleta: el formulario no sugiere lo que ya está. */
  luggageEntries: LuggageEntry[]
  onDuplicate: (itemName: string) => void
  /**
   * Modo selección de la maleta: solo se eligen artículos, así que se ocultan
   * los controles propios del compartimento ("listo", +, ⋯). Plegar sigue.
   */
  isSelecting?: boolean
}

/**
 * Un compartimento dentro de la maleta:
 *   ▾ Neceser · 2 de 3   [+] [⋯]  ← tocar = plegar; + = añadir; ⋯ = acciones
 *     ✎ Renombrar   🗑 Borrar       ← solo tras tocar ⋯
 *     (filas de artículos)
 */
export function CompartmentSection({
  compartment,
  entries,
  renderRows,
  luggageEntries,
  onDuplicate,
  isSelecting = false,
}: CompartmentSectionProps) {
  const { compartments } = useRepositories()
  const isCollapsed = useIsCollapsed(compartment.id)
  const toggle = useCollapsedCompartments((state) => state.toggle)
  const expand = useCollapsedCompartments((state) => state.expand)
  const [isAdding, setIsAdding] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  // Acciones poco frecuentes (renombrar, borrar) ocultas tras "⋯": los
  // compartimentos suelen estar desplegados y no deben llenarse de botones.
  const [showActions, setShowActions] = useState(false)
  const actionsId = useId()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const contentId = useId()

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
      <div className={styles.header}>
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
              aria-controls={contentId}
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
              className={`${buttons.iconGhost} ${styles.headerButton} ${styles.addToggle}`}
              // El mismo botón abre y cierra: al abrirse, el "+" gira y se ve
              // como "×" (ver CSS), y el nombre accesible cambia con él para
              // que VoiceOver también anuncie que ahora cierra.
              aria-label={
                isAdding
                  ? `Dejar de añadir a ${compartment.name}`
                  : `Añadir a ${compartment.name}`
              }
              title={isAdding ? 'Cerrar' : `Añadir a ${compartment.name}`}
              aria-expanded={isAdding}
              onClick={() => {
                // Si estaba plegado, se despliega: no se añade a algo que no se ve.
                expand(compartment.id)
                setIsAdding((current) => !current)
              }}
            >
              <PlusIcon />
            </button>
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
        </div>
      )}

      {/* Plegado = no se pinta el contenido (ni ocupa sitio ni lo lee el
          lector de pantalla). aria-expanded en el botón anuncia el estado. */}
      {!isCollapsed && (
        <div id={contentId} className={styles.content}>
          {isAdding && !isSelecting && (
            <div className={styles.addForm}>
              <AddItemForm
                luggageId={compartment.luggageId}
                entries={luggageEntries}
                onDuplicate={onDuplicate}
                compartmentId={compartment.id}
                label={`Añadir a ${compartment.name}`}
                focusOnMount
                onClose={() => setIsAdding(false)}
              />
            </div>
          )}
          {entries.length > 0 ? (
            renderRows(entries)
          ) : (
            <p className={styles.empty}>Este compartimento está vacío.</p>
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

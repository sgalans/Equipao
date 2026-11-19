import { useId, useState, type ReactNode } from 'react'
import { useRepositories } from '@/shared/di/repositories'
import { reportError } from '@/shared/ui/notifications/notificationStore'
import buttons from '@/shared/ui/buttons.module.css'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { ChevronDownIcon } from '@/shared/ui/icons/ChevronDownIcon'
import { PlusIcon } from '@/shared/ui/icons/PlusIcon'
import { PencilIcon } from '@/shared/ui/icons/PencilIcon'
import { TrashIcon } from '@/shared/ui/icons/TrashIcon'
import { InlineEditInput } from '@/shared/ui/InlineEditInput'
import type { Compartment } from '../domain/compartment'
import type { LuggageEntry } from '../domain/itemQuantityRepository'
import { luggageProgress } from '../domain/packing'
import { AddItemForm } from './AddItemForm'
import {
  useCollapsedCompartments,
  useIsCollapsed,
} from './collapsedCompartmentsStore'
import styles from './CompartmentSection.module.css'
import { compartmentProgressLabel } from './progressLabel'

interface CompartmentSectionProps {
  compartment: Compartment
  /** Artículos de ESTE compartimento. */
  entries: LuggageEntry[]
  /** Pinta la lista de filas (la comparte con los artículos sueltos). */
  renderRows: (entries: LuggageEntry[]) => ReactNode
  /** TODAS las líneas de la maleta: el formulario no sugiere lo que ya está. */
  luggageEntries: LuggageEntry[]
  onDuplicate: (itemName: string) => void
}

/**
 * Un compartimento dentro de la maleta:
 *   ▾ Neceser · 2 de 3     [+]  ← tocar = plegar/desplegar; + = añadir dentro
 *     (filas de artículos)
 *     ✎ Renombrar   🗑 Borrar   ← acciones poco frecuentes, al final
 */
export function CompartmentSection({
  compartment,
  entries,
  renderRows,
  luggageEntries,
  onDuplicate,
}: CompartmentSectionProps) {
  const { compartments } = useRepositories()
  const isCollapsed = useIsCollapsed(compartment.id)
  const toggle = useCollapsedCompartments((state) => state.toggle)
  const expand = useCollapsedCompartments((state) => state.expand)
  const [isAdding, setIsAdding] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const contentId = useId()

  const { done, total } = luggageProgress(entries)
  const progress = compartmentProgressLabel(done, total)

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
              aria-label={`${compartment.name}, ${progress}`}
              onClick={() => toggle(compartment.id)}
            >
              <span className={styles.chevron}>
                <ChevronDownIcon />
              </span>
              <span className={styles.name}>{compartment.name}</span>
              <span className={styles.progress}>{progress}</span>
            </button>
          )}
        </h2>
        <button
          type="button"
          className={`${buttons.iconGhost} ${styles.addToggle}`}
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
      </div>

      {/* Plegado = no se pinta el contenido (ni ocupa sitio ni lo lee el
          lector de pantalla). aria-expanded en el botón anuncia el estado. */}
      {!isCollapsed && (
        <div id={contentId}>
          {isAdding && (
            <div className={styles.addForm}>
              <AddItemForm
                luggageId={compartment.luggageId}
                entries={luggageEntries}
                onDuplicate={onDuplicate}
                compartmentId={compartment.id}
                label={`Añadir a ${compartment.name}`}
                autoFocus
                onClose={() => setIsAdding(false)}
              />
            </div>
          )}
          {entries.length > 0 ? (
            renderRows(entries)
          ) : (
            <p className={styles.empty}>Este compartimento está vacío.</p>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              className={buttons.textAction}
              onClick={() => setIsRenaming(true)}
            >
              <PencilIcon />
              Renombrar
            </button>
            <button
              type="button"
              className={buttons.textAction}
              onClick={() => setIsConfirmingDelete(true)}
            >
              <TrashIcon />
              Borrar compartimento
            </button>
          </div>
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

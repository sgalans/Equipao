import { useState } from 'react'
import { useRepositories } from '@/shared/di/repositories'
import { ConsistencyError } from '@/shared/domain/errors'
import { ActionSheet } from '@/shared/ui/ActionSheet'
import checkCircle from '@/shared/ui/checkCircle.module.css'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import highlightStyles from '@/shared/ui/highlight.module.css'
import { BoxIcon } from '@/shared/ui/icons/BoxIcon'
import { CheckIcon } from '@/shared/ui/icons/CheckIcon'
import { MoreIcon } from '@/shared/ui/icons/MoreIcon'
import { PencilIcon } from '@/shared/ui/icons/PencilIcon'
import { TrashIcon } from '@/shared/ui/icons/TrashIcon'
import { InlineEditInput } from '@/shared/ui/InlineEditInput'
import { reportError } from '@/shared/ui/notifications/notificationStore'
import type { ItemSummary } from '../domain/itemRepository'
import styles from './CatalogRow.module.css'
import { MergeItemsDialog } from './MergeItemsDialog'
import { useItemRename } from './useItemRename'

// Une listas como se escribe en español: "Grande y Mochila",
// "Grande, Mochila y Finde". Creado una vez y reutilizado.
const listFormat = new Intl.ListFormat('es', {
  style: 'long',
  type: 'conjunction',
})

function usageLabel(count: number): string {
  if (count === 0) return 'Sin usar'
  return count === 1 ? 'En 1 maleta' : `En ${count} maletas`
}

interface CatalogRowProps {
  item: ItemSummary
  /** Recién creado (o ya existía al intentar crearlo): resalte breve. */
  isHighlighted?: boolean
  /**
   * Modo selección (añadir varios a una maleta): la fila entera es una
   * casilla y no hay acciones.
   */
  selection?: {
    isSelected: boolean
    onToggle: () => void
    /**
     * Si se pasa, la fila NO se puede elegir y muestra este motivo en vez
     * del uso (p. ej. "Ya en la maleta" al añadir a una maleta).
     */
    disabledReason?: string
  }
}

/**
 *   Calcetines              En 2 maletas  ⋯   ← tocar = hoja de acciones
 *
 * Acciones en una hoja (decisión del usuario), como el ⋯ de las maletas:
 * Renombrar, Convertir en compartimento/artículo y Borrar. Antes eran
 * botones de texto bajo la fila, que con tres saltaban a dos líneas.
 */
export function CatalogRow({
  item,
  isHighlighted = false,
  selection,
}: CatalogRowProps) {
  const { items } = useRepositories()
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const usage = usageLabel(item.luggageNames.length)

  // Mismo renombrar que en la maleta (useItemRename): si el nombre es el
  // de otro artículo, se propone UNIRLOS en vez de fallar.
  const renaming = useItemRename()
  function rename(name: string | null) {
    setIsRenaming(false)
    if (name !== null) void renaming.rename(item.id, item.name, name)
  }
  const shownError = renaming.error ?? error

  /**
   * Marcar o desmarcar como compartimento. Solo si no está en ninguna
   * maleta (decisión del usuario, opción A): si no, se explica por qué y
   * qué hacer, en vez de reorganizar sus maletas sin que se vea.
   */
  async function toggleContainer() {
    setError(null)
    const count = item.luggageNames.length
    if (count > 0) {
      setError(
        `Para convertirlo, quítalo antes de ${count === 1 ? 'la maleta' : 'las maletas'} ${listFormat.format(item.luggageNames)}.`,
      )
      return
    }
    try {
      await items.update(item.id, { isContainer: !item.isContainer })
    } catch (e) {
      // Otra pestaña lo acaba de añadir a una maleta.
      if (e instanceof ConsistencyError) setError(`${e.message}.`)
      else reportError(e)
    }
  }

  if (selection) {
    return (
      <li className={styles.row}>
        {/* Toda la fila es la casilla: zona táctil grande. role="checkbox":
            VoiceOver dice "Calcetines, En 2 maletas, casilla, marcada". */}
        <button
          type="button"
          role="checkbox"
          aria-checked={selection.isSelected}
          aria-label={`${item.name}, ${selection.disabledReason ?? usage}`}
          className={styles.selectable}
          // disabled (no aria-disabled): no se puede tocar, y VoiceOver lo
          // anuncia como "atenuado".
          disabled={selection.disabledReason !== undefined}
          onClick={selection.onToggle}
        >
          <span className={checkCircle.check} aria-hidden="true">
            {selection.isSelected && <CheckIcon />}
          </span>
          <span className={styles.name}>{item.name}</span>
          <span className={styles.usage}>
            {selection.disabledReason ?? usage}
          </span>
        </button>
      </li>
    )
  }

  return (
    <li
      className={
        isHighlighted
          ? `${styles.row} ${highlightStyles.highlighted}`
          : styles.row
      }
    >
      {isRenaming ? (
        <InlineEditInput
          className={styles.renameInput}
          initialValue={item.name}
          ariaLabel="Nombre del artículo"
          onFinish={(name) => void rename(name)}
        />
      ) : (
        // Toda la fila abre la hoja: zona táctil grande. El ⋯ del final es
        // solo la pista visual (aria-hidden); el nombre accesible es el de
        // la fila, y aria-haspopup avisa de que abre una ventana.
        <button
          type="button"
          className={styles.details}
          aria-haspopup="dialog"
          aria-label={`${item.name}, ${usage}`}
          onClick={() => {
            setError(null)
            setIsSheetOpen(true)
          }}
        >
          <span className={styles.name}>{item.name}</span>
          <span className={styles.usage}>{usage}</span>
          <span className={styles.more} aria-hidden="true">
            <MoreIcon />
          </span>
        </button>
      )}

      {shownError && (
        <p role="alert" className={styles.error}>
          {shownError}
        </p>
      )}

      <ActionSheet
        open={isSheetOpen}
        title={item.name}
        onClose={() => setIsSheetOpen(false)}
        actions={[
          {
            label: 'Renombrar',
            icon: <PencilIcon />,
            onSelect: () => setIsRenaming(true),
          },
          {
            label: item.isContainer
              ? 'Convertir en artículo'
              : 'Convertir en compartimento',
            icon: <BoxIcon />,
            onSelect: () => void toggleContainer(),
          },
          {
            label: 'Borrar',
            icon: <TrashIcon />,
            variant: 'danger',
            onSelect: () => setIsConfirmingDelete(true),
          },
        ]}
      />

      <ConfirmDialog
        open={isConfirmingDelete}
        title={`¿Borrar «${item.name}»?`}
        confirmLabel="Borrar"
        onCancel={() => setIsConfirmingDelete(false)}
        onConfirm={async () => {
          await items.remove(item.id)
        }}
      >
        {/* ON DELETE CASCADE: se dice EXACTAMENTE de qué maletas se quita. */}
        <p>
          {item.luggageNames.length === 0
            ? 'No está en ninguna maleta.'
            : `Se quitará de ${item.luggageNames.length === 1 ? 'la maleta' : 'las maletas'} ${listFormat.format(item.luggageNames)}.`}
        </p>
        {item.isContainer && item.luggageNames.length > 0 && (
          <p>Lo que lleve dentro pasará a suelto.</p>
        )}
        <p>Esta acción no se puede deshacer.</p>
      </ConfirmDialog>
      <MergeItemsDialog
        pending={renaming.pending}
        onConfirm={renaming.confirmMerge}
        onCancel={renaming.cancelMerge}
      />
    </li>
  )
}

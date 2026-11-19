import { useId, useState } from 'react'
import { useRepositories } from '@/shared/di/repositories'
import { DuplicateError } from '@/shared/domain/errors'
import buttons from '@/shared/ui/buttons.module.css'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import highlightStyles from '@/shared/ui/highlight.module.css'
import { PencilIcon } from '@/shared/ui/icons/PencilIcon'
import { TrashIcon } from '@/shared/ui/icons/TrashIcon'
import { InlineEditInput } from '@/shared/ui/InlineEditInput'
import type { ItemSummary } from '../domain/itemRepository'
import styles from './CatalogRow.module.css'

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
  isExpanded: boolean
  /** Recién creado (o ya existía al intentar crearlo): resalte breve. */
  isHighlighted?: boolean
  onToggleExpanded: () => void
}

/**
 *   Calcetines                 En 2 maletas   ← tocar = desplegar
 *   ✎ Renombrar   🗑 Borrar                    ← acciones
 */
export function CatalogRow({
  item,
  isExpanded,
  isHighlighted = false,
  onToggleExpanded,
}: CatalogRowProps) {
  const { items } = useRepositories()
  const [isRenaming, setIsRenaming] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const panelId = useId()
  const usage = usageLabel(item.luggageNames.length)

  async function rename(name: string | null) {
    setIsRenaming(false)
    if (name === null || name === '' || name === item.name) return
    try {
      await items.update(item.id, { name })
    } catch (e) {
      // Nombre de otro artículo: no es un fallo, se explica al usuario.
      if (e instanceof DuplicateError) {
        setError(`${e.message}.`)
      } else {
        console.error(e)
        setError('No se ha podido renombrar. Inténtalo de nuevo.')
      }
    }
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
        <button
          type="button"
          className={styles.details}
          aria-expanded={isExpanded}
          aria-controls={panelId}
          aria-label={`${item.name}, ${usage}`}
          onClick={() => {
            setError(null)
            onToggleExpanded()
          }}
        >
          <span className={styles.name}>{item.name}</span>
          <span className={styles.usage}>{usage}</span>
        </button>
      )}

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      {isExpanded && !isRenaming && (
        <div id={panelId} className={styles.actions}>
          <button
            type="button"
            className={buttons.textAction}
            onClick={() => {
              setError(null)
              setIsRenaming(true)
            }}
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
            Borrar
          </button>
        </div>
      )}

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
        <p>Esta acción no se puede deshacer.</p>
      </ConfirmDialog>
    </li>
  )
}

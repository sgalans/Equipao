import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useRepositories } from '@/shared/di/repositories'
import buttons from '@/shared/ui/buttons.module.css'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { TrashIcon } from '@/shared/ui/icons/TrashIcon'
import type { Luggage } from '../domain/luggage'
import styles from './DeleteLuggageButton.module.css'

interface DeleteLuggageButtonProps {
  luggage: Luggage
  /** Qué hacer después de borrar (la página decide adónde navegar). */
  onDeleted: () => void | Promise<void>
}

/** Botón "Borrar maleta" + diálogo que explica qué se borra (y qué no). */
export function DeleteLuggageButton({
  luggage,
  onDeleted,
}: DeleteLuggageButtonProps) {
  const { luggages, quantities } = useRepositories()
  const [isConfirming, setIsConfirming] = useState(false)

  // Consecuencias reales del CASCADE: cuántas líneas de la lista se pierden.
  const itemCount = useLiveQuery(
    async () => (await quantities.listByLuggage(luggage.id)).length,
    [quantities, luggage.id],
  )

  return (
    <>
      <button
        type="button"
        // Al final de la maleta, con texto visible (decisión de producto):
        // lejos de lo que se toca a menudo, para no borrar por accidente.
        // El nombre accesible sale del propio texto: no hace falta aria-label.
        className={`${buttons.danger} ${styles.button}`}
        onClick={() => setIsConfirming(true)}
      >
        <TrashIcon />
        Borrar maleta
      </button>

      <ConfirmDialog
        open={isConfirming}
        title={`¿Borrar «${luggage.name}»?`}
        confirmLabel="Borrar"
        onCancel={() => setIsConfirming(false)}
        onConfirm={async () => {
          await luggages.remove(luggage.id)
          await onDeleted()
        }}
      >
        <p>{describeCascade(itemCount)}</p>
        <p>Esta acción no se puede deshacer.</p>
      </ConfirmDialog>
    </>
  )
}

/**
 * Explica qué se borra y, sobre todo, qué NO: los artículos del catálogo
 * (Item) son independientes de las maletas; solo se borra la lista de esta
 * maleta (ItemQuantity). Si está vacía, no hace falta mencionarlo.
 */
function describeCascade(itemCount: number | undefined): string {
  if (!itemCount) return 'Se borrará la maleta.'
  const list =
    itemCount === 1
      ? 'su lista (1 artículo)'
      : `su lista (${itemCount} artículos)`
  return `Se borrarán la maleta y ${list}. Los artículos de tu catálogo no se borran.`
}

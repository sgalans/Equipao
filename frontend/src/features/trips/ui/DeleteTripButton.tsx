import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useRepositories } from '@/shared/di/repositories'
import buttons from '@/shared/ui/buttons.module.css'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { TrashIcon } from '@/shared/ui/icons/TrashIcon'
import type { Trip } from '../domain/trip'

interface DeleteTripButtonProps {
  trip: Trip
  /** Qué hacer después de borrar (la página decide adónde navegar). */
  onDeleted: () => void | Promise<void>
}

/** Botón "Borrar viaje" + diálogo que avisa de lo que se borra en cascada. */
export function DeleteTripButton({ trip, onDeleted }: DeleteTripButtonProps) {
  const { trips, luggages } = useRepositories()
  const [isConfirming, setIsConfirming] = useState(false)

  // Consecuencias reales del CASCADE: cuántas maletas caen con el viaje.
  const luggageCount = useLiveQuery(
    async () => (await luggages.listByTrip(trip.id)).length,
    [luggages, trip.id],
  )

  return (
    <>
      <button
        type="button"
        className={buttons.iconDanger}
        // Botón de solo icono: aria-label le da nombre para los lectores de
        // pantalla; title muestra una ayuda al pasar el ratón en escritorio.
        aria-label="Borrar viaje"
        title="Borrar viaje"
        onClick={() => setIsConfirming(true)}
      >
        <TrashIcon />
      </button>

      <ConfirmDialog
        open={isConfirming}
        title={`¿Borrar «${trip.name}»?`}
        confirmLabel="Borrar"
        onCancel={() => setIsConfirming(false)}
        onConfirm={async () => {
          await trips.remove(trip.id)
          await onDeleted()
        }}
      >
        <p>{describeCascade(luggageCount)}</p>
        <p>Esta acción no se puede deshacer.</p>
      </ConfirmDialog>
    </>
  )
}

/**
 * Explica qué se borra en cascada y, sobre todo, qué NO: los ítems del
 * catálogo son independientes de viajes y maletas (Item vs ItemQuantity).
 * Contempla singular/plural y el caso "aún cargando" (undefined).
 */
function describeCascade(luggageCount: number | undefined): string {
  const keepsCatalog = 'Los ítems de tu catálogo no se borran.'
  if (luggageCount === undefined || luggageCount === 0) {
    return `Se borrará el viaje. ${keepsCatalog}`
  }
  const luggages =
    luggageCount === 1
      ? 'su maleta y la lista de lo que lleva'
      : `sus ${luggageCount} maletas y la lista de lo que lleva cada una`
  return `Se borrarán el viaje, ${luggages}. ${keepsCatalog}`
}

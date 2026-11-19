import { useId, useState } from 'react'
import { useRepositories } from '@/shared/di/repositories'
import { NameSchema } from '@/shared/domain/schemas'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { useNotifications } from '@/shared/ui/notifications/notificationStore'
import type { Compartment } from '../domain/compartment'
import { articles } from './addedSummary'
import styles from './AddItemsDialog.module.css'
import { movedSummary } from './bulkSummary'

interface MoveItemsDialogProps {
  open: boolean
  luggageId: string
  /** Líneas de la maleta (ItemQuantity) a mover. */
  quantityIds: string[]
  compartments: Compartment[]
  onCancel: () => void
  onMoved: () => void
}

/** Valores especiales del <select> (los <option> solo admiten strings). */
const LOOSE = ''
const NEW = '__new__'

/**
 * "¿A dónde los muevo?" dentro de la misma maleta: a sueltos, a un
 * compartimento existente o a uno NUEVO (se crea en el mismo paso, todo o
 * nada, con compartments.createWithQuantities).
 */
export function MoveItemsDialog({
  open,
  luggageId,
  quantityIds,
  compartments,
  onCancel,
  onMoved,
}: MoveItemsDialogProps) {
  const repositories = useRepositories()
  const show = useNotifications((state) => state.show)
  const destinationId = useId()
  const newNameId = useId()
  const [destination, setDestination] = useState(LOOSE)
  const [newName, setNewName] = useState('')

  const isNew = destination === NEW
  // Mismo esquema que valida el repositorio: nombre no vacío, máx. 100.
  const newNameIsValid = NameSchema.safeParse(newName).success

  function reset() {
    setDestination(LOOSE)
    setNewName('')
  }

  return (
    <ConfirmDialog
      open={open}
      title={`Mover ${articles(quantityIds.length)}`}
      confirmLabel="Mover"
      confirmVariant="primary"
      confirmDisabled={isNew && !newNameIsValid}
      onCancel={() => {
        reset()
        onCancel()
      }}
      onConfirm={async () => {
        if (isNew) {
          const created = await repositories.compartments.createWithQuantities(
            { luggageId, name: newName },
            quantityIds,
          )
          show(movedSummary(quantityIds.length, created.name))
        } else {
          const compartmentId = destination === LOOSE ? null : destination
          await repositories.quantities.moveMany(quantityIds, compartmentId)
          const name =
            compartments.find((c) => c.id === compartmentId)?.name ?? null
          show(movedSummary(quantityIds.length, name))
        }
        reset()
        onMoved()
      }}
    >
      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor={destinationId}>Dónde</label>
          {/* <select> nativo: en el iPhone, el selector de rueda de iOS. */}
          <select
            id={destinationId}
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
          >
            <option value={LOOSE}>Suelto en la maleta</option>
            {compartments.map((compartment) => (
              <option key={compartment.id} value={compartment.id}>
                {compartment.name}
              </option>
            ))}
            <option value={NEW}>+ Nuevo compartimento…</option>
          </select>
        </div>

        {isNew && (
          <div className={styles.field}>
            <label htmlFor={newNameId}>Nombre del compartimento nuevo</label>
            <input
              id={newNameId}
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Neceser, mochila de mano…"
              maxLength={100}
              autoComplete="off"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- el campo aparece porque el usuario acaba de elegir "Nuevo compartimento"
              autoFocus
            />
          </div>
        )}
      </div>
    </ConfirmDialog>
  )
}

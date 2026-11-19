import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useState } from 'react'
import { useRepositories } from '@/shared/di/repositories'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { useNotifications } from '@/shared/ui/notifications/notificationStore'
import { addedSummary, articles } from './addedSummary'
import styles from './AddItemsDialog.module.css'

interface AddItemsDialogProps {
  open: boolean
  /** Artículos del catálogo a añadir. */
  itemIds: string[]
  /**
   * Maleta de destino ya decidida (desde la propia maleta, "Añadir varios"):
   * entonces solo se elige suelto/compartimento. Sin ella (desde el
   * catálogo) también se elige la maleta.
   */
  fixedLuggageId?: string
  onCancel: () => void
  /** Tras añadir (el resultado ya se ha comunicado con el aviso global). */
  onAdded: () => void
}

/** Valor del <select> para "suelto": los <option> solo admiten strings. */
const LOOSE = ''

/**
 * Diálogo "¿A dónde los añado?": maleta (si no viene fijada) y destino
 * (suelto o un compartimento de esa maleta). Usa quantities.addMany, que
 * ignora los que ya estaban (idempotente).
 */
export function AddItemsDialog({
  open,
  itemIds,
  fixedLuggageId,
  onCancel,
  onAdded,
}: AddItemsDialogProps) {
  const { luggages, compartments, quantities } = useRepositories()
  const show = useNotifications((state) => state.show)
  const luggageSelectId = useId()
  const destinationSelectId = useId()

  const luggageList = useLiveQuery(() => luggages.list(), [luggages])
  // Elección del usuario; si no ha elegido, la primera maleta (la más
  // reciente). Derivado en el render, sin efectos que sincronicen estado.
  const [chosenLuggageId, setChosenLuggageId] = useState<string | null>(null)
  const luggageId =
    fixedLuggageId ?? chosenLuggageId ?? luggageList?.[0]?.id ?? null
  const [compartmentId, setCompartmentId] = useState(LOOSE)

  const compartmentList = useLiveQuery(
    async () => (luggageId ? compartments.listByLuggage(luggageId) : []),
    [compartments, luggageId],
  )
  const luggageName =
    luggageList?.find((luggage) => luggage.id === luggageId)?.name ?? ''
  const noLuggages = luggageList !== undefined && luggageList.length === 0

  return (
    <ConfirmDialog
      open={open}
      title={`Añadir ${articles(itemIds.length)}`}
      confirmLabel="Añadir"
      confirmVariant="primary"
      confirmDisabled={luggageId === null || itemIds.length === 0}
      onCancel={onCancel}
      onConfirm={async () => {
        if (!luggageId) return
        const result = await quantities.addMany(
          luggageId,
          itemIds,
          compartmentId === LOOSE ? null : compartmentId,
        )
        show(
          addedSummary(
            result.added.length,
            result.skippedItemIds.length,
            luggageName,
          ),
        )
        setCompartmentId(LOOSE)
        onAdded()
      }}
    >
      {noLuggages ? (
        <p>Aún no tienes maletas. Crea una en "Mis maletas".</p>
      ) : (
        <div className={styles.fields}>
          {!fixedLuggageId && (
            <div className={styles.field}>
              <label htmlFor={luggageSelectId}>Maleta</label>
              {/* <select> nativo: en el iPhone, el selector de rueda de iOS. */}
              <select
                id={luggageSelectId}
                value={luggageId ?? ''}
                onChange={(event) => {
                  setChosenLuggageId(event.target.value)
                  // Los compartimentos son de cada maleta: se reinicia.
                  setCompartmentId(LOOSE)
                }}
              >
                {luggageList?.map((luggage) => (
                  <option key={luggage.id} value={luggage.id}>
                    {luggage.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className={styles.field}>
            <label htmlFor={destinationSelectId}>Dónde</label>
            <select
              id={destinationSelectId}
              value={compartmentId}
              onChange={(event) => setCompartmentId(event.target.value)}
            >
              <option value={LOOSE}>Suelto en la maleta</option>
              {compartmentList?.map((compartment) => (
                <option key={compartment.id} value={compartment.id}>
                  {compartment.name}
                </option>
              ))}
            </select>
          </div>
          <p className={styles.note}>
            Los que ya estén en la maleta se dejan como están.
          </p>
        </div>
      )}
    </ConfirmDialog>
  )
}

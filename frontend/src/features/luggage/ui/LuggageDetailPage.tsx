import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { isSameItemName } from '@/features/items/domain/itemName'
import { useRepositories } from '@/shared/di/repositories'
import buttons from '@/shared/ui/buttons.module.css'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { EditableTitle } from '@/shared/ui/EditableTitle'
import { useNotifications } from '@/shared/ui/notifications/notificationStore'
import page from '@/shared/ui/page.module.css'
import { useTemporaryHighlight } from '@/shared/ui/useTemporaryHighlight'
import { packingProgress } from '../domain/packing'
import { AddItemForm } from './AddItemForm'
import { articles } from './addedSummary'
import { removedSummary } from './bulkSummary'
import { DeleteLuggageButton } from './DeleteLuggageButton'
import { LuggageDescription } from './LuggageDescription'
import { MoveItemsDialog } from './MoveItemsDialog'
import { PackingList } from './PackingList'
import styles from './LuggageDetailPage.module.css'
import { PackingProgress } from './PackingProgress'

/** Pantalla /luggages/:luggageId: la lista de artículos de una maleta. */
export function LuggageDetailPage() {
  const { luggageId = '' } = useParams<{ luggageId: string }>()
  const { luggages, quantities, compartments } = useRepositories()
  const navigate = useNavigate()
  const show = useNotifications((state) => state.show)

  // Modo selección: reorganizar la maleta (mover a un compartimento, a
  // sueltos o a uno nuevo) o quitar varios de golpe. Mover ENTRE maletas no
  // (decisión de producto): eso se hace desde el catálogo.
  const [isSelecting, setIsSelecting] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [dialog, setDialog] = useState<'move' | 'remove' | null>(null)

  function toggleSelected(quantityId: string) {
    // Inmutable: un Set NUEVO para que React detecte el cambio.
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(quantityId)) next.delete(quantityId)
      else next.add(quantityId)
      return next
    })
  }

  function exitSelection() {
    setIsSelecting(false)
    setSelected(new Set())
    setDialog(null)
  }

  // Tres estados distinguibles (getById devuelve undefined si no existe,
  // igual que useLiveQuery mientras carga; por eso lo convertimos a null):
  //   undefined → cargando · null → no existe · Luggage → listo
  const luggage = useLiveQuery(
    async () => (await luggages.getById(luggageId)) ?? null,
    [luggages, luggageId],
  )
  // Contenido y compartimentos en UN SOLO useLiveQuery. Con dos separados,
  // cada uno se refresca por su cuenta y, al borrar un compartimento, habría
  // un instante incoherente ("tearing"): el compartimento ya no está pero
  // sus artículos aún no aparecen como sueltos (un parpadeo en pantalla).
  // Juntos, siempre llegan de la misma instantánea de los datos.
  const contents = useLiveQuery(async () => {
    const [entries, compartmentList] = await Promise.all([
      quantities.listEntriesByLuggage(luggageId),
      compartments.listByLuggage(luggageId),
    ])
    return { entries, compartmentList }
  }, [quantities, compartments, luggageId])

  // Fila resaltada brevemente (al intentar añadir algo que ya estaba).
  const { highlightedId, highlight } = useTemporaryHighlight()

  // OJO: todos los hooks van ANTES de los `return` tempranos. Las reglas de
  // los hooks exigen llamarlos siempre en el mismo orden en cada render.
  if (luggage === undefined || contents === undefined) {
    return <p aria-busy="true">Cargando maleta…</p>
  }

  if (luggage === null) {
    return (
      <section>
        <h1 className={page.title}>No encontramos esta maleta</h1>
        <p>Puede que se haya borrado.</p>
        <Link to="/">Volver a mis maletas</Link>
      </section>
    )
  }

  const { entries, compartmentList } = contents

  /** Resalta la fila del artículo que se ha intentado añadir de nuevo. */
  function highlightExisting(name: string) {
    // MISMO criterio que el repositorio usa para decidir que es un
    // duplicado: así se resalta exactamente la fila que lo ha provocado.
    const existing = entries.find((entry) =>
      isSameItemName(entry.itemName, name),
    )
    highlight(existing?.id ?? null)
  }

  return (
    <section>
      <header className={page.header}>
        <EditableTitle
          // key: si cambiamos de maleta sin desmontar la página, el título
          // empieza de cero (sin un borrador de la maleta anterior).
          key={luggage.id}
          value={luggage.name}
          editLabel="Renombrar maleta"
          onSave={async (name) => {
            await luggages.update(luggage.id, { name })
          }}
        />
        {entries.length > 0 && (
          <button
            type="button"
            className={buttons.headerAction}
            onClick={() =>
              isSelecting ? exitSelection() : setIsSelecting(true)
            }
          >
            {isSelecting ? 'Cancelar' : 'Seleccionar'}
          </button>
        )}
      </header>
      <LuggageDescription
        // key: si cambia de maleta, el editor empieza de cero.
        key={luggage.id}
        value={luggage.description}
        onSave={async (description) => {
          await luggages.update(luggage.id, { description })
        }}
      />

      <PackingProgress {...packingProgress(entries, compartmentList)} />
      {/* En modo selección solo se eligen artículos: fuera lo demás. */}
      {!isSelecting && (
        <AddItemForm
          luggageId={luggage.id}
          entries={entries}
          onDuplicate={highlightExisting}
          catalogLink={`/luggages/${luggage.id}/add-items`}
        />
      )}
      <PackingList
        luggageId={luggage.id}
        entries={entries}
        compartments={compartmentList}
        highlightedId={highlightedId}
        onDuplicate={highlightExisting}
        selection={
          isSelecting ? { selected, onToggle: toggleSelected } : undefined
        }
      />

      {isSelecting ? (
        // Barra fija abajo, al alcance del pulgar (como en el catálogo).
        <div className={styles.selectionBar}>
          <button
            type="button"
            className={buttons.primary}
            disabled={selected.size === 0}
            onClick={() => setDialog('move')}
          >
            Mover{selected.size > 0 && ` ${selected.size}`}…
          </button>
          <button
            type="button"
            className={buttons.secondary}
            disabled={selected.size === 0}
            onClick={() => setDialog('remove')}
          >
            Quitar{selected.size > 0 && ` ${selected.size}`}
          </button>
        </div>
      ) : (
        <footer className={styles.footer}>
          <DeleteLuggageButton
            luggage={luggage}
            // replace: la pantalla de una maleta borrada no queda en el
            // historial; "atrás" no lleva a una maleta que ya no existe.
            onDeleted={() => navigate('/', { replace: true })}
          />
        </footer>
      )}

      <MoveItemsDialog
        open={dialog === 'move'}
        luggageId={luggage.id}
        quantityIds={[...selected]}
        compartments={compartmentList}
        onCancel={() => setDialog(null)}
        onMoved={exitSelection}
      />
      <ConfirmDialog
        open={dialog === 'remove'}
        title={`¿Quitar ${articles(selected.size)} de la maleta?`}
        confirmLabel="Quitar"
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          const count = selected.size
          await quantities.removeMany([...selected])
          show(removedSummary(count))
          exitSelection()
        }}
      >
        <p>Siguen en tu catálogo.</p>
      </ConfirmDialog>
    </section>
  )
}

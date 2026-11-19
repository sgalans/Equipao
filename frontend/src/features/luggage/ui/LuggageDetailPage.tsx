import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { normalizeForSearch } from '@/features/items/domain/search'
import { useRepositories } from '@/shared/di/repositories'
import { EditableTitle } from '@/shared/ui/EditableTitle'
import page from '@/shared/ui/page.module.css'
import { luggageProgress } from '../domain/packing'
import { AddItemForm } from './AddItemForm'
import { DeleteLuggageButton } from './DeleteLuggageButton'
import { PackingList } from './PackingList'
import styles from './LuggageDetailPage.module.css'
import { PackingProgress } from './PackingProgress'

const HIGHLIGHT_MS = 2000

/** Pantalla /luggages/:luggageId: la lista de artículos de una maleta. */
export function LuggageDetailPage() {
  const { luggageId = '' } = useParams<{ luggageId: string }>()
  const { luggages, quantities, compartments } = useRepositories()
  const navigate = useNavigate()

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
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  useEffect(() => {
    if (!highlightedId) return
    const timer = setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS)
    // Limpieza: si se desmonta o cambia antes de tiempo, no queda un
    // temporizador "huérfano" que actualice un componente que ya no existe.
    return () => clearTimeout(timer)
  }, [highlightedId])

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
    const needle = normalizeForSearch(name)
    const existing = entries.find(
      (entry) => normalizeForSearch(entry.itemName) === needle,
    )
    setHighlightedId(existing?.id ?? null)
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
      </header>

      <PackingProgress {...luggageProgress(entries)} />
      <AddItemForm
        luggageId={luggage.id}
        entries={entries}
        onDuplicate={highlightExisting}
      />
      <PackingList
        luggageId={luggage.id}
        entries={entries}
        compartments={compartmentList}
        highlightedId={highlightedId}
        onDuplicate={highlightExisting}
      />

      <footer className={styles.footer}>
        <DeleteLuggageButton
          luggage={luggage}
          // replace: la pantalla de una maleta borrada no queda en el
          // historial; "atrás" no lleva a una maleta que ya no existe.
          onDeleted={() => navigate('/', { replace: true })}
        />
      </footer>
    </section>
  )
}

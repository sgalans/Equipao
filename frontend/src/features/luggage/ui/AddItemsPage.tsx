import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { normalizeForSearch } from '@/features/items/domain/search'
import { CatalogRow } from '@/features/items/ui/CatalogRow'
import { useRepositories } from '@/shared/di/repositories'
import buttons from '@/shared/ui/buttons.module.css'
import {
  reportError,
  useNotifications,
} from '@/shared/ui/notifications/notificationStore'
import page from '@/shared/ui/page.module.css'
import { addedSummary } from './addedSummary'
import { AddItemsDialog } from './AddItemsDialog'
import styles from './AddItemsPage.module.css'

/**
 * Pantalla /luggages/:luggageId/add-items: el catálogo con casillas para
 * añadir varios artículos de golpe a ESTA maleta. Pantalla completa (no un
 * diálogo): en el móvil, una lista larga con buscador se maneja mejor así.
 */
export function AddItemsPage() {
  const { luggageId = '' } = useParams<{ luggageId: string }>()
  const { luggages, items, quantities, compartments } = useRepositories()
  const navigate = useNavigate()
  const show = useNotifications((state) => state.show)
  const searchId = useId()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [isChoosingDestination, setIsChoosingDestination] = useState(false)
  const [isAdding, setIsAdding] = useState(false)

  // Todo en un solo useLiveQuery: llega junto, sin estados intermedios
  // incoherentes ("tearing"). undefined → cargando · luggage null → no existe.
  const data = useLiveQuery(async () => {
    const [luggage, catalog, entries, compartmentList] = await Promise.all([
      luggages.getById(luggageId),
      items.listWithUsage(),
      quantities.listByLuggage(luggageId),
      compartments.listByLuggage(luggageId),
    ])
    const inLuggage = new Set(entries.map((entry) => entry.itemId))
    return {
      luggage: luggage ?? null,
      // Lo que ya está en esta maleta no se ofrece: no tiene sentido.
      available: catalog.filter((item) => !inLuggage.has(item.id)),
      hasCompartments: compartmentList.length > 0,
    }
  }, [luggages, items, quantities, compartments, luggageId])

  const visible = useMemo(() => {
    const needle = normalizeForSearch(query)
    if (!data || needle === '') return data?.available ?? []
    return data.available.filter((item) =>
      normalizeForSearch(item.name).includes(needle),
    )
  }, [data, query])

  if (data === undefined) {
    return <p aria-busy="true">Cargando artículos…</p>
  }
  if (data.luggage === null) {
    return (
      <section>
        <h1 className={page.title}>No encontramos esta maleta</h1>
        <p>Puede que se haya borrado.</p>
        <Link to="/">Volver a mis maletas</Link>
      </section>
    )
  }

  const luggage = data.luggage
  const backToLuggage = () =>
    navigate(`/luggages/${luggage.id}`, { replace: true })

  function toggleSelected(itemId: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  async function add() {
    // Sin compartimentos, preguntar "¿dónde?" con una sola opción sería un
    // paso inútil: se añaden directamente, sueltos.
    if (data?.hasCompartments) {
      setIsChoosingDestination(true)
      return
    }
    setIsAdding(true)
    try {
      const result = await quantities.addMany(luggage.id, [...selected])
      show(
        addedSummary(
          result.added.length,
          result.skippedItemIds.length,
          luggage.name,
        ),
      )
      await backToLuggage()
    } catch (error) {
      reportError(error)
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <section>
      <header className={page.header}>
        <h1 className={page.title}>Añadir a «{luggage.name}»</h1>
      </header>

      {data.available.length === 0 ? (
        <p className={styles.empty}>
          Todos los artículos de tu catálogo ya están en esta maleta.
        </p>
      ) : (
        <>
          <label htmlFor={searchId} className="visually-hidden">
            Buscar artículos
          </label>
          <input
            id={searchId}
            type="search"
            className={styles.search}
            placeholder="Buscar…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
            autoCorrect="off"
          />
          <p className={styles.note}>
            No se muestran los que ya están en esta maleta.
          </p>

          {visible.length === 0 ? (
            <p className={styles.empty}>
              Ningún artículo coincide con «{query.trim()}».
            </p>
          ) : (
            <ul className={styles.list}>
              {visible.map((item) => (
                // Misma fila con casilla que el modo selección del catálogo.
                <CatalogRow
                  key={item.id}
                  item={item}
                  isExpanded={false}
                  onToggleExpanded={() => {}}
                  selection={{
                    isSelected: selected.has(item.id),
                    onToggle: () => toggleSelected(item.id),
                  }}
                />
              ))}
            </ul>
          )}

          <div className={styles.bar}>
            <button
              type="button"
              className={buttons.primary}
              disabled={selected.size === 0 || isAdding}
              onClick={() => void add()}
            >
              {selected.size === 0
                ? 'Selecciona artículos'
                : `Añadir ${selected.size} a la maleta`}
            </button>
          </div>
        </>
      )}

      <AddItemsDialog
        open={isChoosingDestination}
        itemIds={[...selected]}
        fixedLuggageId={luggage.id}
        onCancel={() => setIsChoosingDestination(false)}
        onAdded={() => {
          setIsChoosingDestination(false)
          void backToLuggage()
        }}
      />
    </section>
  )
}

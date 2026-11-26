import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { isSameItemName } from '@/features/items/domain/itemName'
import { normalizeForSearch } from '@/features/items/domain/search'
import { CatalogRow } from '@/features/items/ui/CatalogRow'
import { CatalogSections } from '@/features/items/ui/CatalogSections'
import { CreateAsCompartment } from '@/features/items/ui/CreateAsCompartment'
import { useRepositories } from '@/shared/di/repositories'
import { DuplicateError } from '@/shared/domain/errors'
import buttons from '@/shared/ui/buttons.module.css'
import { PlusIcon } from '@/shared/ui/icons/PlusIcon'
import {
  reportError,
  useNotifications,
} from '@/shared/ui/notifications/notificationStore'
import page from '@/shared/ui/page.module.css'
import { addItemByName } from '../application/addItemByName'
import { addedSummary } from './addedSummary'
import { AddItemsDialog } from './AddItemsDialog'
import styles from './AddItemsPage.module.css'

/** Parámetro de la URL con el compartimento de destino (desde su "+"). */
export const COMPARTMENT_PARAM = 'compartment'

/**
 * Pantalla /luggages/:luggageId/add-items: la ÚNICA forma de añadir
 * artículos a una maleta (decisión de producto: sustituye al campo "Añadir a
 * la maleta…"). El catálogo entero con casillas: buscar, elegir uno o varios
 * y crear los que no existan. Pantalla completa (no una hoja): en iOS el
 * teclado taparía casi entera una hoja inferior con buscador.
 *
 * ?compartment=<id> (desde el "+" de un compartimento): se añade ahí, sin
 * preguntar el destino.
 *
 * También es el único sitio para añadir COMPARTIMENTOS (decisión del
 * usuario: se quitó "Nuevo compartimento" de la maleta): los contenedores
 * del catálogo salen en su sección, arriba, y elegirlos los añade como
 * compartimentos; uno nuevo se crea con "Crear «X» como compartimento".
 */
export function AddItemsPage() {
  const { luggageId = '' } = useParams<{ luggageId: string }>()
  const [searchParams] = useSearchParams()
  const repositories = useRepositories()
  const { luggages, items, quantities, compartments } = repositories
  const navigate = useNavigate()
  const show = useNotifications((state) => state.show)
  const searchId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [message, setMessage] = useState<string | null>(null)
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
    return {
      luggage: luggage ?? null,
      catalog,
      // listByLuggage no incluye las líneas contenedor: se suman los
      // compartimentos (su itemId es el del contenedor del catálogo).
      inLuggage: new Set([
        ...entries.map((entry) => entry.itemId),
        ...compartmentList.map((compartment) => compartment.itemId),
      ]),
      compartmentList,
    }
  }, [luggages, items, quantities, compartments, luggageId])

  const name = query.trim()

  // BUSCAR es permisivo ("calc" encuentra "Calcetines", sin tildes)…
  const visible = useMemo(() => {
    const needle = normalizeForSearch(query)
    if (!data || needle === '') return data?.catalog ?? []
    return data.catalog.filter((item) =>
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
  // Solo vale un compartimento de ESTA maleta (la URL se puede manipular).
  const targetCompartment = data.compartmentList.find(
    (c) => c.id === searchParams.get(COMPARTMENT_PARAM),
  )
  // …pero decidir si YA EXISTE es estricto: el mismo criterio que usa el
  // repositorio para impedir duplicados (isSameItemName).
  const exactMatch = data.catalog.find((item) =>
    isSameItemName(item.name, name),
  )

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

  /** Marca un artículo (sin desmarcarlo si ya lo estaba). */
  function select(itemId: string) {
    setSelected((current) => new Set(current).add(itemId))
  }

  /**
   * "+" (decisión de producto):
   * - nombre nuevo → crea el artículo Y LO AÑADE a la maleta (o al
   *   compartimento de destino) al momento; se queda en esta pantalla para
   *   seguir añadiendo (la fila pasa a "Ya en la maleta");
   * - ya existe en el catálogo → no se duplica: se marca;
   * - ya está en la maleta → se avisa.
   */
  async function create() {
    if (name === '') return
    try {
      if (exactMatch) {
        if (data?.inLuggage.has(exactMatch.id)) {
          setMessage(`«${exactMatch.name}» ya está en esta maleta.`)
          return
        }
        if (exactMatch.isContainer && targetCompartment) {
          setMessage(
            `«${exactMatch.name}» es un compartimento: no puede ir dentro de otro.`,
          )
          return
        }
        select(exactMatch.id)
        setMessage(`«${exactMatch.name}» ya estaba en tu catálogo: marcado.`)
      } else {
        // Caso de uso "busca o crea, y añade" (capa application).
        await addItemByName(
          repositories,
          luggage.id,
          name,
          targetCompartment?.id ?? null,
        )
        setMessage(
          `«${name}» creado y añadido a «${targetCompartment?.name ?? luggage.name}».`,
        )
      }
      // Se vacía el campo (y con él el filtro): se ve la lista entera, con
      // el artículo marcado.
      setQuery('')
    } catch (error) {
      // Otra pestaña pudo crearlo justo antes: el repositorio lo impide.
      if (error instanceof DuplicateError) setMessage(`${error.message}.`)
      else reportError(error)
    } finally {
      inputRef.current?.focus()
    }
  }

  /** "Crear «X» como compartimento": crea el contenedor y lo añade ya. */
  async function createCompartment() {
    if (name === '') return
    try {
      await compartments.create({ luggageId: luggage.id, name })
      setMessage(`«${name}» creado y añadido como compartimento.`)
      setQuery('')
    } catch (error) {
      if (error instanceof DuplicateError) setMessage(`${error.message}.`)
      else reportError(error)
    } finally {
      inputRef.current?.focus()
    }
  }

  // Elegidos que son artículos normales (los contenedores no van "dentro"
  // de nada: addMany los deja siempre como compartimentos de la maleta).
  const catalogById = new Map(data.catalog.map((item) => [item.id, item]))
  const hasRegularSelected = [...selected].some(
    (id) => catalogById.get(id)?.isContainer === false,
  )

  async function add() {
    // Sin destino fijo y con compartimentos, se pregunta "¿dónde?". Sin
    // compartimentos sería un paso inútil: van sueltos.
    // Solo compartimentos elegidos: tampoco hay nada que preguntar.
    if (
      !targetCompartment &&
      hasRegularSelected &&
      data?.compartmentList.length
    ) {
      setIsChoosingDestination(true)
      return
    }
    setIsAdding(true)
    try {
      const result = await quantities.addMany(
        luggage.id,
        [...selected],
        targetCompartment?.id ?? null,
      )
      show(
        addedSummary(
          result.added.length,
          result.skippedItemIds.length,
          targetCompartment?.name ?? luggage.name,
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
        <h1 className={page.title}>
          Añadir a «{targetCompartment?.name ?? luggage.name}»
        </h1>
      </header>

      <form
        className={styles.field}
        // Intro no crea (como en el catálogo): solo el botón "+".
        onSubmit={(event) => event.preventDefault()}
      >
        <label htmlFor={searchId} className="visually-hidden">
          Buscar o crear artículos
        </label>
        <input
          ref={inputRef}
          id={searchId}
          // type="search": en iOS el campo trae su botón de borrar el texto.
          type="search"
          placeholder="Buscar o crear…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setMessage(null)
          }}
          autoComplete="off"
          autoCorrect="off"
          maxLength={100}
        />
        <button
          type="button"
          className={buttons.iconPrimary}
          aria-label="Crear artículo"
          title="Crear artículo"
          disabled={name === ''}
          // Sin esto, en iOS el toque quita el foco del campo y se cierra
          // el teclado antes de crear.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => void create()}
        >
          <PlusIcon />
        </button>
      </form>
      {/* role="status": se anuncia sin interrumpir. Hueco reservado para que
          la lista no "salte" al aparecer el mensaje. */}
      <p role="status" className={styles.message}>
        {message}
      </p>
      {/* Desde un compartimento no: uno no puede ir dentro de otro. */}
      {name !== '' && !exactMatch && !targetCompartment && (
        <CreateAsCompartment
          name={name}
          onCreate={() => void createCompartment()}
        />
      )}

      {data.catalog.length === 0 ? (
        <p className={styles.empty}>
          Aún no tienes artículos. Escribe arriba y toca + para crear el
          primero.
        </p>
      ) : visible.length === 0 ? (
        <p className={styles.empty}>
          Ningún artículo coincide con «{name}». Toca + para crearlo.
        </p>
      ) : (
        <CatalogSections
          items={visible}
          renderRow={(item) => (
            // Misma fila con casilla que el modo selección del catálogo. Lo
            // que ya está en la maleta se ve (orienta al buscar) pero no se
            // puede elegir.
            <CatalogRow
              key={item.id}
              item={item}
              isExpanded={false}
              onToggleExpanded={() => {}}
              selection={{
                isSelected: selected.has(item.id),
                onToggle: () => toggleSelected(item.id),
                disabledReason: data.inLuggage.has(item.id)
                  ? 'Ya en la maleta'
                  : // Desde el "Añadir" de un compartimento: otro
                    // compartimento no puede ir dentro.
                    item.isContainer && targetCompartment
                    ? 'Es un compartimento'
                    : undefined,
              }}
            />
          )}
        />
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

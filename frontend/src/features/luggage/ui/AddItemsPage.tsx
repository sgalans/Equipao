import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { isSameItemName } from '@/features/items/domain/itemName'
import { normalizeForSearch } from '@/features/items/domain/search'
import { CatalogRow } from '@/features/items/ui/CatalogRow'
import { CatalogSections } from '@/features/items/ui/CatalogSections'
import { CreateChoice } from '@/features/items/ui/CreateChoice'
import { useRepositories } from '@/shared/di/repositories'
import { DuplicateError } from '@/shared/domain/errors'
import buttons from '@/shared/ui/buttons.module.css'
import { ChevronDownIcon } from '@/shared/ui/icons/ChevronDownIcon'
import {
  reportError,
  useNotifications,
} from '@/shared/ui/notifications/notificationStore'
import page from '@/shared/ui/page.module.css'
import { addItemByName } from '../application/addItemByName'
import { addedSummary } from './addedSummary'
import styles from './AddItemsPage.module.css'
import { containersNote } from './containersNote'

/** Parámetro de la URL con el compartimento de destino (desde su "+"). */
export const COMPARTMENT_PARAM = 'compartment'

/** Valores especiales de "Dónde" (los <option> solo admiten strings). */
const LOOSE = ''
/** "Mochila (compartimento nuevo)": un contenedor elegido en esta pantalla. */
const NEW_PREFIX = 'new:'

/**
 * Pantalla /luggages/:luggageId/add-items: la ÚNICA forma de añadir
 * artículos a una maleta (decisión de producto: sustituye al campo "Añadir a
 * la maleta…"). El catálogo entero con casillas: buscar, elegir uno o varios
 * y crear los que no existan. Pantalla completa (no una hoja): en iOS el
 * teclado taparía casi entera una hoja inferior con buscador.
 *
 * "Dónde" (decisión del usuario), en la barra de abajo junto al botón de
 * añadir: un desplegable con "Suelto en la maleta" por defecto, los
 * compartimentos de la maleta y los que se están eligiendo aquí ("Mochila
 * (compartimento nuevo)"). Sin ventana emergente de confirmación.
 * ?compartment=<id> (desde el "Añadir a X" de un compartimento): "Dónde"
 * empieza en ese compartimento (y se puede cambiar).
 *
 * También es el único sitio para añadir COMPARTIMENTOS (decisión del
 * usuario: se quitó "Nuevo compartimento" de la maleta): los contenedores
 * del catálogo salen en su sección, arriba, y elegirlos los añade como
 * compartimentos; uno nuevo se crea con "+ Compartimento" (CreateChoice).
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
  const [isAdding, setIsAdding] = useState(false)
  // "Dónde" elegido a mano; null = el de por defecto (ver `destination`).
  const [chosenDestination, setChosenDestination] = useState<string | null>(
    null,
  )
  const destinationId = useId()

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

  const catalogById = new Map(data.catalog.map((item) => [item.id, item]))
  const selectedContainers = [...selected]
    .map((id) => catalogById.get(id))
    .filter((item) => item?.isContainer === true)

  // "Dónde": suelto, los compartimentos de la maleta y los contenedores
  // elegidos aquí que aún no están en ella (tu idea: elegir "Mochila" y
  // meter cosas dentro sin salir de la pantalla).
  const destinationOptions = [
    { value: LOOSE, label: 'Suelto en la maleta', name: luggage.name },
    ...data.compartmentList.map((c) => ({
      value: c.id,
      label: c.name,
      name: c.name,
    })),
    ...selectedContainers.flatMap((item) =>
      item && !data.inLuggage.has(item.id)
        ? [
            {
              value: `${NEW_PREFIX}${item.id}`,
              // "(compartimento nuevo)": vale para cualquier nombre, sin
              // líos de género ("Neceser (nuevo)", "Mochila (nueva)").
              label: `${item.name} (compartimento nuevo)`,
              name: item.name,
            },
          ]
        : [],
    ),
  ]
  // Valor efectivo, DERIVADO en el render (sin efectos que sincronicen
  // estado): lo elegido si sigue siendo una opción (p. ej. si se desmarca la
  // Mochila, su opción desaparece), si no, el de por defecto.
  const defaultDestination = targetCompartment?.id ?? LOOSE
  const destination = destinationOptions.some(
    (o) => o.value === chosenDestination,
  )
    ? (chosenDestination as string)
    : defaultDestination
  const destinationOption = destinationOptions.find(
    (o) => o.value === destination,
  )
  const destinationName = destinationOption?.name ?? luggage.name
  const newContainerId = destination.startsWith(NEW_PREFIX)
    ? destination.slice(NEW_PREFIX.length)
    : null
  // Un compartimento nunca va dentro de otro: si hay contenedores elegidos y
  // el destino es un compartimento, ellos van a la maleta. Se avisa (si no,
  // sorprende).
  // (Los que "fallan": todos los elegidos salvo el propio destino nuevo.)
  const containersGoingLoose =
    destination === LOOSE
      ? []
      : selectedContainers.flatMap((item) =>
          item && item.id !== newContainerId ? [item.name] : [],
        )

  function toggleSelected(itemId: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  /**
   * "+ Artículo" (solo con un nombre NUEVO: con uno que ya existe, la lista
   * filtrada ya lo muestra para elegirlo): crea el artículo Y LO AÑADE a la
   * maleta (o al compartimento de destino) al momento, y se queda en esta
   * pantalla para seguir añadiendo (la fila pasa a "Ya en la maleta").
   */
  async function createItem() {
    if (name === '' || exactMatch) return
    try {
      if (newContainerId) {
        // El destino aún no existe (se crea al pulsar "Añadir"): se crea el
        // artículo y se MARCA, para que entre con lo demás.
        const item = await items.create({ name })
        setSelected((current) => new Set(current).add(item.id))
        setMessage(`«${name}» creado y marcado.`)
      } else {
        // Caso de uso "busca o crea, y añade" (capa application), al
        // destino de "Dónde".
        await addItemByName(
          repositories,
          luggage.id,
          name,
          destination === LOOSE ? null : destination,
        )
        setMessage(`«${name}» creado y añadido a «${destinationName}».`)
      }
      // Se vacía el campo (y con él el filtro): se ve la lista entera.
      setQuery('')
    } catch (error) {
      // Otra pestaña pudo crearlo justo antes: el repositorio lo impide.
      if (error instanceof DuplicateError) setMessage(`${error.message}.`)
      else reportError(error)
    } finally {
      inputRef.current?.focus()
    }
  }

  /** "+ Compartimento": crea el contenedor y lo añade ya a la maleta. */
  async function createCompartment() {
    if (name === '' || exactMatch) return
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

  async function add() {
    setIsAdding(true)
    try {
      const ids = [...selected]
      const result = newContainerId
        ? await quantities.addManyIntoNewCompartment(
            luggage.id,
            ids,
            newContainerId,
          )
        : await quantities.addMany(
            luggage.id,
            ids,
            destination === LOOSE ? null : destination,
          )
      show(
        addedSummary(
          result.added.length,
          result.skippedItemIds.length,
          destinationName,
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
        {/* Siempre la maleta: el destino exacto es "Dónde" (cambiable). */}
        <h1 className={page.title}>Añadir a «{luggage.name}»</h1>
      </header>

      <form
        className={styles.field}
        // Intro no crea (como en el catálogo): solo los botones de crear.
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
      </form>
      {/* Siempre visibles (atenuados sin un nombre nuevo): la lista no salta. */}
      <CreateChoice
        name={name}
        canCreate={name !== '' && !exactMatch}
        onCreateItem={() => void createItem()}
        onCreateCompartment={() => void createCompartment()}
        showHelp={!data.catalog.some((item) => item.isContainer)}
      />
      {/* role="status": se anuncia sin interrumpir. Hueco reservado para que
          la lista no "salte" al aparecer el mensaje. */}
      <p role="status" className={styles.message}>
        {message}
      </p>

      {data.catalog.length === 0 ? (
        <p className={styles.empty}>
          Aún no tienes artículos. Escribe arriba para crear el primero.
        </p>
      ) : visible.length === 0 ? (
        <p className={styles.empty}>Ningún artículo coincide con «{name}».</p>
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
              selection={{
                isSelected: selected.has(item.id),
                onToggle: () => toggleSelected(item.id),
                disabledReason: data.inLuggage.has(item.id)
                  ? 'Ya en la maleta'
                  : undefined,
              }}
            />
          )}
        />
      )}

      {/* Barra fija abajo, al alcance del pulgar: "Dónde" y "Añadir", lo
          último que se decide. */}
      <div className={styles.bar}>
        <div className={styles.destination}>
          <label htmlFor={destinationId}>Dónde</label>
          {/* <select> nativo (en iOS, su menú), con aspecto de campo y una
              flecha ▾ propia: que se vea que es un desplegable. */}
          <span className={styles.selectWrap}>
            <select
              id={destinationId}
              value={destination}
              onChange={(event) => setChosenDestination(event.target.value)}
            >
              {destinationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className={styles.chevron} aria-hidden="true">
              <ChevronDownIcon />
            </span>
          </span>
        </div>
        {containersGoingLoose.length > 0 && (
          <p className={styles.note}>
            {containersNote(containersGoingLoose, destinationName)}
          </p>
        )}
        <button
          type="button"
          className={buttons.primary}
          disabled={selected.size === 0 || isAdding}
          onClick={() => void add()}
        >
          {selected.size === 0
            ? 'Elige qué añadir'
            : destination === LOOSE
              ? `Añadir ${selected.size} a la maleta`
              : `Añadir ${selected.size} a ${destinationName}`}
        </button>
      </div>
    </section>
  )
}

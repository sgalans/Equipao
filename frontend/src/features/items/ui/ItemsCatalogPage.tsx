import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useMemo, useRef, useState } from 'react'
import { AddItemsDialog } from '@/features/luggage/ui/AddItemsDialog'
import { useRepositories } from '@/shared/di/repositories'
import { DuplicateError } from '@/shared/domain/errors'
import buttons from '@/shared/ui/buttons.module.css'
import page from '@/shared/ui/page.module.css'
import { useTemporaryHighlight } from '@/shared/ui/useTemporaryHighlight'
import { isSameItemName } from '../domain/itemName'
import { normalizeForSearch } from '../domain/search'
import { CatalogRow } from './CatalogRow'
import { CatalogSections } from './CatalogSections'
import { CreateChoice } from './CreateChoice'
import styles from './ItemsCatalogPage.module.css'

/**
 * Pantalla /items: todos los artículos, para crearlos, renombrarlos o
 * borrarlos. Un único campo "Buscar o crear" (decisión de producto): antes
 * de crear un artículo, lo natural es buscar si ya existe. Escribir FILTRA;
 * CREAR solo con el botón "+" (Intro no crea aquí, a diferencia de los
 * demás campos: así buscar nunca crea nada por accidente).
 */
export function ItemsCatalogPage() {
  const { items } = useRepositories()
  const catalog = useLiveQuery(() => items.listWithUsage(), [items])
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  // Artículo recién creado (o el que ya existía): se resalta un momento.
  const { highlightedId, highlight } = useTemporaryHighlight()
  // Modo selección para añadir varios a una maleta. La selección es un Set
  // de ids y se mantiene al buscar: se puede buscar "cepillo", marcarlo,
  // buscar "pasta", marcarla… y añadirlo todo junto.
  const [isSelecting, setIsSelecting] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [isChoosingDestination, setIsChoosingDestination] = useState(false)

  function toggleSelected(itemId: string) {
    // Inmutable: un Set NUEVO, para que React detecte el cambio.
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  function exitSelection() {
    setIsSelecting(false)
    setSelected(new Set())
  }

  const name = query.trim()

  // BUSCAR es permisivo ("calc" encuentra "Calcetines", sin tildes)…
  const visible = useMemo(() => {
    const needle = normalizeForSearch(query)
    if (!catalog || needle === '') return catalog ?? []
    return catalog.filter((item) =>
      normalizeForSearch(item.name).includes(needle),
    )
  }, [catalog, query])

  // …pero decidir si YA EXISTE es estricto: el mismo criterio que usa el
  // repositorio para impedir duplicados (isSameItemName).
  const exactMatch = useMemo(
    () => catalog?.find((item) => isSameItemName(item.name, name)),
    [catalog, name],
  )
  const canCreate = name !== '' && !exactMatch

  // Solo se llama desde CreateChoice, que solo aparece con un nombre NUEVO:
  // con uno que ya existe, la lista filtrada ya lo muestra.
  async function create(isContainer: boolean) {
    if (!canCreate) return
    setError(null)
    try {
      const item = await items.create({ name, isContainer })
      // Se vacía el campo (y con él el filtro), así el nuevo artículo se ve.
      setQuery('')
      setMessage(null)
      highlight(item.id)
    } catch (e) {
      // Otra pestaña pudo crearlo justo antes: el repositorio lo impide.
      if (e instanceof DuplicateError) {
        setMessage(`${e.message}.`)
      } else {
        console.error(e)
        setError('No se ha podido crear el artículo. Inténtalo de nuevo.')
      }
    } finally {
      inputRef.current?.focus()
    }
  }

  if (catalog === undefined) {
    return <p aria-busy="true">Cargando artículos…</p>
  }

  return (
    <section>
      <header className={page.header}>
        <h1 className={page.title}>Artículos</h1>
        {catalog.length > 0 && (
          <button
            type="button"
            className={buttons.headerAction}
            onClick={() => {
              if (isSelecting) exitSelection()
              else setIsSelecting(true)
            }}
          >
            {isSelecting ? 'Cancelar' : 'Seleccionar'}
          </button>
        )}
      </header>

      <form
        className={styles.field}
        // Intro no crea (decisión de producto): solo los botones de crear.
        onSubmit={(event) => event.preventDefault()}
      >
        <label htmlFor={inputId} className="visually-hidden">
          Buscar o crear artículos
        </label>
        <input
          ref={inputRef}
          id={inputId}
          // type="search": en iOS el campo trae su botón de borrar el texto.
          type="search"
          placeholder="Buscar o crear…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setMessage(null)
            setError(null)
          }}
          autoComplete="off"
          autoCorrect="off"
          maxLength={100}
        />
      </form>
      {/* Siempre visibles (atenuados sin un nombre nuevo): la lista no salta. */}
      <CreateChoice
        name={name}
        canCreate={canCreate}
        onCreateItem={() => void create(false)}
        onCreateCompartment={() => void create(true)}
        showHelp={!catalog.some((item) => item.isContainer)}
      />

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {/* role="status": se anuncia sin interrumpir. Hueco reservado para que
          la lista no "salte" al aparecer el mensaje. */}
      <p role="status" className={styles.message}>
        {message}
      </p>

      {catalog.length === 0 && name === '' ? (
        <p className={styles.empty}>
          Aún no tienes artículos. Escribe arriba para crear el primero, o
          añádelos directamente a una maleta.
        </p>
      ) : visible.length === 0 ? (
        name !== '' && (
          <p className={styles.empty}>Ningún artículo coincide con «{name}».</p>
        )
      ) : (
        <CatalogSections
          items={visible}
          renderRow={(item) => (
            <CatalogRow
              key={item.id}
              item={item}
              isHighlighted={highlightedId === item.id}
              selection={
                isSelecting
                  ? {
                      isSelected: selected.has(item.id),
                      onToggle: () => toggleSelected(item.id),
                    }
                  : undefined
              }
            />
          )}
        />
      )}

      {isSelecting && (
        // Barra fija abajo: el botón queda al alcance del pulgar aunque la
        // lista sea larga.
        <div className={styles.selectionBar}>
          <button
            type="button"
            className={buttons.primary}
            disabled={selected.size === 0}
            onClick={() => setIsChoosingDestination(true)}
          >
            {selected.size === 0
              ? 'Selecciona artículos'
              : `Añadir ${selected.size} a una maleta…`}
          </button>
        </div>
      )}

      <AddItemsDialog
        open={isChoosingDestination}
        itemIds={[...selected]}
        onCancel={() => setIsChoosingDestination(false)}
        onAdded={() => {
          setIsChoosingDestination(false)
          exitSelection()
        }}
      />
    </section>
  )
}

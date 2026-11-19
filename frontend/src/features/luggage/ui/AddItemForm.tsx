import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { useId, useMemo, useRef, useState } from 'react'
import { suggestItems } from '@/features/items/domain/search'
import { useRepositories } from '@/shared/di/repositories'
import { DuplicateError } from '@/shared/domain/errors'
import buttons from '@/shared/ui/buttons.module.css'
import { ListPlusIcon } from '@/shared/ui/icons/ListPlusIcon'
import { PlusIcon } from '@/shared/ui/icons/PlusIcon'
import { addItemByName } from '../application/addItemByName'
import type { LuggageEntry } from '../domain/itemQuantityRepository'
import styles from './AddItemForm.module.css'

interface AddItemFormProps {
  luggageId: string
  /** Líneas actuales: para no sugerir lo que ya está en la maleta. */
  entries: LuggageEntry[]
  /** Se llama si el artículo ya estaba: la página resalta su fila. */
  onDuplicate: (itemName: string) => void
  /** Dónde se añade: suelto en la maleta (null, por defecto) o un compartimento. */
  compartmentId?: string | null
  /** Texto del campo y del botón; por defecto "Añadir a la maleta". */
  label?: string
  /** Enfocar al aparecer (el "+" de un compartimento abre este formulario). */
  focusOnMount?: boolean
  /** Escape cierra el formulario (solo cuando se puede cerrar). */
  onClose?: () => void
  /**
   * Enlace a "Añadir más artículos del catálogo" (solo el campo principal de
   * la maleta): las dos formas de añadir quedan juntas.
   */
  catalogLink?: string
}

/**
 * "Añadir a la maleta…": escribir + OK, o tocar una sugerencia del catálogo.
 * Si el artículo no existe en el catálogo, se crea (addItemByName).
 */
export function AddItemForm({
  luggageId,
  entries,
  onDuplicate,
  compartmentId = null,
  label = 'Añadir a la maleta',
  focusOnMount = false,
  onClose,
  catalogLink,
}: AddItemFormProps) {
  const repositories = useRepositories()
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()

  const catalog = useLiveQuery(
    () => repositories.items.list(),
    [repositories.items],
  )

  // useMemo: solo se recalcula si cambia la búsqueda, el catálogo o la maleta,
  // no en cada render (p. ej. al cambiar `message`).
  const suggestions = useMemo(() => {
    const inLuggage = new Set(entries.map((entry) => entry.itemId))
    return suggestItems(catalog ?? [], query, inLuggage)
  }, [catalog, entries, query])

  async function add(name: string) {
    if (name.trim() === '' || isSaving) return
    setIsSaving(true)
    setMessage(null)
    try {
      await addItemByName(repositories, luggageId, name, compartmentId)
      setQuery('')
    } catch (error) {
      if (error instanceof DuplicateError) {
        // No es un fallo: el usuario ya lo tenía. Avisamos y resaltamos.
        setMessage(`«${name.trim()}» ya está en la maleta.`)
        setQuery('')
        onDuplicate(name)
      } else {
        console.error(error)
        setMessage('No se ha podido añadir. Inténtalo de nuevo.')
      }
    } finally {
      setIsSaving(false)
      // El foco vuelve al campo: el teclado del iPhone sigue abierto para
      // añadir el siguiente artículo sin tocar nada más.
      inputRef.current?.focus()
    }
  }

  return (
    <div className={styles.wrapper}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          void add(query)
        }}
      >
        <label htmlFor={inputId} className="visually-hidden">
          {label}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setMessage(null)
          }}
          placeholder={`${label}…`}
          autoComplete="off"
          // iOS: sin autocorrección (cambiaría "Neceser" por otra palabra) y
          // con la primera letra en mayúscula, como un nombre de lista.
          autoCorrect="off"
          autoCapitalize="sentences"
          maxLength={100}
          enterKeyHint="done"
          // Solo el formulario de un compartimento: aparece porque el usuario
          // acaba de tocar su "+", así que el foco (y el teclado) van a él.
          // eslint-disable-next-line jsx-a11y/no-autofocus -- el campo aparece porque el usuario lo acaba de pedir: mover ahí el foco es lo esperado (y abre el teclado en iOS)
          autoFocus={focusOnMount}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onClose?.()
          }}
        />
        <button
          type="submit"
          className={buttons.iconPrimary}
          aria-label={label}
          title={label}
          disabled={isSaving}
        >
          <PlusIcon />
        </button>
        {catalogLink && (
          // <Link> y no botón: lleva a otra pantalla. Solo icono en pantalla;
          // el texto completo es su nombre accesible y la ayuda del ratón.
          <Link
            to={catalogLink}
            className={buttons.icon}
            aria-label="Añadir más artículos del catálogo"
            title="Añadir más artículos del catálogo"
          >
            <ListPlusIcon />
          </Link>
        )}
      </form>

      {suggestions.length > 0 && (
        <ul
          className={styles.suggestions}
          aria-label="Sugerencias de tu catálogo"
        >
          {suggestions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={styles.suggestion}
                // Evita que tocar la sugerencia quite el foco al campo: así el
                // teclado del iPhone no se cierra entre artículo y artículo.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void add(item.name)}
                // aria-label explícito: un <span> oculto con "Añadir " perdía el
                // espacio al calcular el nombre accesible ("AñadirCámara").
                // Incluye el texto visible (regla WCAG "label in name").
                aria-label={`Añadir ${item.name}`}
              >
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* role="status": el lector de pantalla lo anuncia sin interrumpir. */}
      <p role="status" className={styles.message}>
        {message}
      </p>
    </div>
  )
}

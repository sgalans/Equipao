import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useRepositories } from '@/shared/di/repositories'
import buttons from '@/shared/ui/buttons.module.css'
import page from '@/shared/ui/page.module.css'
import { SelectField } from '@/shared/ui/SelectField'
import styles from './NewLuggagePage.module.css'

/** Valor de "Empezar con" para una maleta vacía (los <option> son strings). */
const EMPTY = ''

/**
 * Pantalla /luggages/new: crear una maleta (decisión del usuario: sustituye
 * al campo "Nueva maleta…" + "+" de "Mis maletas"). Es algo que se hace
 * pocas veces, así que prima que se entienda a la primera sobre la rapidez.
 *
 * - Nombre y descripción (opcional).
 * - "Empezar con": vacía o una copia de otra maleta (p. ej. la "Maleta
 *   básica"): lo que de verdad ahorra trabajo en cada viaje. Usa
 *   luggages.duplicate con el nombre y la descripción nuevos, en UNA
 *   transacción.
 * - Sin añadir artículos aquí: la maleta nueva se abre y su estado vacío ya
 *   lleva a "Añadir a la maleta" (un solo sitio para añadir).
 * - "Importar" también vive aquí: es otra forma de crear una maleta.
 */
export function NewLuggagePage() {
  const { luggages } = useRepositories()
  const navigate = useNavigate()
  const nameId = useId()
  const descriptionId = useId()
  const templateId = useId()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [template, setTemplate] = useState(EMPTY)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const luggageList = useLiveQuery(() => luggages.list(), [luggages])
  const canCreate = name.trim() !== '' && !isCreating

  async function create(event: FormEvent) {
    // Intro en el nombre también crea (atajo), igual que el botón.
    event.preventDefault()
    if (!canCreate) return
    setIsCreating(true)
    setError(null)
    try {
      const changes = { name, description: description.trim() }
      // La descripción es la que se escribe aquí (vacía = ninguna): la de la
      // plantilla ("Plantilla base: duplícala…") no tiene sentido en un viaje.
      const luggage =
        template === EMPTY
          ? await luggages.create(changes)
          : await luggages.duplicate(template, changes)
      // replace: "‹" desde la maleta nueva vuelve a "Mis maletas", no a este
      // formulario ya usado.
      navigate(`/luggages/${luggage.id}`, { replace: true })
    } catch (e) {
      // Fallo con un sitio natural (el formulario): el mensaje va aquí.
      console.error(e)
      setError('No se ha podido crear la maleta. Inténtalo de nuevo.')
      setIsCreating(false)
    }
  }

  return (
    <section>
      <header className={page.header}>
        <h1 className={page.title}>Nueva maleta</h1>
      </header>

      <form className={styles.form} onSubmit={(event) => void create(event)}>
        <div className={styles.field}>
          <label htmlFor={nameId}>Nombre</label>
          <input
            id={nameId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Mallorca, finde en la montaña…"
            maxLength={100}
            autoComplete="off"
            // Teclado de iOS: primera letra en mayúscula.
            autoCapitalize="sentences"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor={descriptionId}>
            Descripción <span className={styles.optional}>(opcional)</span>
          </label>
          <textarea
            id={descriptionId}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Notas: destino, clima, recordatorios…"
            maxLength={500}
            rows={3}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor={templateId}>Empezar con</label>
          {/* Mismo desplegable que "Dónde" en "Añadir a la maleta". */}
          <SelectField id={templateId} value={template} onChange={setTemplate}>
            <option value={EMPTY}>Vacía</option>
            {luggageList?.map((luggage) => (
              <option key={luggage.id} value={luggage.id}>
                Copia de «{luggage.name}»
              </option>
            ))}
          </SelectField>
          {template !== EMPTY && (
            <p className={styles.hint}>
              Con sus artículos y compartimentos, sin nada marcado como listo.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}

        <button type="submit" className={buttons.primary} disabled={!canCreate}>
          Crear maleta
        </button>
      </form>

      {/* Otra forma de crear una maleta: desde una lista en texto (p. ej.
          la que alguien ha compartido por WhatsApp). */}
      <p className={styles.import}>
        ¿Tienes una lista en texto? <Link to="/import">Impórtala</Link>
      </p>
    </section>
  )
}

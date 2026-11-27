import { useId, useState } from 'react'
import { useNavigate } from 'react-router'
import { useRepositories } from '@/shared/di/repositories'
import buttons from '@/shared/ui/buttons.module.css'
import {
  reportError,
  useNotifications,
} from '@/shared/ui/notifications/notificationStore'
import page from '@/shared/ui/page.module.css'
import {
  IMPORTED_LUGGAGE_NAME,
  importLuggage,
} from '../application/importLuggage'
import { isEmptyLuggageText, parseLuggageText } from '../domain/luggageText'
import { articles } from './addedSummary'
import styles from './ImportLuggagePage.module.css'

/** "1 compartimento" / "2 compartimentos". */
const compartmentsLabel = (n: number) =>
  n === 1 ? '1 compartimento' : `${n} compartimentos`

/**
 * Pantalla /import: crear una maleta pegando un texto (el que genera
 * "Compartir" o una lista cualquiera, una cosa por línea). Vista previa
 * ANTES de crear nada; siempre crea una maleta NUEVA (nunca pisa nada).
 */
export function ImportLuggagePage() {
  const repositories = useRepositories()
  const navigate = useNavigate()
  const show = useNotifications((state) => state.show)
  const textId = useId()
  const previewId = useId()
  const [text, setText] = useState('')
  const [isImporting, setIsImporting] = useState(false)

  // Se interpreta en cada render: es una función pura y barata, y así la
  // vista previa siempre corresponde a lo que hay escrito.
  const parsed = parseLuggageText(text)
  const isEmpty = isEmptyLuggageText(parsed)
  const itemCount =
    parsed.loose.length +
    parsed.compartments.reduce((sum, c) => sum + c.items.length, 0)

  async function create() {
    setIsImporting(true)
    try {
      const luggage = await importLuggage(repositories, parsed)
      show(`Maleta «${luggage.name}» importada.`)
      // replace: "atrás" desde la maleta no vuelve a esta pantalla.
      await navigate(`/luggages/${luggage.id}`, { replace: true })
    } catch (error) {
      reportError(error)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <section>
      <header className={page.header}>
        <h1 className={page.title}>Importar maleta</h1>
      </header>

      <label htmlFor={textId} className={styles.label}>
        Pega aquí la lista
      </label>
      <textarea
        id={textId}
        className={styles.textarea}
        value={text}
        onChange={(event) => setText(event.target.value)}
        aria-describedby={previewId}
        rows={10}
        autoComplete="off"
        autoCorrect="off"
        placeholder={
          '🧳 Mallorca\n\n- Camisetas ×3\n- Bañador\n\nNeceser:\n- Cepillo de dientes'
        }
      />
      <p className={styles.help}>
        Vale el texto de «Compartir» o cualquier lista, una cosa por línea.
      </p>

      {/* role="status": la vista previa se anuncia al cambiar, sin
          interrumpir. Hueco reservado: el botón no salta. */}
      <p id={previewId} role="status" className={styles.preview}>
        {!isEmpty &&
          `Se creará «${parsed.name ?? IMPORTED_LUGGAGE_NAME}»: ${articles(itemCount)}` +
            (parsed.compartments.length > 0
              ? `, ${compartmentsLabel(parsed.compartments.length)}`
              : '') +
            '.'}
      </p>

      <button
        type="button"
        className={buttons.primary}
        disabled={isEmpty || isImporting}
        onClick={() => void create()}
      >
        Crear maleta
      </button>
    </section>
  )
}

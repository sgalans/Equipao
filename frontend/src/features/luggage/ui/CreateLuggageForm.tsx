import { useId, useState } from 'react'
import { useRepositories } from '@/shared/di/repositories'
import buttons from '@/shared/ui/buttons.module.css'
import { PlusIcon } from '@/shared/ui/icons/PlusIcon'
import styles from './CreateLuggageForm.module.css'

/**
 * Crear una maleta "en línea": escribir el nombre y pulsar Enter (o "+").
 *
 * Sin React Hook Form a propósito: es UN campo cuya única regla es "no
 * vacío", y un useState basta. RHF compensa con varios campos, reglas
 * cruzadas y errores por campo.
 */
export function CreateLuggageForm() {
  const { luggages } = useRepositories()
  const [name, setName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Evita el comportamiento por defecto del <form>: recargar la página.
    event.preventDefault()
    // Enter con el campo vacío simplemente no hace nada: en un alta rápida,
    // un mensaje de error ahí sería ruido.
    if (name.trim() === '' || isSaving) return

    setIsSaving(true)
    setError(null)
    try {
      await luggages.create({ name })
      // Se limpia y el foco sigue en el campo: se pueden crear varias
      // maletas seguidas sin tocar nada más.
      setName('')
    } catch (e) {
      console.error(e)
      setError('No se ha podido crear la maleta. Inténtalo de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
      <label htmlFor={inputId} className="visually-hidden">
        Nombre de la nueva maleta
      </label>
      <input
        id={inputId}
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Nueva maleta…"
        autoComplete="off"
        maxLength={100}
        // enterKeyHint: cambia la etiqueta de la tecla Intro del teclado
        // del móvil ("done" → "OK" en iOS): indica que Intro confirma.
        enterKeyHint="done"
      />
      <button
        type="submit"
        className={buttons.iconPrimary}
        aria-label="Crear maleta"
        title="Crear maleta"
        disabled={isSaving}
      >
        <PlusIcon />
      </button>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </form>
  )
}

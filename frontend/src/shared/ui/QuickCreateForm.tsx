import { useId, useState } from 'react'
import buttons from './buttons.module.css'
import { PlusIcon } from './icons/PlusIcon'
import styles from './QuickCreateForm.module.css'

interface QuickCreateFormProps {
  /** Etiqueta accesible del campo (oculta a la vista). */
  label: string
  placeholder: string
  /** Nombre accesible del botón "+". */
  submitLabel: string
  /** Mensaje si la creación falla de forma inesperada. */
  errorMessage: string
  /** Crea con el nombre escrito; si lanza, se muestra errorMessage. */
  onCreate: (name: string) => Promise<void>
}

/**
 * Alta rápida "en línea": escribir + Intro (o "+"). El campo se vacía y
 * MANTIENE el foco, así se pueden crear varios seguidos sin tocar nada más
 * (en el iPhone, el teclado no se cierra). Hoy lo usa "Mis maletas"; es
 * genérico (etiquetas y acción por props) para cualquier alta rápida.
 *
 * Sin React Hook Form a propósito: un solo campo cuya única regla es "no
 * vacío" no lo necesita.
 */
export function QuickCreateForm({
  label,
  placeholder,
  submitLabel,
  errorMessage,
  onCreate,
}: QuickCreateFormProps) {
  const [name, setName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Evita el comportamiento por defecto del <form>: recargar la página.
    event.preventDefault()
    // Intro con el campo vacío no hace nada: en un alta rápida, un mensaje
    // de error ahí sería ruido.
    if (name.trim() === '' || isSaving) return

    setIsSaving(true)
    setError(null)
    try {
      await onCreate(name)
      setName('')
    } catch (e) {
      console.error(e)
      setError(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
      <label htmlFor={inputId} className="visually-hidden">
        {label}
      </label>
      <input
        id={inputId}
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        maxLength={100}
        // enterKeyHint: la tecla Intro del teclado del móvil dice "OK".
        enterKeyHint="done"
      />
      <button
        type="submit"
        className={buttons.iconPrimary}
        aria-label={submitLabel}
        title={submitLabel}
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

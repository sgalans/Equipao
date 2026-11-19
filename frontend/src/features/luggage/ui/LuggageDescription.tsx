import { useState } from 'react'
import buttons from '@/shared/ui/buttons.module.css'
import { PencilIcon } from '@/shared/ui/icons/PencilIcon'
import { InlineEditInput } from '@/shared/ui/InlineEditInput'
import { reportError } from '@/shared/ui/notifications/notificationStore'
import styles from './LuggageDescription.module.css'

const MAX_LENGTH = 500

interface LuggageDescriptionProps {
  value: string
  onSave: (description: string) => Promise<void>
}

/**
 * Descripción de la maleta bajo el título, editable en el sitio (como el
 * título): tocar el texto o "Editar descripción" → campo de varias líneas →
 * salir del campo guarda, Escape cancela. Vacía → "Añadir descripción".
 */
export function LuggageDescription({ value, onSave }: LuggageDescriptionProps) {
  const [isEditing, setIsEditing] = useState(false)

  async function handleFinish(next: string | null) {
    setIsEditing(false)
    // Cancelado o sin cambios: nada que guardar. Un texto vacío SÍ se
    // guarda: es la forma de borrar la descripción.
    if (next === null || next === value) return
    try {
      await onSave(next)
    } catch (error) {
      reportError(error)
    }
  }

  if (isEditing) {
    return (
      <InlineEditInput
        className={styles.textarea}
        multiline
        maxLength={MAX_LENGTH}
        initialValue={value}
        ariaLabel="Descripción de la maleta"
        placeholder="Notas: destino, clima, recordatorios…"
        onFinish={(next) => void handleFinish(next)}
      />
    )
  }

  if (value === '') {
    return (
      <button
        type="button"
        className={`${buttons.textAction} ${styles.add}`}
        onClick={() => setIsEditing(true)}
      >
        <PencilIcon />
        Añadir descripción
      </button>
    )
  }

  return (
    <div className={styles.view}>
      {/* Igual que el título: tocar el texto es un atajo táctil y el botón
          del lápiz es la vía accesible (teclado, lector de pantalla). */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- atajo táctil; el botón del lápiz es la alternativa accesible */}
      <p className={styles.text} onClick={() => setIsEditing(true)}>
        {value}
      </p>
      <button
        type="button"
        className={buttons.iconGhost}
        aria-label="Editar descripción"
        title="Editar descripción"
        onClick={() => setIsEditing(true)}
      >
        <PencilIcon />
      </button>
    </div>
  )
}

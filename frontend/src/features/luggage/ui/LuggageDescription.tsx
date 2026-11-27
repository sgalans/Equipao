import { useId, useState } from 'react'
import buttons from '@/shared/ui/buttons.module.css'
import { PencilIcon } from '@/shared/ui/icons/PencilIcon'
import { InlineEditInput } from '@/shared/ui/InlineEditInput'
import { reportError } from '@/shared/ui/notifications/notificationStore'
import { DESCRIPTION_MAX_LENGTH } from '../domain/luggage'
import { useExpandedDescriptions } from './expandedDescriptionsStore'
import { isLongDescription } from './descriptionLength'
import styles from './LuggageDescription.module.css'

interface LuggageDescriptionProps {
  /** Para recordar si el usuario la abrió ("Ver más"). */
  luggageId: string
  value: string
  onSave: (description: string) => Promise<void>
}

/**
 * Descripción de la maleta bajo el título, editable en el sitio (como el
 * título): tocar el texto o "Editar descripción" → campo de varias líneas →
 * salir del campo guarda, Escape cancela. Vacía → "Añadir descripción".
 *
 * Larga (decisión del usuario): PLEGADA por defecto a 3 líneas, con "Ver
 * más" al final (no quita sitio a la lista hasta que se abre); abrirla se
 * recuerda en esa maleta (expandedDescriptionsStore) y entonces muestra
 * "Ver menos". En "Maleta básica", la primera línea ("Instrucciones…,
 * ábreme") ya invita a abrirla.
 */
export function LuggageDescription({
  luggageId,
  value,
  onSave,
}: LuggageDescriptionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const textId = useId()
  // Plegada por defecto: solo se ve entera si el usuario la abrió.
  const isCollapsed = !useExpandedDescriptions(
    (state) => state.expanded[luggageId] === true,
  )
  const toggleCollapsed = useExpandedDescriptions((state) => state.toggle)
  const isLong = isLongDescription(value)

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
        maxLength={DESCRIPTION_MAX_LENGTH}
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
      <div className={styles.body}>
        {/* Igual que el título: tocar el texto es un atajo táctil y el botón
            del lápiz es la vía accesible (teclado, lector de pantalla). */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- atajo táctil; el botón del lápiz es la alternativa accesible */}
        <p
          id={textId}
          className={
            isLong && isCollapsed
              ? `${styles.text} ${styles.collapsed}`
              : styles.text
          }
          onClick={() => setIsEditing(true)}
        >
          {value}
        </p>
        {isLong && (
          // aria-expanded: VoiceOver dice "Ver más, contraído". No cambia el
          // texto del botón según el estado de nada más: solo de este.
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={!isCollapsed}
            aria-controls={textId}
            onClick={() => toggleCollapsed(luggageId)}
          >
            {isCollapsed ? 'Ver más' : 'Ver menos'}
          </button>
        )}
      </div>
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

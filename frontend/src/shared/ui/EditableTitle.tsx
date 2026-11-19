import { useState } from 'react'
import buttons from './buttons.module.css'
import styles from './EditableTitle.module.css'
import { PencilIcon } from './icons/PencilIcon'
import { InlineEditInput } from './InlineEditInput'
import { reportError } from './notifications/notificationStore'
import page from './page.module.css'

interface EditableTitleProps {
  value: string
  /** Recibe el nuevo valor ya recortado; solo se llama si ha cambiado. */
  onSave: (value: string) => Promise<void>
  /** Texto accesible de la acción, p. ej. "Renombrar maleta". */
  editLabel: string
}

/**
 * Título <h1> que se edita en el sitio ("inline editing"): sin pantalla de
 * edición aparte, menos clics.
 *
 * - Tocar el título o el lápiz → se convierte en un campo de texto.
 * - Enter o salir del campo (blur) → guarda. Escape → cancela.
 * - Vacío o sin cambios → no guarda nada (se vuelve al valor anterior).
 *
 * Accesibilidad: el <h1> conserva su nombre ("Mochila Japón") y la acción
 * de editar es un <button> real con aria-label, alcanzable con teclado.
 */
export function EditableTitle({
  value,
  onSave,
  editLabel,
}: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false)

  async function handleFinish(next: string | null) {
    setIsEditing(false)
    // Cancelado (null), vacío o sin cambios → no se guarda nada.
    if (next === null || next === '' || next === value) return
    try {
      await onSave(next)
    } catch (error) {
      // Si falla, el título sigue mostrando el valor guardado (la verdad de
      // la base de datos) y se avisa al usuario.
      reportError(error)
    }
  }

  if (isEditing) {
    return (
      <InlineEditInput
        className={styles.input}
        initialValue={value}
        ariaLabel={editLabel}
        onFinish={(next) => void handleFinish(next)}
      />
    )
  }

  return (
    <div className={styles.view}>
      {/* El clic en el texto es un atajo para ratón/dedo; la vía accesible
          (teclado, lector de pantalla) es el botón del lápiz. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- atajo táctil; el botón del lápiz es la alternativa accesible */}
      <h1
        className={`${page.title} ${styles.title}`}
        onClick={() => setIsEditing(true)}
      >
        {value}
      </h1>
      <button
        type="button"
        className={buttons.iconGhost}
        aria-label={editLabel}
        title={editLabel}
        onClick={() => setIsEditing(true)}
      >
        <PencilIcon />
      </button>
    </div>
  )
}

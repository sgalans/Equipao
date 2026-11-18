import { useRef, useState } from 'react'
import buttons from './buttons.module.css'
import styles from './EditableTitle.module.css'
import { PencilIcon } from './icons/PencilIcon'
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
  const [draft, setDraft] = useState(value)
  // Enter y Escape quitan el campo de la pantalla y, en algunos navegadores,
  // eso dispara también un blur. Este flag evita terminar dos veces (p. ej.
  // cancelar con Escape y que el blur posterior guarde igualmente).
  const isFinishingRef = useRef(false)

  function startEditing() {
    setDraft(value)
    isFinishingRef.current = false
    setIsEditing(true)
  }

  async function finish(save: boolean) {
    if (isFinishingRef.current) return
    isFinishingRef.current = true
    setIsEditing(false)

    const next = draft.trim()
    if (!save || next === '' || next === value) return
    try {
      await onSave(next)
    } catch (error) {
      // Si falla, el título sigue mostrando el valor guardado (la verdad de
      // la base de datos); lo registramos para depurar.
      console.error(error)
    }
  }

  if (isEditing) {
    return (
      <input
        className={styles.input}
        aria-label={editLabel}
        value={draft}
        maxLength={100}
        // autoFocus aquí es correcto: el campo aparece porque el usuario
        // acaba de pedir editar, así que el foco debe ir a él.
        autoFocus
        // Seleccionar todo: lo habitual al renombrar es reescribir el nombre.
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void finish(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void finish(true)
          } else if (event.key === 'Escape') {
            void finish(false)
          }
        }}
      />
    )
  }

  return (
    <div className={styles.view}>
      {/* El clic en el texto es un atajo para ratón/dedo; la vía accesible
          (teclado, lector de pantalla) es el botón del lápiz. */}
      <h1 className={`${page.title} ${styles.title}`} onClick={startEditing}>
        {value}
      </h1>
      <button
        type="button"
        className={buttons.iconGhost}
        aria-label={editLabel}
        title={editLabel}
        onClick={startEditing}
      >
        <PencilIcon />
      </button>
    </div>
  )
}

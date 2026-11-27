import { useLayoutEffect, useRef, useState } from 'react'
import buttons from './buttons.module.css'
import styles from './InlineEditInput.module.css'

interface InlineEditInputProps {
  initialValue?: string
  /** Nombre accesible del campo (p. ej. "Renombrar maleta"). */
  ariaLabel: string
  placeholder?: string
  className?: string
  /** Límite de caracteres (por defecto el de los nombres: 100). */
  maxLength?: number
  /**
   * Varias líneas (<textarea>): Intro hace salto de línea en vez de
   * confirmar. Lleva "Cancelar" y "Guardar" DEBAJO del campo y el campo
   * crece con el texto (ver el componente). Salir del campo también guarda.
   */
  multiline?: boolean
  /**
   * Se llama UNA sola vez al terminar:
   * - con el texto recortado si se confirma (Intro —salvo multiline— o
   *   salir del campo),
   * - con null si se cancela (Escape).
   * Quien lo usa decide qué hacer con un texto vacío o sin cambios.
   */
  onFinish: (value: string | null) => void
}

/**
 * Campo de texto para editar "en el sitio" (inline editing). Lo comparten
 * el título y la descripción de la maleta, los compartimentos (crear y
 * renombrar) y el catálogo.
 */
export function InlineEditInput({
  initialValue = '',
  ariaLabel,
  placeholder,
  className,
  maxLength = 100,
  multiline = false,
  onFinish,
}: InlineEditInputProps) {
  const [draft, setDraft] = useState(initialValue)
  // Enter y Escape hacen que el padre quite este campo de la pantalla y, en
  // algunos navegadores, eso dispara también un blur. Este flag evita
  // terminar dos veces (p. ej. cancelar con Escape y que el blur guarde).
  // jsdom no reproduce ese blur: lo cubrirían los tests E2E.
  const isFinishedRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Varias líneas: el campo CRECE con el texto (decisión del usuario: con
  // una descripción larga, editar en una ventanita de 3 líneas era muy
  // incómodo). Se ajusta la altura a la del contenido en cada cambio, antes
  // de pintar (useLayoutEffect: sin un parpadeo con la altura vieja). La
  // propiedad CSS `field-sizing: content` lo haría sola, pero Safari aún no
  // la admite. jsdom no mide alturas: esto se comprueba en el iPhone.
  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [draft])

  function finish(value: string | null) {
    if (isFinishedRef.current) return
    isFinishedRef.current = true
    onFinish(value)
  }

  // Props comunes a <input> y <textarea>: una sola definición del
  // comportamiento, dos elementos posibles.
  const shared = {
    className,
    'aria-label': ariaLabel,
    placeholder,
    value: draft,
    maxLength,
    autoComplete: 'off',
    autoCorrect: 'off',
    onBlur: () => finish(draft.trim()),
  } as const

  if (multiline) {
    /** Que tocar el botón NO quite el foco al campo: si lo quitara, el blur
     * guardaría ANTES de que "Cancelar" pudiera cancelar. */
    const keepFocus = (event: React.MouseEvent) => event.preventDefault()
    return (
      <div className={styles.multiline}>
        <textarea
          ref={textareaRef}
          {...shared}
          // autoFocus explícito (no dentro de `shared`) para que el lint de
          // accesibilidad lo VEA y la excepción quede justificada aquí.
          // eslint-disable-next-line jsx-a11y/no-autofocus -- el campo aparece porque el usuario acaba de pedir editar
          autoFocus
          rows={3}
          // Para una descripción, el cursor al final (seguir escribiendo) es
          // más útil que seleccionar todo el texto.
          onFocus={(event) => {
            const end = event.currentTarget.value.length
            event.currentTarget.setSelectionRange(end, end)
          }}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Intro = salto de línea (comportamiento normal del textarea).
            if (event.key === 'Escape') finish(null)
          }}
        />
        {/* DEBAJO del campo (decisión del usuario): lo último que se
            escribe queda abajo, junto al cursor, e iOS desplaza la página
            para que el cursor se vea. Cancelar a la izquierda y Guardar a
            la derecha. En iOS no hay Escape: sin "Cancelar" no se podría
            cancelar. */}
        <div className={styles.actions}>
          <button
            type="button"
            className={buttons.headerAction}
            onMouseDown={keepFocus}
            onClick={() => finish(null)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={`${buttons.headerAction} ${styles.save}`}
            onMouseDown={keepFocus}
            onClick={() => finish(draft.trim())}
          >
            Guardar
          </button>
        </div>
      </div>
    )
  }

  return (
    <input
      {...shared}
      // eslint-disable-next-line jsx-a11y/no-autofocus -- el campo aparece porque el usuario acaba de pedir editar
      autoFocus
      enterKeyHint="done"
      // Seleccionar todo: lo habitual al renombrar es reescribir el nombre.
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          finish(draft.trim())
        } else if (event.key === 'Escape') {
          finish(null)
        }
      }}
    />
  )
}

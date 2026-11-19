import { useRef, useState } from 'react'

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
   * confirmar; se confirma saliendo del campo (en iOS, el "OK" del teclado).
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
    return (
      <textarea
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

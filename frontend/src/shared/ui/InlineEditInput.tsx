import { useRef, useState } from 'react'

interface InlineEditInputProps {
  initialValue?: string
  /** Nombre accesible del campo (p. ej. "Renombrar maleta"). */
  ariaLabel: string
  placeholder?: string
  className?: string
  /**
   * Se llama UNA sola vez al terminar:
   * - con el texto recortado si se confirma (Enter o salir del campo),
   * - con null si se cancela (Escape).
   * Quien lo usa decide qué hacer con un texto vacío o sin cambios.
   */
  onFinish: (value: string | null) => void
}

/**
 * Campo de texto para editar "en el sitio" (inline editing). Lo comparten
 * el título de la maleta y los compartimentos (crear y renombrar).
 */
export function InlineEditInput({
  initialValue = '',
  ariaLabel,
  placeholder,
  className,
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

  return (
    <input
      className={className}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={draft}
      maxLength={100}
      autoComplete="off"
      autoCorrect="off"
      enterKeyHint="done"
      // autoFocus aquí es correcto: el campo aparece porque el usuario
      // acaba de pedir editar, así que el foco debe ir a él.
      // eslint-disable-next-line jsx-a11y/no-autofocus -- el campo aparece porque el usuario acaba de pedir editar
      autoFocus
      // Seleccionar todo: lo habitual al renombrar es reescribir el nombre.
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => finish(draft.trim())}
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

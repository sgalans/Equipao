import { useEffect, useId, useRef, useState } from 'react'
import buttons from './buttons.module.css'
import styles from './CopyTextDialog.module.css'
import dialogStyles from './ConfirmDialog.module.css'

interface CopyTextDialogProps {
  /** Texto a copiar; null = cerrado. */
  text: string | null
  onClose: () => void
  /** Tras copiar con "Copiar todo" (la ventana ya no hace falta). */
  onCopied: () => void
}

/**
 * Copia TODO el texto de un <textarea> con document.execCommand('copy').
 *
 * Es la API ANTIGUA (obsoleta, sustituida por navigator.clipboard), pero
 * funciona también SIN HTTPS y Safari de iOS la sigue soportando: es el
 * "polyfill" clásico de copiar. Debe llamarse dentro del toque del usuario.
 * - setSelectionRange (y no select()): en iOS, select() no siempre
 *   selecciona el texto entero.
 * - readOnly se quita un instante: iOS no deja seleccionar por código en un
 *   campo de solo lectura.
 */
function copyAll(textarea: HTMLTextAreaElement): boolean {
  if (typeof document.execCommand !== 'function') return false
  textarea.readOnly = false
  textarea.focus()
  textarea.setSelectionRange(0, textarea.value.length)
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    textarea.readOnly = true
    textarea.blur()
  }
}

/**
 * Último recurso de "Compartir" (ver shareText → 'manual'): cuando no hay
 * hoja nativa ni portapapeles (p. ej. por HTTP en el iPhone), se muestra el
 * texto con un botón "Copiar todo". Sin selección previa (decisión del
 * usuario: en iOS quedaba seleccionado solo a medias). Sobre el <dialog>
 * nativo, como ConfirmDialog (fondo, foco, Escape).
 */
export function CopyTextDialog({
  text,
  onClose,
  onCopied,
}: CopyTextDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const titleId = useId()
  const [copyFailed, setCopyFailed] = useState(false)
  const open = text !== null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setCopyFailed(false)
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  function handleCopy() {
    if (textRef.current && copyAll(textRef.current)) onCopied()
    else setCopyFailed(true)
  }

  return (
    <dialog
      ref={dialogRef}
      className={dialogStyles.dialog}
      aria-labelledby={titleId}
      onClose={onClose}
    >
      <h2 id={titleId} className={dialogStyles.title}>
        Copia la lista
      </h2>
      <textarea
        ref={textRef}
        className={styles.text}
        // readOnly: se puede seleccionar y copiar, pero no se edita por error.
        readOnly
        value={text ?? ''}
        rows={8}
        aria-label="Lista para copiar"
      />
      {copyFailed && (
        <p role="alert" className={dialogStyles.error}>
          No se ha podido copiar. Mantén pulsado el texto y elige «Copiar».
        </p>
      )}
      <div className={dialogStyles.actions}>
        <button type="button" className={buttons.secondary} onClick={onClose}>
          Cerrar
        </button>
        <button type="button" className={buttons.primary} onClick={handleCopy}>
          Copiar todo
        </button>
      </div>
    </dialog>
  )
}

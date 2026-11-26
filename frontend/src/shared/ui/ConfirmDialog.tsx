import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import buttons from './buttons.module.css'
import styles from './ConfirmDialog.module.css'

interface ConfirmDialogProps {
  open: boolean
  title: string
  /** Explicación de las consecuencias (p. ej. qué más se va a borrar). */
  children: ReactNode
  confirmLabel: string
  /** 'danger' (rojo, por defecto) para borrar; 'primary' (azul) para el resto. */
  confirmVariant?: 'danger' | 'primary'
  /** Desactiva "confirmar" (p. ej. si falta elegir algo en el diálogo). */
  confirmDisabled?: boolean
  onConfirm: () => Promise<void>
  /** Cancelar, pulsar Escape o cerrar el diálogo de cualquier otra forma. */
  onCancel: () => void
}

/**
 * Diálogo de confirmación modal sobre el <dialog> nativo de HTML.
 *
 * showModal() nos da gratis lo difícil de hacer a mano: fondo que bloquea la
 * página, foco atrapado dentro del diálogo, cierre con Escape y el rol
 * accesible "dialog". Es un componente controlado: el padre decide si está
 * abierto con `open`, y aquí sincronizamos esa prop con la API imperativa
 * del DOM (showModal/close) en un efecto.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  confirmVariant = 'danger',
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // Foco inicial EXPLÍCITO en "Cancelar": showModal() enfoca el primer
      // elemento enfocable, y si es un <select> (p. ej. "Dónde"), iOS abre
      // su rueda nada más abrirse el diálogo. (Se hace aquí y no con
      // autoFocus: la regla jsx-a11y/no-autofocus lo prohíbe en general.)
      cancelRef.current?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  async function handleConfirm() {
    setIsBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (e) {
      console.error(e)
      setError('No se ha podido completar la acción. Inténtalo de nuevo.')
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      // `close` lo dispara el navegador al pulsar Escape o al cerrar el
      // diálogo por cualquier vía: lo tratamos como cancelar.
      onClose={onCancel}
    >
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      <div className={styles.body}>{children}</div>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      <div className={styles.actions}>
        {/* "Cancelar" va PRIMERO y con el foco inicial: un Enter accidental
            cancela en lugar de borrar (default seguro en acciones
            destructivas). */}
        <button
          type="button"
          className={buttons.secondary}
          onClick={onCancel}
          ref={cancelRef}
        >
          Cancelar
        </button>
        <button
          type="button"
          className={buttons[confirmVariant]}
          onClick={() => void handleConfirm()}
          disabled={isBusy || confirmDisabled}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}

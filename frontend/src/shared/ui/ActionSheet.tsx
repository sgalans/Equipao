import { useEffect, useId, useRef, type ReactNode } from 'react'
import styles from './ActionSheet.module.css'

export interface SheetAction {
  label: string
  icon?: ReactNode
  /** 'danger' (rojo) para lo destructivo, como "Borrar maleta". */
  variant?: 'danger'
  onSelect: () => void
}

interface ActionSheetProps {
  open: boolean
  /** Sobre qué se actúa (p. ej. el nombre de la maleta). */
  title: string
  actions: SheetAction[]
  /** "Cerrar", tocar fuera, Escape o cualquier otro cierre. */
  onClose: () => void
}

/**
 * Hoja de acciones (como las de iOS): sube desde abajo ENCIMA de la página,
 * así nada de debajo se mueve, con zonas táctiles grandes y "Cerrar" al
 * final. También se cierra tocando fuera (en el fondo oscuro). Sobre el
 * <dialog> nativo, como ConfirmDialog: showModal() da el fondo, el foco
 * atrapado y el cierre con Escape.
 *
 * Al elegir una acción, la hoja se cierra y DESPUÉS se ejecuta la acción
 * (que puede abrir otro diálogo, p. ej. la confirmación de borrar).
 */
export function ActionSheet({
  open,
  title,
  actions,
  onClose,
}: ActionSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    // Tocar fuera es solo un atajo táctil: con teclado ya se cierra con
    // Escape (nativo del <dialog>) y con el botón "Cerrar".
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      className={styles.sheet}
      aria-labelledby={titleId}
      onClose={onClose}
      // Tocar fuera = cerrar. Un toque en el fondo (::backdrop) llega como
      // clic sobre el PROPIO <dialog>; el contenido va en un <div> que lo
      // llena entero, así un toque dentro tiene otro target. (El atributo
      // `closedby="any"` lo haría solo, pero Safari aún no lo admite.)
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className={styles.content}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <ul className={styles.actions}>
          {actions.map((action) => (
            <li key={action.label}>
              <button
                type="button"
                className={
                  action.variant === 'danger'
                    ? `${styles.action} ${styles.danger}`
                    : styles.action
                }
                onClick={() => {
                  onClose()
                  action.onSelect()
                }}
              >
                {action.icon && (
                  <span className={styles.icon} aria-hidden="true">
                    {action.icon}
                  </span>
                )}
                {action.label}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className={styles.cancel} onClick={onClose}>
          Cerrar
        </button>
      </div>
    </dialog>
  )
}

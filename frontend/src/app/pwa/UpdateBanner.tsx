import buttons from '@/shared/ui/buttons.module.css'
import styles from './UpdateBanner.module.css'

interface UpdateBannerProps {
  message: string
  actionLabel: string
  onAction: () => void
  /** Si se puede posponer ("Luego"); sin él, el aviso no se puede cerrar. */
  onDismiss?: () => void
}

/**
 * Aviso fijo abajo para actualizaciones. A diferencia del aviso de errores
 * (Toaster), NO desaparece solo: hay que decidir (decisión de producto: la
 * app nunca se recarga sola mientras se está empaquetando).
 */
export function UpdateBanner({
  message,
  actionLabel,
  onAction,
  onDismiss,
}: UpdateBannerProps) {
  return (
    // role="status": el lector de pantalla lo anuncia sin interrumpir.
    <div role="status" className={styles.banner}>
      <span className={styles.message}>{message}</span>
      <div className={styles.actions}>
        {onDismiss && (
          <button type="button" className={styles.later} onClick={onDismiss}>
            Luego
          </button>
        )}
        <button type="button" className={buttons.primary} onClick={onAction}>
          {actionLabel}
        </button>
      </div>
    </div>
  )
}

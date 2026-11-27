import styles from './PackingProgress.module.css'
import { progressLabel } from './progressLabel'

interface PackingProgressProps {
  done: number
  total: number
  /**
   * - 'full' (detalle): texto + barra con role="progressbar".
   * - 'compact' (tarjeta del inicio): más pequeño; la barra es decorativa
   *   porque el texto ya forma parte del nombre accesible del enlace.
   */
  variant?: 'full' | 'compact'
  /**
   * Si se pasa, el texto ("3 de 5 listos ›") es un botón que abre la
   * ventana "Listos" (decisión de producto: tocas "listos" y ves cuáles).
   */
  onOpenDone?: () => void
}

/** "3 de 5 listos" + barra. Todo derivado de los datos: nada se guarda. */
export function PackingProgress({
  done,
  total,
  variant = 'full',
  onOpenDone,
}: PackingProgressProps) {
  const isCompact = variant === 'compact'
  // En el detalle, una maleta vacía ya lo dice la propia lista.
  if (total === 0 && !isCompact) return null

  const label = progressLabel(done, total)
  const isDone = total > 0 && done === total
  const percentage = total === 0 ? 0 : (done / total) * 100

  return (
    <div className={isCompact ? styles.compact : styles.progress}>
      {onOpenDone ? (
        <button
          type="button"
          className={`${styles.open} ${isDone ? styles.done : ''}`}
          // Nombre accesible con el porqué del botón, no solo la cifra.
          aria-label={`${label}. Ver los listos`}
          onClick={onOpenDone}
        >
          {label}
          <span aria-hidden="true"> ›</span>
        </button>
      ) : (
        <span className={isDone ? styles.done : undefined}>{label}</span>
      )}
      {total > 0 && (
        <div
          className={styles.track}
          {...(isCompact
            ? { 'aria-hidden': true }
            : {
                // role="progressbar" + aria-value*: el lector de pantalla
                // anuncia el progreso aunque la barra sea un <div> con CSS.
                role: 'progressbar',
                'aria-label': 'Progreso de la maleta',
                'aria-valuemin': 0,
                'aria-valuemax': total,
                'aria-valuenow': done,
                'aria-valuetext': label,
              })}
        >
          <div
            className={styles.fill}
            // Única regla dinámica: el ancho. El resto del estilo vive en CSS.
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  )
}

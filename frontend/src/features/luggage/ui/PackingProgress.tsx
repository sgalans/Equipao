import { isLuggageFullyPacked, luggageProgress } from '../domain/packing'
import type { LuggageEntry } from '../domain/itemQuantityRepository'
import styles from './PackingProgress.module.css'

/** "3 de 5 listos" + barra. Todo derivado de las líneas: nada se guarda. */
export function PackingProgress({ entries }: { entries: LuggageEntry[] }) {
  const { done, total } = luggageProgress(entries)
  if (total === 0) return null

  const isDone = isLuggageFullyPacked(entries)
  const label = isDone ? '¡Maleta lista!' : `${done} de ${total} listos`

  return (
    <div className={styles.progress}>
      <span className={isDone ? styles.done : undefined}>{label}</span>
      {/* role="progressbar" + aria-value*: el lector de pantalla anuncia
          "3 de 5" aunque la barra sea un simple <div> pintado con CSS. */}
      <div
        className={styles.track}
        role="progressbar"
        aria-label="Progreso de la maleta"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={label}
      >
        <div
          className={styles.fill}
          // Única regla dinámica: el ancho. El resto del estilo vive en CSS.
          style={{ width: `${(done / total) * 100}%` }}
        />
      </div>
    </div>
  )
}

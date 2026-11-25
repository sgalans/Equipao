import { useEffect, useId, useRef } from 'react'
import { useRepositories } from '@/shared/di/repositories'
import buttons from '@/shared/ui/buttons.module.css'
import checkCircle from '@/shared/ui/checkCircle.module.css'
import { CheckIcon } from '@/shared/ui/icons/CheckIcon'
import { reportError } from '@/shared/ui/notifications/notificationStore'
import type { Compartment } from '../domain/compartment'
import type { LuggageEntry } from '../domain/itemQuantityRepository'
import { isFullyPacked } from '../domain/packing'
import styles from './ReadyListDialog.module.css'

interface ReadyListDialogProps {
  /**
   * Artículos a listar: los que estaban listos AL ABRIR (null = cerrada).
   * Foto fija a propósito: si se desmarca uno, se queda en la lista (con el
   * círculo vacío) hasta cerrar; nada desaparece bajo el dedo.
   */
  quantityIds: readonly string[] | null
  /** Datos vivos de la maleta: el círculo refleja el estado actual. */
  entries: LuggageEntry[]
  compartments: Compartment[]
  onClose: () => void
}

/**
 * Ventana "Listos": TODOS los artículos listos de la maleta, sueltos y de
 * cada compartimento, estén ocultos o no (decisión de producto). Se abre
 * ENCIMA de la página (hoja inferior, como en iOS): la maleta de debajo no
 * se mueve. Desde aquí se puede desmarcar.
 */
export function ReadyListDialog({
  quantityIds,
  entries,
  compartments,
  onClose,
}: ReadyListDialogProps) {
  const { quantities } = useRepositories()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const open = quantityIds !== null

  // Componente controlado sobre el <dialog> nativo (ver ConfirmDialog):
  // showModal() da gratis el fondo, el foco atrapado y el cierre con Escape.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Las líneas de la foto, con sus datos actuales (y sin las borradas).
  const ids = new Set(quantityIds ?? [])
  const listed = entries.filter((entry) => ids.has(entry.id))
  const groups = [
    {
      key: 'loose',
      name: 'Sueltos',
      isReady: false,
      rows: listed.filter((e) => e.compartmentId === null),
    },
    ...compartments.map((c) => ({
      key: c.id,
      name: c.name,
      // "Listo" PROPIO del compartimento: se marca con un ✓ tras el nombre.
      isReady: c.isReady,
      rows: listed.filter((e) => e.compartmentId === c.id),
    })),
    // Un compartimento listo sale aunque no tenga artículos listos: aquí se
    // ve todo lo que tiene marca de "listo".
  ].filter((group) => group.rows.length > 0 || group.isReady)

  return (
    <dialog
      ref={dialogRef}
      className={styles.sheet}
      aria-labelledby={titleId}
      // Escape o cualquier otro cierre del navegador = cerrar.
      onClose={onClose}
    >
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {/* Sin recuento (decisión del usuario): la cifra es la de la
              barra de progreso, que cuenta bloques y no artículos. */}
          Listos
        </h2>
        <button
          type="button"
          className={buttons.headerAction}
          onClick={onClose}
        >
          Cerrar
        </button>
      </div>

      {groups.length === 0 ? (
        <p className={styles.empty}>Aún no hay nada listo.</p>
      ) : (
        groups.map((group) => (
          <section key={group.key} aria-label={group.name}>
            <h3 className={styles.group}>
              {group.name}
              {group.isReady && (
                // ✓ DESPUÉS del nombre (decisión del usuario): la cabecera
                // conserva su estilo (mayúsculas, sin sangría). No es un
                // botón: el "listo" del compartimento se cambia en la
                // maleta. Verde + símbolo: no depende solo del color, y el
                // texto oculto hace que VoiceOver diga "Neceser, listo".
                <span className={styles.readyMark}>
                  <CheckIcon />
                  <span className="visually-hidden">, listo</span>
                </span>
              )}
            </h3>
            <ul className={styles.list}>
              {group.rows.map((entry) => {
                const isDone = isFullyPacked(entry)
                return (
                  <li key={entry.id} className={styles.row}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isDone}
                      aria-label={entry.itemName}
                      className={checkCircle.check}
                      onClick={() =>
                        void quantities
                          .togglePacked(entry.id)
                          .catch(reportError)
                      }
                    >
                      {isDone && <CheckIcon />}
                    </button>
                    {/* Sin tachar: aquí todo es lo listo (tacharlo todo sería
                        ruido); el círculo ya dice si sigue listo. */}
                    <span className={styles.name}>{entry.itemName}</span>
                    {entry.num > 1 && (
                      <span className={styles.quantity}>×{entry.num}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </dialog>
  )
}

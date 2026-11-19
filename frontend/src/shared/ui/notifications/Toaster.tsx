import { useEffect } from 'react'
import { useNotifications } from './notificationStore'
import styles from './Toaster.module.css'

const AUTO_DISMISS_MS = 5000

/** Muestra el aviso global actual. Se monta una sola vez, en el layout. */
export function Toaster() {
  const message = useNotifications((state) => state.message)
  const id = useNotifications((state) => state.id)
  const dismiss = useNotifications((state) => state.dismiss)

  // Se oculta solo tras unos segundos. Depende de `id` para que un aviso
  // nuevo (aunque repita el texto) reinicie la cuenta atrás.
  useEffect(() => {
    if (message === null) return
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [message, id, dismiss])

  return (
    // Región "viva": la región existe SIEMPRE (aunque vacía), porque los
    // lectores de pantalla solo anuncian cambios en una región que ya
    // estaba en la página. aria-live="assertive" (y no role="alert") para
    // no tener un "alert" vacío permanente que se confunda con los mensajes
    // de error de cada formulario.
    <div aria-live="assertive" aria-atomic="true" className={styles.region}>
      {message && (
        <div className={styles.toast}>
          <span>{message}</span>
          <button
            type="button"
            className={styles.close}
            aria-label="Cerrar aviso"
            onClick={dismiss}
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}

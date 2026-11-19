import { create } from 'zustand'

/**
 * Aviso global ("toast"): un mensaje breve abajo de la pantalla.
 * Estado de UI compartido por toda la app → Zustand (ver CLAUDE.md).
 * Sin persistencia: un aviso no debe sobrevivir a cerrar la app.
 */
interface NotificationState {
  message: string | null
  /** Cambia en cada aviso: permite repetir el mismo texto y reiniciar el temporizador. */
  id: number
  show: (message: string) => void
  dismiss: () => void
}

export const useNotifications = create<NotificationState>()((set) => ({
  message: null,
  id: 0,
  show: (message) => set((state) => ({ message, id: state.id + 1 })),
  dismiss: () => set({ message: null }),
}))

export const SAVE_ERROR_MESSAGE = 'No se ha podido guardar. Inténtalo de nuevo.'

/**
 * Para los fallos que antes solo iban a la consola: se registran (para
 * depurar) Y se avisa al usuario, que si no toca y "no pasa nada".
 *
 * Es una función normal, no un hook: se puede llamar desde un .catch() o
 * un manejador de eventos. Zustand permite usar el store fuera de React con
 * getState().
 */
export function reportError(
  error: unknown,
  message: string = SAVE_ERROR_MESSAGE,
): void {
  console.error(error)
  useNotifications.getState().show(message)
}

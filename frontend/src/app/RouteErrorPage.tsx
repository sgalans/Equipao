import { useEffect } from 'react'
import { useRouteError } from 'react-router'
import page from '@/shared/ui/page.module.css'
import styles from './RouteErrorPage.module.css'

/**
 * Error boundary de las rutas: se muestra si algo falla al PINTAR una
 * pantalla (p. ej. IndexedDB no disponible al leer). Sin ella, React Router
 * enseña su página de error técnica y en inglés.
 *
 * Se pinta en lugar del layout (que es el que ha fallado), así que es
 * autosuficiente. "Recargar" hace una recarga completa: si el fallo era
 * pasajero, la app vuelve a arrancar limpia.
 */
export function RouteErrorPage() {
  const error = useRouteError()

  useEffect(() => {
    // Se registra para depurar; al usuario solo se le muestra lo útil.
    console.error(error)
  }, [error])

  return (
    <main className={styles.main}>
      <h1 className={page.title}>Algo ha ido mal</h1>
      <p className={styles.text}>
        No se ha podido mostrar esta pantalla. Tus maletas siguen guardadas en
        el dispositivo.
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          onClick={() => window.location.reload()}
        >
          Recargar
        </button>
        {/* <a> y no <Link>: navegación completa, sin depender del router
            que acaba de fallar. */}
        <a href="/" className={styles.link}>
          Ir a mis maletas
        </a>
      </div>
    </main>
  )
}

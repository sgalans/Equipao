import { Link, Outlet, useMatch } from 'react-router'
import { ChevronLeftIcon } from '@/shared/ui/icons/ChevronLeftIcon'
import styles from './AppLayout.module.css'

/**
 * Layout común a todas las pantallas: cabecera fija y, debajo, la ruta
 * activa. <Outlet /> es el "hueco" donde React Router pinta la ruta hija.
 *
 * Navegación: en el inicio, la cabecera muestra el nombre de la app; en el
 * resto de pantallas, "‹ Mis maletas" (convención de iOS: volver arriba a la
 * izquierda). Imprescindible en la PWA instalada, donde no hay botón "atrás"
 * del navegador.
 */
export function AppLayout() {
  // useMatch con end: true → solo coincide con "/" exactamente.
  const isHome = useMatch({ path: '/', end: true }) !== null

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        {isHome ? (
          <Link to="/" className={styles.brand}>
            LugGAge
          </Link>
        ) : (
          // Navegación jerárquica ("up"): siempre al inicio, no a la página
          // anterior del historial (navigate(-1)). Así es predecible y
          // funciona aunque se haya entrado por un enlace directo, sin
          // historial al que volver.
          <Link to="/" className={styles.back}>
            <ChevronLeftIcon />
            Mis maletas
          </Link>
        )}
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

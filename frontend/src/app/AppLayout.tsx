import { Link, Outlet } from 'react-router'
import styles from './AppLayout.module.css'

/**
 * Layout común a todas las pantallas: cabecera fija y, debajo, la ruta
 * activa. <Outlet /> es el "hueco" donde React Router pinta la ruta hija.
 */
export function AppLayout() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          LugGAge
        </Link>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

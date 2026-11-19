import { Link, Outlet, useMatch, useMatches } from 'react-router'
import { ChevronLeftIcon } from '@/shared/ui/icons/ChevronLeftIcon'
import { Toaster } from '@/shared/ui/notifications/Toaster'
import { APP_NAME } from './appInfo'
import styles from './AppLayout.module.css'
import { HOME_BACK_LINK, type RouteHandle } from './navigation'
import { AppUpdates } from './pwa/AppUpdates'

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
  // La ruta más profunda que declare adónde volver manda; si ninguna lo
  // hace, al inicio.
  const back =
    useMatches()
      .map((match) => {
        const handle = match.handle as RouteHandle | undefined
        return handle?.back?.(match.params)
      })
      .filter((link) => link !== undefined)
      .at(-1) ?? HOME_BACK_LINK

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        {isHome ? (
          <>
            <Link to="/" className={styles.brand}>
              {APP_NAME}
            </Link>
            {/* Acceso al catálogo: un toque desde el inicio, sin ocupar
                espacio fijo (decisión de producto). */}
            <Link to="/items" className={styles.navLink}>
              Artículos
            </Link>
          </>
        ) : (
          // Navegación jerárquica ("up"): al nivel superior (el inicio, o lo
          // que declare la ruta en su handle), nunca a la página anterior
          // del historial (navigate(-1)). Así es predecible y funciona
          // aunque se haya entrado por un enlace directo, sin historial.
          <Link to={back.to} className={styles.back}>
            <ChevronLeftIcon />
            {back.label}
          </Link>
        )}
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      {/* Aviso global (p. ej. "No se ha podido guardar"), una sola vez. */}
      <Toaster />
      {/* Avisos de versión nueva / BD actualizada en otra pestaña. */}
      <AppUpdates />
    </div>
  )
}

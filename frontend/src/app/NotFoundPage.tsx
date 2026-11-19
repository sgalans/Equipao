import { Link } from 'react-router'
import page from '@/shared/ui/page.module.css'

/** Ruta comodín (*): cualquier URL que no coincida con ninguna ruta. */
export function NotFoundPage() {
  return (
    <section>
      <h1 className={page.title}>Página no encontrada</h1>
      <p>La dirección no existe.</p>
      <Link to="/">Volver a mis maletas</Link>
    </section>
  )
}

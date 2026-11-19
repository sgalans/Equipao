/**
 * Textos del resultado de las acciones en bloque dentro de una maleta.
 * En su propio .ts (no en un .tsx con componentes: rompería el Fast Refresh).
 */
import { articles } from './addedSummary'

/** "Movidos 3 artículos a «Neceser»." / "Movido 1 artículo a sueltos." */
export function movedSummary(
  count: number,
  destination: string | null,
): string {
  const verb = count === 1 ? 'Movido' : 'Movidos'
  const target = destination === null ? 'sueltos' : `«${destination}»`
  return `${verb} ${articles(count)} a ${target}.`
}

/** "Quitados 3 artículos de la maleta." */
export function removedSummary(count: number): string {
  const verb = count === 1 ? 'Quitado' : 'Quitados'
  return `${verb} ${articles(count)} de la maleta.`
}

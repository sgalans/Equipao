/** Límite de NameSchema: la copia nunca debe superarlo. */
const MAX_NAME_LENGTH = 100

/** "Mochila (copia)" o "Mochila (copia 3)" → base "Mochila" y número. */
const COPY_SUFFIX = /^(.*) \(copia(?: (\d+))?\)$/

/**
 * Nombre de la copia de una maleta:
 *   "Mochila"           → "Mochila (copia)"
 *   "Mochila (copia)"   → "Mochila (copia 2)"
 *   "Mochila (copia 2)" → "Mochila (copia 3)"
 * Así duplicar una copia no produce "Mochila (copia) (copia)".
 *
 * Los nombres de maleta no son únicos: duplicar dos veces "Mochila" da dos
 * "Mochila (copia)". Se distinguen igual (orden, contenido) y se renombran
 * con un toque; evitarlo exigiría consultar la base de datos aquí.
 */
export function copyName(name: string): string {
  const match = COPY_SUFFIX.exec(name)
  const base = match ? match[1] : name
  const suffix = match
    ? ` (copia ${match[2] ? Number(match[2]) + 1 : 2})`
    : ' (copia)'
  // Si no cabe, se recorta la base (nunca el sufijo, que es lo que informa).
  return base.slice(0, MAX_NAME_LENGTH - suffix.length).trimEnd() + suffix
}

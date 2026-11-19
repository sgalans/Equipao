/**
 * Criterio ÚNICO de "es el mismo nombre de artículo" en toda la app: lo usan
 * el repositorio (no crear ni renombrar a un duplicado) y la UI (resaltar la
 * fila ya existente). Antes la UI usaba otra comparación y no coincidían en
 * casos como "Paño" / "Pano".
 *
 * Intl.Collator('es') con sensitivity 'base': iguala mayúsculas y tildes
 * ("cámara" = "Camara") pero distingue la ñ, porque en español es otra
 * letra ("año" ≠ "ano"). Se crea una vez y se reutiliza (crearlo es caro).
 */
const spanishCollator = new Intl.Collator('es', { sensitivity: 'base' })

export function isSameItemName(a: string, b: string): boolean {
  return spanishCollator.compare(a.trim(), b.trim()) === 0
}

/** Orden alfabético español (á = a, ñ tras n), para Array.sort. */
export function compareItemNames(a: string, b: string): number {
  return spanishCollator.compare(a, b)
}

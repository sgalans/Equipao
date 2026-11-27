import type { ItemQuantity } from './itemQuantity'

/**
 * Reglas de empaquetado (funciones puras: sin base de datos ni React).
 *
 * Al ser puras se testean con una línea cada caso, y tanto el repositorio
 * como la UI las reutilizan: la regla vive en UN sitio.
 */
type Counts = Pick<ItemQuantity, 'num' | 'nAlreadyPacked'>

/**
 * Listo = se marcó con EXACTAMENTE las unidades que tiene ahora (decisión del
 * usuario). `nAlreadyPacked` recuerda con cuántas se marcó: si después se
 * cambia la cantidad (suba o baje) deja de estar listo, y si vuelve a esa
 * cantidad vuelve a estarlo (5/5 → 6 = no listo → 5 = listo; 5/5 → 4 = no
 * listo → 5 = listo). No hay estado "a medias".
 */
export function isFullyPacked(q: Counts): boolean {
  return q.nAlreadyPacked === q.num
}

/**
 * Empaquetado "todo o nada" (decisión de producto): un toque lo marca como
 * listo con las unidades que tiene; otro lo desmarca. Si no estaba listo
 * (también tras cambiar la cantidad), un toque lo marca.
 */
export function toggledPackedCount(q: Counts): number {
  return isFullyPacked(q) ? 0 : q.num
}

/**
 * Al UNIR dos artículos del catálogo ("peolota" → "pelota"), una maleta que
 * tenía los dos queda con UNA línea (decisión del usuario):
 * - la cantidad MAYOR de las dos: no se pierde nada que se fuera a llevar;
 * - lista solo si lo estaban LAS DOS (nunca se da por guardado algo que no
 *   lo estaba).
 */
export function mergedCounts(a: Counts, b: Counts): Counts {
  const num = Math.max(a.num, b.num)
  const bothPacked = isFullyPacked(a) && isFullyPacked(b)
  return { num, nAlreadyPacked: bothPacked ? num : 0 }
}

/**
 * Progreso de un conjunto de artículos, contado en artículos completos (no
 * en unidades): 5 calcetines guardados cuentan como 1. Es el progreso de un
 * compartimento ("1 de 2").
 */
export function itemsProgress(quantities: Counts[]): {
  done: number
  total: number
} {
  return {
    done: quantities.filter(isFullyPacked).length,
    total: quantities.length,
  }
}

/**
 * Progreso de la MALETA, por bloques (decisión de producto): cada artículo
 * suelto es un bloque y cada compartimento es UN bloque, listo solo si está
 * marcado como tal (aunque tenga artículos sin guardar). Así se hace una
 * maleta: el neceser se prepara aparte y entra entero.
 */
export function packingProgress(
  entries: (Counts & { compartmentId: string | null })[],
  compartments: { isReady: boolean }[],
): { done: number; total: number } {
  const loose = itemsProgress(
    entries.filter((entry) => entry.compartmentId === null),
  )
  return {
    done: loose.done + compartments.filter((c) => c.isReady).length,
    total: loose.total + compartments.length,
  }
}

/**
 * ¿Hay ALGO listo en la maleta (un artículo o un compartimento)? Decide si
 * tiene sentido "Reiniciar maleta". No vale `progress.done > 0`: la barra
 * cuenta bloques, y un compartimento sin marcar puede tener dentro
 * artículos guardados.
 */
export function hasAnythingPacked(
  entries: Counts[],
  compartments: { isReady: boolean }[],
): boolean {
  return entries.some(isFullyPacked) || compartments.some((c) => c.isReady)
}

/**
 * ¿Está toda la maleta hecha? Es el `everythingPacked` del modelo, que por
 * diseño NO se guarda en la base de datos: se deriva (single source of truth).
 * Una maleta vacía no cuenta como hecha: no hay nada que celebrar.
 */
export function isFullyDone(progress: {
  done: number
  total: number
}): boolean {
  return progress.total > 0 && progress.done === progress.total
}

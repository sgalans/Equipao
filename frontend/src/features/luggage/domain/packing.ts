import type { ItemQuantity } from './itemQuantity'

/**
 * Reglas de empaquetado (funciones puras: sin base de datos ni React).
 *
 * Al ser puras se testean con una línea cada caso, y tanto el repositorio
 * como la UI las reutilizan: la regla vive en UN sitio.
 */
type Counts = Pick<ItemQuantity, 'num' | 'nAlreadyPacked'>

/** Un artículo está listo cuando no le falta ninguna unidad por guardar. */
export function isFullyPacked(q: Counts): boolean {
  return q.nAlreadyPacked >= q.num
}

/**
 * Empaquetado "todo o nada" (decisión de producto): un toque guarda todas
 * las unidades; otro toque las saca todas. Si estaba a medias (p. ej. 5/6
 * tras subir la cantidad), un toque lo completa.
 */
export function toggledPackedCount(q: Counts): number {
  return isFullyPacked(q) ? 0 : q.num
}

/**
 * Unidades guardadas tras cambiar la cantidad total a `newNum`.
 * - Subir (5/5 → 6): se conservan las 5 guardadas → 5/6 (la sexta falta).
 * - Bajar (5/5 → 4): se recorta a 4/4. Sin este recorte se violaría
 *   CHECK (nAlreadyPacked <= num).
 */
export function packedCountAfterResize(q: Counts, newNum: number): number {
  return Math.min(q.nAlreadyPacked, newNum)
}

/** Progreso de una maleta, contado en artículos completos (no en unidades). */
export function luggageProgress(quantities: Counts[]): {
  done: number
  total: number
} {
  return {
    done: quantities.filter(isFullyPacked).length,
    total: quantities.length,
  }
}

/**
 * ¿Está toda la maleta hecha? Es el `everythingPacked` del modelo, que por
 * diseño NO se guarda en la base de datos: se deriva (single source of truth).
 * Una maleta vacía no cuenta como hecha: no hay nada que celebrar.
 */
export function isLuggageFullyPacked(quantities: Counts[]): boolean {
  return quantities.length > 0 && quantities.every(isFullyPacked)
}

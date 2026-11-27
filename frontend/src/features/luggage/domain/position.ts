import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing'

/**
 * Orden manual de los artículos de una maleta con FRACTIONAL INDEXING
 * (decisión del usuario): cada línea guarda una clave de texto ("a0",
 * "a0V", "a1"…) y el orden es el de esas claves. Para meter algo ENTRE dos
 * se genera una clave intermedia, así que mover un artículo cambia UNA sola
 * fila (con números 1, 2, 3… habría que renumerar las de detrás). Es lo que
 * usan Figma o Linear, y sincroniza mejor si algún día hay backend (menos
 * conflictos: dos móviles que mueven cosas distintas no se pisan).
 *
 * Este módulo envuelve la librería (`fractional-indexing`): el resto del
 * código no la conoce y cambiarla solo tocaría este fichero.
 */

/** Clave de orden de una línea (ver arriba). */
export type Position = string

/**
 * Compara claves por UNIDADES DE CÓDIGO (como hace IndexedDB), NUNCA con
 * localeCompare: las claves no son palabras, y un orden "alfabético" de
 * idioma las desordenaría.
 */
export function comparePositions(a: Position, b: Position): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Clave para poner algo AL FINAL (detrás de `last`, o la primera si no hay). */
export function positionAfter(last: Position | null): Position {
  return generateKeyBetween(last, null)
}

/** `count` claves seguidas al final (para añadir varias líneas de golpe). */
export function positionsAfter(
  last: Position | null,
  count: number,
): Position[] {
  return generateNKeysBetween(last, null, count)
}

/**
 * Clave ENTRE `before` y `after` (null = sin vecino por ese lado: el
 * principio o el final). Es lo que usa "mover entre estos dos".
 */
export function positionBetween(
  before: Position | null,
  after: Position | null,
): Position {
  return generateKeyBetween(before, after)
}

/** Última clave de una lista de líneas (null si está vacía). */
export function lastPosition(rows: { position: Position }[]): Position | null {
  return rows.reduce<Position | null>(
    (max, row) =>
      max === null || comparePositions(row.position, max) > 0
        ? row.position
        : max,
    null,
  )
}

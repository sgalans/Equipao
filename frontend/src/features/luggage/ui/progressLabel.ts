/**
 * Texto de un progreso: lo comparten el detalle y las tarjetas del inicio.
 *
 * Es texto de interfaz (en español), así que vive en `ui/` y no en `domain/`.
 * Va en su propio fichero .ts porque un .tsx que exporta componentes y
 * funciones a la vez rompe el Fast Refresh de Vite (regla de ESLint
 * react-refresh/only-export-components).
 */
export function progressLabel(done: number, total: number): string {
  if (total === 0) return 'Vacía'
  // Equivale a isFullyDone (packing.ts), a partir de los contadores.
  if (done === total) return '¡Maleta lista!'
  return `${done} de ${total} listos`
}

/**
 * Estado de un compartimento para su cabecera.
 * - Marcado como listo y con todo guardado: "Listo".
 * - En cualquier otro caso, su progreso de artículos ("6 de 7") o "Vacío".
 *   Si está marcado con artículos pendientes, se sigue viendo "6 de 7" SIN
 *   mensaje extra (decisión de producto): la marca ya la indica el círculo.
 * - Sin marcar, aunque todo esté guardado, NO dice "Listo": eso solo lo
 *   decide la marca.
 */
export function compartmentStatus(
  done: number,
  total: number,
  isReady: boolean,
): string {
  if (isReady && done === total) return 'Listo'
  if (total === 0) return 'Vacío'
  return `${done} de ${total}`
}

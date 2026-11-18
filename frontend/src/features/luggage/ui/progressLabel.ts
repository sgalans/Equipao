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
  // Equivale a isLuggageFullyPacked (packing.ts), a partir de los contadores.
  if (done === total) return '¡Maleta lista!'
  return `${done} de ${total} listos`
}

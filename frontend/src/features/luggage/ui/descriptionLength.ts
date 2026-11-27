/** Líneas que se ven con la descripción plegada (ver LuggageDescription). */
export const COLLAPSED_LINES = 3

/**
 * ¿Es "larga" (merece "Ver menos")? No se puede medir en pantalla cuántas
 * líneas ocupa (depende del ancho del móvil, y los tests no tienen
 * pantalla): regla sencilla y comprobable. Más de COLLAPSED_LINES líneas
 * escritas, o tanto texto que en un iPhone pasaría de esas líneas.
 */
export function isLongDescription(text: string): boolean {
  return text.split('\n').length > COLLAPSED_LINES || text.length > 180
}

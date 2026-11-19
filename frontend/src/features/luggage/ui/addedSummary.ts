/**
 * Textos del resultado de "añadir varios". En su propio .ts: un .tsx que
 * exporta componentes y funciones rompe el Fast Refresh de Vite.
 */

export const articles = (n: number) =>
  `${n} ${n === 1 ? 'artículo' : 'artículos'}`

/** Resumen para el aviso: "Añadidos 3 artículos a «Mochila». 1 ya estaba." */
export function addedSummary(
  addedCount: number,
  skippedCount: number,
  luggageName: string,
): string {
  const added =
    addedCount === 0
      ? `No se ha añadido nada a «${luggageName}»`
      : `${addedCount === 1 ? 'Añadido' : 'Añadidos'} ${articles(addedCount)} a «${luggageName}»`
  const skipped =
    skippedCount === 0
      ? ''
      : skippedCount === 1
        ? ' 1 ya estaba.'
        : ` ${skippedCount} ya estaban.`
  return `${added}.${skipped}`
}

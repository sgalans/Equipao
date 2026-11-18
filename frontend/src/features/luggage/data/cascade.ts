import type { AppDb } from '@/shared/db/db'

/**
 * Borra maletas y su contenido (ItemQuantity): ON DELETE CASCADE hecho a mano,
 * porque IndexedDB no tiene claves foráneas.
 *
 * Lo comparten el repositorio de maletas y el de viajes (que borra todas las
 * maletas de un viaje). Debe llamarse DENTRO de una transacción 'rw' que
 * incluya las tablas luggages e itemQuantities: si algo falla a medias, la
 * transacción deshace todo y no quedan filas huérfanas.
 */
export async function deleteLuggagesCascade(
  db: AppDb,
  luggageIds: string[],
): Promise<void> {
  if (luggageIds.length === 0) return
  // Primero los hijos y luego los padres (orden habitual en un borrado manual).
  await db.itemQuantities.where('luggageId').anyOf(luggageIds).delete()
  await db.luggages.bulkDelete(luggageIds)
}

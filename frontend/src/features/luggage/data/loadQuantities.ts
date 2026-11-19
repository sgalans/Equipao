import type { AppDb } from '@/shared/db/db'
import { ConsistencyError, EntityNotFoundError } from '@/shared/domain/errors'
import type { ItemQuantity } from '../domain/itemQuantity'

/**
 * Carga varias líneas de maleta y comprueba que existen todas y que son de
 * `luggageId` (o, si no se indica, de una MISMA maleta). Lo comparten las
 * operaciones "en bloque" de varios repositorios: una sola definición de la
 * regla. Debe llamarse dentro de una transacción que incluya itemQuantities.
 */
export async function loadQuantitiesOfOneLuggage(
  db: AppDb,
  ids: string[],
  luggageId?: string,
): Promise<ItemQuantity[]> {
  const uniqueIds = [...new Set(ids)]
  const rows = await db.itemQuantities.bulkGet(uniqueIds)
  const found: ItemQuantity[] = []
  rows.forEach((row, index) => {
    if (!row) throw new EntityNotFoundError('ItemQuantity', uniqueIds[index])
    found.push(row)
  })
  const luggages = new Set(found.map((row) => row.luggageId))
  if (luggageId !== undefined) luggages.add(luggageId)
  if (luggages.size > 1) {
    throw new ConsistencyError('Los artículos son de maletas distintas')
  }
  return found
}

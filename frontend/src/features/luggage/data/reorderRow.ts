import type { Table } from 'dexie'
import { nowIso } from '@/shared/data/entityBase'
import { ConsistencyError, EntityNotFoundError } from '@/shared/domain/errors'
import { positionBetween, type Position } from '../domain/position'

/** Lo que tiene toda fila ordenable de una maleta (líneas y compartimentos). */
interface OrderedRow {
  id: string
  luggageId: string
  position: Position
  updatedAt: string
}

/**
 * Orden manual compartido por líneas y compartimentos (DRY: la regla vive
 * en un solo sitio): coloca la fila `id` ENTRE `beforeId` y `afterId`
 * (null = sin vecino por ese lado) con una clave intermedia, así que solo
 * cambia ESA fila (fractional indexing, ver domain/position.ts).
 * Debe llamarse dentro de una transacción 'rw' sobre `table`.
 */
// TInsert: el tercer parámetro de Table de Dexie (tipo al insertar). Con
// él, T se deduce como la fila REAL (Compartment, ItemQuantity…) y no como
// OrderedRow, y el resultado sale con su tipo completo.
export async function reorderRow<T extends OrderedRow, TInsert>(
  table: Table<T, string, TInsert>,
  entityName: string,
  id: string,
  beforeId: string | null,
  afterId: string | null,
  /** Otros cambios en la MISMA escritura (p. ej. cambiar de compartimento). */
  extra: Partial<T> = {},
): Promise<T> {
  const [current, before, after] = await table.bulkGet([
    id,
    beforeId ?? '',
    afterId ?? '',
  ])
  if (!current) throw new EntityNotFoundError(entityName, id)
  if (beforeId !== null && !before) {
    throw new EntityNotFoundError(entityName, beforeId)
  }
  if (afterId !== null && !after) {
    throw new EntityNotFoundError(entityName, afterId)
  }
  const neighbours = [before, after].filter((row) => row !== undefined)
  if (neighbours.some((row) => row.luggageId !== current.luggageId)) {
    throw new ConsistencyError('Son de maletas distintas')
  }
  const updated: T = {
    ...current,
    ...extra,
    position: positionBetween(
      before?.position ?? null,
      after?.position ?? null,
    ),
    updatedAt: nowIso(),
  }
  // La fila completa es una inserción válida (tiene todos los campos), pero
  // TypeScript no puede saberlo de un genérico: se lo decimos explícitamente.
  await table.put(updated as unknown as TInsert)
  return updated
}

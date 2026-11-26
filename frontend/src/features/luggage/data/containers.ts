import type { AppDb } from '@/shared/db/db'
import { ConsistencyError, EntityNotFoundError } from '@/shared/domain/errors'
import type { Compartment } from '../domain/compartment'
import type { ItemQuantity } from '../domain/itemQuantity'
import { isFullyPacked } from '../domain/packing'

/*
 * Compartimentos = LÍNEAS CONTENEDOR (refactor/compartments, patrón
 * Composite): una línea de la maleta cuyo artículo del catálogo es un
 * contenedor (`Item.isContainer`). Sus artículos apuntan a ella con
 * `compartmentId`. Un solo nivel: un contenedor no puede ir dentro de otro.
 *
 * Lo comparten los repositorios de compartimentos, de líneas y de maletas.
 * Llamar dentro de una transacción que incluya las tablas que se leen.
 */

/** ids de los artículos del catálogo que son contenedores. */
export async function containerItemIds(db: AppDb): Promise<Set<string>> {
  const items = await db.items.toArray()
  return new Set(items.filter((item) => item.isContainer).map((i) => i.id))
}

/**
 * La línea contenedor vista como el Compartment de siempre (el PORT no
 * cambia: la UI sigue trabajando con compartimentos).
 * - name: el del contenedor del catálogo (compartido entre maletas);
 * - isReady: la línea guardada (marcar el compartimento = empaquetarla).
 */
export function toCompartment(line: ItemQuantity, name: string): Compartment {
  return {
    id: line.id,
    luggageId: line.luggageId,
    name,
    isReady: isFullyPacked(line),
    position: line.position,
    createdAt: line.createdAt,
    updatedAt: line.updatedAt,
  }
}

/**
 * Invariante: `compartmentId` debe ser una línea CONTENEDOR de la MISMA
 * maleta, y de primer nivel (no se anidan). IndexedDB no sabe expresarlo
 * (no hay FOREIGN KEY ni CHECK entre tablas): se comprueba aquí.
 */
export async function assertIsCompartmentOf(
  db: AppDb,
  compartmentId: string | null,
  luggageId: string,
): Promise<void> {
  if (compartmentId === null) return // suelto: siempre válido
  const line = await db.itemQuantities.get(compartmentId)
  if (!line) throw new EntityNotFoundError('Compartment', compartmentId)
  if (line.luggageId !== luggageId) {
    throw new ConsistencyError('El compartimento pertenece a otra maleta')
  }
  const item = await db.items.get(line.itemId)
  if (!item?.isContainer || line.compartmentId !== null) {
    throw new ConsistencyError('Eso no es un compartimento de la maleta')
  }
}

/** Un contenedor no se puede meter dentro de otro (un solo nivel). */
export async function assertNotNested(
  db: AppDb,
  itemIds: string[],
  compartmentId: string | null,
): Promise<void> {
  if (compartmentId === null) return
  const containers = await containerItemIds(db)
  if (itemIds.some((id) => containers.has(id))) {
    throw new ConsistencyError(
      'Un compartimento no puede ir dentro de otro compartimento',
    )
  }
}

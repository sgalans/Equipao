import type { ItemQuantity, NewItemQuantity } from './itemQuantity'

/**
 * Una línea de la maleta lista para mostrar: la cantidad + el nombre del
 * artículo. Es un "read model": la UI recibe justo lo que pinta en lugar de
 * cruzar ella misma dos tablas (ItemQuantity ⋈ Item).
 */
export type LuggageEntry = ItemQuantity & { itemName: string }

/** Port del contenido de las maletas (junction table Luggage ↔ Item). */
export interface ItemQuantityRepository {
  /** Contenido de una maleta, en orden de creación. */
  listByLuggage(luggageId: string): Promise<ItemQuantity[]>
  /** Igual que listByLuggage, pero con el nombre de cada artículo. */
  listEntriesByLuggage(luggageId: string): Promise<LuggageEntry[]>
  /**
   * Añade un ítem a una maleta.
   * Lanza EntityNotFoundError si la maleta o el ítem no existen (FOREIGN KEY) y
   * DuplicateError si el ítem ya está en esa maleta (UNIQUE).
   */
  add(input: NewItemQuantity): Promise<ItemQuantity>
  /** Cambia cantidades; valida 0 <= nAlreadyPacked <= num con los valores finales. */
  update(
    id: string,
    changes: { num?: number; nAlreadyPacked?: number },
  ): Promise<ItemQuantity>
  /** Empaquetado "todo o nada" (ver domain/packing.ts). */
  togglePacked(id: string): Promise<ItemQuantity>
  /** Cambia la cantidad total ajustando lo ya guardado (ver packing.ts). */
  resize(id: string, num: number): Promise<ItemQuantity>
  /** Quita el ítem de la maleta. Idempotente. */
  remove(id: string): Promise<void>
}

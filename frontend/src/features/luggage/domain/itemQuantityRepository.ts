import type { ItemQuantity, NewItemQuantity } from './itemQuantity'

/** Port del contenido de las maletas (junction table Luggage ↔ Item). */
export interface ItemQuantityRepository {
  /** Contenido de una maleta, en orden de creación. */
  listByLuggage(luggageId: string): Promise<ItemQuantity[]>
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
  /** Quita el ítem de la maleta. Idempotente. */
  remove(id: string): Promise<void>
}

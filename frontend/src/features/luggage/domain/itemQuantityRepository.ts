import type { ItemQuantity, NewItemQuantity } from './itemQuantity'

/**
 * Una línea de la maleta lista para mostrar: la cantidad + el nombre del
 * artículo. Es un "read model": la UI recibe justo lo que pinta en lugar de
 * cruzar ella misma dos tablas (ItemQuantity ⋈ Item).
 */
export type LuggageEntry = ItemQuantity & { itemName: string }

/** Resultado de añadir varios artículos de golpe. */
export interface AddManyResult {
  /** Líneas creadas (artículos que no estaban en la maleta). */
  added: ItemQuantity[]
  /** Artículos que YA estaban en la maleta: se ignoran (ni se duplican ni suman). */
  skippedItemIds: string[]
}

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
   * Si se indica compartmentId, debe ser de la misma maleta (ConsistencyError).
   */
  add(input: NewItemQuantity): Promise<ItemQuantity>
  /**
   * Añade varios artículos de golpe (cantidad 1, sin guardar), sueltos o en
   * un compartimento de esa maleta. IDEMPOTENTE: los que ya estaban se
   * ignoran, así que repetir la operación no cambia nada. Todo o nada, en
   * una transacción. Lanza EntityNotFoundError si la maleta, algún artículo
   * o el compartimento no existen, y ConsistencyError si el compartimento es
   * de otra maleta.
   */
  addMany(
    luggageId: string,
    itemIds: string[],
    compartmentId?: string | null,
  ): Promise<AddManyResult>
  /** Empaquetado "todo o nada" (ver domain/packing.ts). */
  togglePacked(id: string): Promise<ItemQuantity>
  /** Cambia la cantidad total ajustando lo ya guardado (ver packing.ts). */
  resize(id: string, num: number): Promise<ItemQuantity>
  /**
   * Mueve el artículo a un compartimento de SU maleta, o a sueltos (null).
   * Lanza EntityNotFoundError si no existe y ConsistencyError si el
   * compartimento es de otra maleta.
   */
  moveTo(id: string, compartmentId: string | null): Promise<ItemQuantity>
  /**
   * Mueve varios artículos de UNA maleta a un compartimento suyo o a sueltos
   * (null), todo o nada. EntityNotFoundError si alguno no existe;
   * ConsistencyError si son de maletas distintas o el compartimento es de
   * otra maleta.
   */
  moveMany(ids: string[], compartmentId: string | null): Promise<ItemQuantity[]>
  /** Quita varios artículos de la maleta de golpe. Idempotente. */
  removeMany(ids: string[]): Promise<void>
  /** Quita el ítem de la maleta. Idempotente. */
  remove(id: string): Promise<void>
}

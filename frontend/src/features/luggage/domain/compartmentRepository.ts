import type { Compartment, NewCompartment } from './compartment'

/** Port de los compartimentos de una maleta. */
export interface CompartmentRepository {
  /** Compartimentos de una maleta, en orden de creación. */
  listByLuggage(luggageId: string): Promise<Compartment[]>
  /** Lanza EntityNotFoundError si la maleta no existe (FOREIGN KEY). */
  create(input: NewCompartment): Promise<Compartment>
  /**
   * Crea un compartimento y mete en él artículos que ya están en esa maleta,
   * todo o nada ("mover a un compartimento nuevo"). EntityNotFoundError si
   * la maleta o algún artículo no existen; ConsistencyError si algún
   * artículo es de otra maleta.
   */
  createWithQuantities(
    input: NewCompartment,
    quantityIds: string[],
  ): Promise<Compartment>
  /** Marca o desmarca el compartimento como listo. EntityNotFoundError si no existe. */
  toggleReady(id: string): Promise<Compartment>
  /** Renombra. Lanza EntityNotFoundError si no existe. */
  update(id: string, changes: { name?: string }): Promise<Compartment>
  /**
   * Borra el compartimento; sus artículos pasan a sueltos en la maleta
   * (ON DELETE SET NULL). Idempotente.
   */
  remove(id: string): Promise<void>
}

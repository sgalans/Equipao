import type { Compartment, NewCompartment } from './compartment'

/** Port de los compartimentos de una maleta. */
export interface CompartmentRepository {
  /** Compartimentos de una maleta, en orden de creación. */
  listByLuggage(luggageId: string): Promise<Compartment[]>
  /** Lanza EntityNotFoundError si la maleta no existe (FOREIGN KEY). */
  create(input: NewCompartment): Promise<Compartment>
  /** Renombra. Lanza EntityNotFoundError si no existe. */
  update(id: string, changes: { name?: string }): Promise<Compartment>
  /**
   * Borra el compartimento; sus artículos pasan a sueltos en la maleta
   * (ON DELETE SET NULL). Idempotente.
   */
  remove(id: string): Promise<void>
}

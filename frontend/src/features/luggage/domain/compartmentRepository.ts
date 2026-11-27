import type { Compartment, NewCompartment } from './compartment'

/** Port de los compartimentos de una maleta. */
export interface CompartmentRepository {
  /** Compartimentos de una maleta, en su orden manual (`position`). */
  listByLuggage(luggageId: string): Promise<Compartment[]>
  /**
   * Crea el compartimento AL FINAL de la maleta. Lanza EntityNotFoundError
   * si la maleta no existe (FOREIGN KEY).
   */
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
  /**
   * Orden manual: coloca el compartimento `id` ENTRE `beforeId` y `afterId`
   * (null = principio o final). Cambia solo esa fila (fractional indexing).
   * EntityNotFoundError si alguno no existe; ConsistencyError si son de
   * maletas distintas.
   */
  reorder(
    id: string,
    beforeId: string | null,
    afterId: string | null,
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

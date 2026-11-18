import type { Luggage, NewLuggage } from './luggage'

/** Port de las maletas. Ver TripRepository para la explicación del patrón. */
export interface LuggageRepository {
  /** Maletas de un viaje, en orden de creación. */
  listByTrip(tripId: string): Promise<Luggage[]>
  getById(id: string): Promise<Luggage | undefined>
  /** Lanza EntityNotFoundError si el viaje no existe (FOREIGN KEY). */
  create(input: NewLuggage): Promise<Luggage>
  /** Solo el nombre: una maleta no se mueve de viaje (para eso, duplicar). */
  update(id: string, changes: { name?: string }): Promise<Luggage>
  /** Borra la maleta y su contenido (ON DELETE CASCADE). Idempotente. */
  remove(id: string): Promise<void>
}

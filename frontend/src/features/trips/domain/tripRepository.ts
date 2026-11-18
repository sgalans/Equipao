import type { NewTrip, Trip } from './trip'

/**
 * Port (clean architecture / ports & adapters): QUÉ se puede hacer con los
 * viajes, sin decir CÓMO se guardan. La UI depende solo de esta interfaz.
 * Implementaciones: Dexie ahora (data/dexieTripRepository.ts); en la fase 2
 * se podrá añadir una contra la API de FastAPI sin tocar la UI.
 */
export interface TripRepository {
  /** Todos los viajes, ordenados por fecha de inicio. */
  list(): Promise<Trip[]>
  getById(id: string): Promise<Trip | undefined>
  /** Valida el input y rellena id y timestamps. */
  create(input: NewTrip): Promise<Trip>
  /** Actualiza campos sueltos. Lanza EntityNotFoundError si no existe. */
  update(id: string, changes: Partial<NewTrip>): Promise<Trip>
  /**
   * Borra el viaje y, en cascada, sus maletas y el contenido de estas
   * (ON DELETE CASCADE). Los Items del catálogo no se tocan.
   * Idempotente: borrar algo que no existe no es un error.
   */
  remove(id: string): Promise<void>
}

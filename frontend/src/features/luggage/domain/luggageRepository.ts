import type { Luggage, NewLuggage } from './luggage'

/**
 * Port (clean architecture / ports & adapters): QUÉ se puede hacer con las
 * maletas, sin decir CÓMO se guardan. La UI depende solo de esta interfaz.
 * Implementaciones: Dexie ahora (data/dexieLuggageRepository.ts); en la
 * fase 2 se podrá añadir una contra la API de FastAPI sin tocar la UI.
 */
export interface LuggageRepository {
  /** Todas las maletas, las más recientes primero. */
  list(): Promise<Luggage[]>
  getById(id: string): Promise<Luggage | undefined>
  /** Valida el input y rellena id y timestamps. */
  create(input: NewLuggage): Promise<Luggage>
  /** Renombra. Lanza EntityNotFoundError si no existe. */
  update(id: string, changes: { name?: string }): Promise<Luggage>
  /**
   * Borra la maleta y su contenido (ON DELETE CASCADE sobre ItemQuantity).
   * Los Items del catálogo no se tocan. Idempotente.
   */
  remove(id: string): Promise<void>
}

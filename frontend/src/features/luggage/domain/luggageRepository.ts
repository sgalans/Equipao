import type { Luggage, NewLuggage } from './luggage'

/**
 * Maleta + su progreso, para la pantalla de inicio. "Read model": se calcula
 * al leer (no se guarda: single source of truth). `hasPacked`: hay algo
 * listo (ver hasAnythingPacked), para ofrecer "Reiniciar maleta".
 */
export type LuggageSummary = Luggage & {
  done: number
  total: number
  hasPacked: boolean
}

/**
 * Port (clean architecture / ports & adapters): QUÉ se puede hacer con las
 * maletas, sin decir CÓMO se guardan. La UI depende solo de esta interfaz.
 * Implementaciones: Dexie ahora (data/dexieLuggageRepository.ts); en la
 * fase 2 se podrá añadir una contra la API de FastAPI sin tocar la UI.
 */
export interface LuggageRepository {
  /** Todas las maletas, las más recientes primero. */
  list(): Promise<Luggage[]>
  /** Igual que list(), con el progreso de cada maleta (artículos completos). */
  listSummaries(): Promise<LuggageSummary[]>
  getById(id: string): Promise<Luggage | undefined>
  /** Valida el input y rellena id y timestamps. */
  create(input: NewLuggage): Promise<Luggage>
  /**
   * Duplica la maleta con sus compartimentos y artículos, en una sola
   * transacción. La copia se llama "Nombre (copia)" y empieza SIN nada
   * guardado (uso como plantilla). Lanza EntityNotFoundError si no existe.
   */
  duplicate(id: string): Promise<Luggage>
  /** Cambia nombre y/o descripción. Lanza EntityNotFoundError si no existe. */
  update(
    id: string,
    changes: { name?: string; description?: string },
  ): Promise<Luggage>
  /**
   * "Reiniciar maleta" (para reutilizarla tras el viaje): desmarca TODO,
   * artículos (0 guardados, también lo que se recordaba tras cambiar la
   * cantidad) y compartimentos. No quita nada. Una transacción. Lanza
   * EntityNotFoundError si no existe.
   */
  resetPacked(id: string): Promise<void>
  /**
   * Borra la maleta y su contenido (ON DELETE CASCADE sobre ItemQuantity).
   * Los Items del catálogo no se tocan. Idempotente.
   */
  remove(id: string): Promise<void>
}

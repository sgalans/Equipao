import type { Item, NewItem } from './item'

/**
 * Artículo + nombres de las maletas donde está, para la pantalla del
 * catálogo ("En 2 maletas") y para avisar antes de borrar. Read model:
 * se calcula al leer, no se guarda.
 */
export type ItemSummary = Item & { luggageNames: string[] }

/** Port del catálogo global de artículos. */
export interface ItemRepository {
  /** Todo el catálogo, en orden alfabético español (á = a, ñ tras n). */
  list(): Promise<Item[]>
  /** Igual que list(), con las maletas donde se usa cada artículo. */
  listWithUsage(): Promise<ItemSummary[]>
  getById(id: string): Promise<Item | undefined>
  /**
   * Busca por nombre sin distinguir mayúsculas ni tildes ("cámara" =
   * "Camara"), pero sí la ñ ("año" ≠ "ano"). Evita duplicados en el catálogo.
   */
  findByName(name: string): Promise<Item | undefined>
  create(input: NewItem): Promise<Item>
  /**
   * Renombra. Lanza EntityNotFoundError si no existe y DuplicateError si ya
   * hay OTRO artículo con ese nombre (mismo criterio que findByName).
   */
  update(id: string, changes: Partial<NewItem>): Promise<Item>
  /**
   * Borra el artículo y lo quita de todas las maletas (ON DELETE CASCADE;
   * la UI avisa antes de en cuáles está). Idempotente.
   */
  remove(id: string): Promise<void>
}

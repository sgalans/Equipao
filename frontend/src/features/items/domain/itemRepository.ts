import type { Item, NewItem } from './item'

/** Port del catálogo global de ítems. */
export interface ItemRepository {
  /** Todo el catálogo, en orden alfabético español (á = a, ñ tras n). */
  list(): Promise<Item[]>
  getById(id: string): Promise<Item | undefined>
  /**
   * Busca por nombre sin distinguir mayúsculas ni tildes ("cámara" =
   * "Camara"), pero sí la ñ ("año" ≠ "ano"). Evita duplicados en el catálogo.
   */
  findByName(name: string): Promise<Item | undefined>
  create(input: NewItem): Promise<Item>
  update(id: string, changes: Partial<NewItem>): Promise<Item>
  /**
   * ON DELETE RESTRICT: lanza InUseError si el ítem está en alguna maleta.
   * Idempotente si el ítem no existe.
   */
  remove(id: string): Promise<void>
}

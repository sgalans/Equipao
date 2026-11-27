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
  /**
   * Crea un artículo. Lanza DuplicateError si ya hay otro con ese nombre
   * (mismo criterio que findByName): el catálogo nunca tiene duplicados.
   */
  create(input: NewItem): Promise<Item>
  /**
   * Renombra o cambia si es un contenedor. Lanza EntityNotFoundError si no
   * existe, DuplicateError si ya hay OTRO artículo con ese nombre (mismo
   * criterio que findByName) y ConsistencyError si cambia `isContainer`
   * estando en alguna maleta.
   */
  update(id: string, changes: Partial<NewItem>): Promise<Item>
  /**
   * UNE `sourceId` en `targetId` (p. ej. corregir "peolota" → "pelota"):
   * en cada maleta, "peolota" pasa a ser "pelota"; si una maleta tenía los
   * dos, queda una línea (ver mergedCounts) y, si eran compartimentos, con
   * los artículos de los dos dentro. Después "peolota" desaparece del
   * catálogo. IRREVERSIBLE: la UI lo confirma antes. Todo en una transacción.
   * EntityNotFoundError si alguno no existe; ConsistencyError si uno es
   * contenedor y el otro no (no se mezclan artículos y compartimentos).
   */
  merge(sourceId: string, targetId: string): Promise<Item>
  /**
   * Borra el artículo y lo quita de todas las maletas (ON DELETE CASCADE;
   * la UI avisa antes de en cuáles está). Idempotente.
   */
  remove(id: string): Promise<void>
}

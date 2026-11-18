import { Dexie, type EntityTable } from 'dexie'
import type { Item } from '@/features/items/domain/item'
import type { ItemQuantity } from '@/features/luggage/domain/itemQuantity'
import type { Luggage } from '@/features/luggage/domain/luggage'
import type { Trip } from '@/features/trips/domain/trip'

/** Fila clave/valor para datos internos de la app (p. ej. el id de dispositivo). */
export interface MetaEntry {
  key: string
  value: string
}

export const DEFAULT_DB_NAME = 'luggage-app'

/**
 * Base de datos local (IndexedDB) de la app.
 *
 * Solo la capa `data` (repositorios) debe usar esta clase; la UI nunca habla
 * con Dexie directamente (repository pattern, ver CLAUDE.md).
 */
export class AppDb extends Dexie {
  // `declare` solo informa a TypeScript del tipo: no genera código. Si
  // usáramos `trips!: ...`, JavaScript crearía un campo de clase con valor
  // undefined que podría pisar la tabla que Dexie añade a la instancia.
  declare trips: EntityTable<Trip, 'id'>
  declare luggages: EntityTable<Luggage, 'id'>
  declare items: EntityTable<Item, 'id'>
  declare itemQuantities: EntityTable<ItemQuantity, 'id'>
  declare meta: EntityTable<MetaEntry, 'key'>

  // El nombre es configurable para que cada test use su propia base de datos.
  constructor(name: string = DEFAULT_DB_NAME) {
    super(name)

    /*
     * Esquema versionado: es el equivalente a las migraciones de Alembic.
     * Para cambiarlo NUNCA se edita una versión publicada: se añade
     * this.version(2).stores({...}).upgrade(tx => ...) y Dexie migra los datos
     * de quien tenga la versión 1 en su navegador.
     *
     * Sintaxis: el primer campo es la clave primaria y el resto son índices.
     * Solo se declaran los campos por los que vamos a BUSCAR u ORDENAR; el
     * resto (name, color, num…) se guarda igualmente, pero sin índice.
     *   '&campo'      → índice único
     *   '[a+b]'       → índice compuesto
     */
    this.version(1).stores({
      // startDate: para listar los viajes ordenados por fecha.
      trips: 'id, startDate',
      // tripId: clave foránea → buscar las maletas de un viaje.
      luggages: 'id, tripId',
      // Sin índices extra: el catálogo se ordena en memoria con
      // Intl.Collator('es'), porque IndexedDB ordena por código Unicode.
      items: 'id',
      // luggageId: contenido de una maleta.
      // itemId: en qué maletas aparece un ítem (p. ej. antes de borrarlo).
      // &[luggageId+itemId]: equivale a UNIQUE (luggage_id, item_id) en SQL:
      //   un mismo ítem no puede repetirse en una maleta (se sube `num`).
      itemQuantities: 'id, luggageId, itemId, &[luggageId+itemId]',
      meta: 'key',
    })
  }
}

/**
 * Instancia única para la app (patrón singleton a nivel de módulo).
 * Los tests NO la usan: crean su propia `new AppDb(nombreÚnico)`.
 */
export const db = new AppDb()

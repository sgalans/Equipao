import { Dexie, type EntityTable } from 'dexie'
import type { Item } from '@/features/items/domain/item'
import type { Compartment } from '@/features/luggage/domain/compartment'
import type { ItemQuantity } from '@/features/luggage/domain/itemQuantity'
import type { Luggage } from '@/features/luggage/domain/luggage'

/** Fila clave/valor para datos internos de la app (p. ej. el id de dispositivo). */
export interface MetaEntry {
  key: string
  value: string
}

export const DEFAULT_DB_NAME = 'luggage-app'

/*
 * Esquemas por versión: el equivalente a las migraciones de Alembic.
 * Una versión publicada (y la 1 ya está en navegadores con datos) NUNCA se
 * edita: cada cambio es una versión nueva con, si hace falta, su upgrade().
 * Exportados para que los tests puedan crear una base de datos ANTIGUA y
 * comprobar que se migra bien.
 *
 * Sintaxis: el primer campo es la clave primaria y el resto son índices.
 * Solo se declaran los campos por los que vamos a BUSCAR u ORDENAR; el
 * resto (name, num…) se guarda igualmente, pero sin índice.
 *   '&campo'      → índice único
 *   '[a+b]'       → índice compuesto
 */

/** v1 (iteraciones 1-4): maletas, catálogo y contenido. CONGELADA. */
export const SCHEMA_V1 = {
  // createdAt: para listar las maletas (las más recientes primero).
  luggages: 'id, createdAt',
  // Sin índices extra: el catálogo se ordena en memoria con
  // Intl.Collator('es'), porque IndexedDB ordena por código Unicode.
  items: 'id',
  // luggageId: contenido de una maleta.
  // itemId: en qué maletas aparece un ítem (p. ej. antes de borrarlo).
  // &[luggageId+itemId]: equivale a UNIQUE (luggage_id, item_id) en SQL:
  //   un mismo ítem no puede repetirse en una maleta (se sube `num`).
  itemQuantities: 'id, luggageId, itemId, &[luggageId+itemId]',
  meta: 'key',
}

/**
 * v2 (iteración 5): compartimentos. Solo se declaran las tablas que
 * cambian; el resto se hereda de la v1.
 */
export const SCHEMA_V2 = {
  // luggageId: compartimentos de una maleta.
  compartments: 'id, luggageId',
  // + compartmentId: contenido de un compartimento (al borrarlo, sus
  //   artículos pasan a sueltos). IndexedDB NO indexa filas cuyo valor es
  //   null, así que el índice solo contiene artículos en algún compartimento.
  itemQuantities: 'id, luggageId, itemId, compartmentId, &[luggageId+itemId]',
}

/**
 * Base de datos local (IndexedDB) de la app.
 *
 * Solo la capa `data` (repositorios) debe usar esta clase; la UI nunca habla
 * con Dexie directamente (repository pattern, ver CLAUDE.md).
 */
export class AppDb extends Dexie {
  // `declare` solo informa a TypeScript del tipo: no genera código. Si
  // usáramos `luggages!: ...`, JavaScript crearía un campo de clase con valor
  // undefined que podría pisar la tabla que Dexie añade a la instancia.
  declare luggages: EntityTable<Luggage, 'id'>
  declare items: EntityTable<Item, 'id'>
  declare itemQuantities: EntityTable<ItemQuantity, 'id'>
  declare compartments: EntityTable<Compartment, 'id'>
  declare meta: EntityTable<MetaEntry, 'key'>

  // El nombre es configurable para que cada test use su propia base de datos.
  constructor(name: string = DEFAULT_DB_NAME) {
    super(name)

    this.version(1).stores(SCHEMA_V1)

    this.version(2)
      .stores(SCHEMA_V2)
      // upgrade() se ejecuta UNA vez, en el navegador de quien tenga la v1,
      // dentro de una transacción: o se migra todo o nada. Los artículos que
      // ya existían no estaban en ningún compartimento → null (sueltos).
      .upgrade((tx) =>
        tx
          .table('itemQuantities')
          .toCollection()
          .modify((quantity: { compartmentId?: string | null }) => {
            quantity.compartmentId = null
          }),
      )
  }
}

/**
 * Instancia única para la app (patrón singleton a nivel de módulo).
 * Los tests NO la usan: crean su propia `new AppDb(nombreÚnico)`.
 */
export const db = new AppDb()

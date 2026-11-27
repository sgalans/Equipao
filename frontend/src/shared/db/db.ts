import { Dexie, type EntityTable, type Table, type Transaction } from 'dexie'
import { v7 as uuidv7 } from 'uuid'
import { isSameItemName } from '@/features/items/domain/itemName'
import { positionsAfter } from '@/features/luggage/domain/position'
import type { Item } from '@/features/items/domain/item'
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
 * v3 (iteración 8): descripción de la maleta y estado "listo" propio del
 * compartimento. Ningún índice cambia (no se busca ni se ordena por esos
 * campos), pero SÍ hay que transformar datos: las filas existentes no tienen
 * esos campos y el código cuenta con ellos (ver upgrade() en AppDb).
 */
export const SCHEMA_V3 = {}

/**
 * v4 (orden manual, arrastrando): `ItemQuantity.position` (fractional
 * indexing, ver domain/position.ts). Sin índice nuevo: se ordena en memoria
 * con sortBy dentro de cada maleta (listas cortas). Hay que dar posición a
 * las líneas existentes (ver upgrade() en AppDb).
 */
export const SCHEMA_V4 = {}

/**
 * v5 (ordenar compartimentos arrastrando): `Compartment.position`, igual que
 * las líneas en la v4. Nueva versión y no ampliar la v4: aunque la v4 aún no
 * esté publicada, ya puede estar en bases de datos de desarrollo, y una
 * versión que ya se ha abierto no vuelve a migrarse.
 */
export const SCHEMA_V5 = {}

/**
 * v6 (refactor/compartments): los compartimentos pasan a ser LÍNEAS de la
 * maleta cuyo artículo es un CONTENEDOR del catálogo (`Item.isContainer`;
 * patrón Composite). Ningún índice cambia; la conversión de datos está en
 * migrateCompartmentsToContainers. La tabla `compartments` NO se borra
 * aquí: se borra en la v7, para no depender de poder leer una tabla en la
 * misma versión en la que se elimina.
 */
export const SCHEMA_V6 = {}

/** v7: se elimina la tabla `compartments` (ya migrada en la v6). */
export const SCHEMA_V7 = { compartments: null }

/**
 * v8 (v1.1.1): solo DATOS, ningún índice cambia. La "Maleta básica" que
 * creó v1.0.0 recibe las instrucciones de uso nuevas, pero SOLO si su
 * descripción sigue siendo EXACTAMENTE la que puso la app: eso prueba que
 * nadie la ha editado. Si alguien cambió aunque sea una letra, no se toca
 * (nunca se pierde nada escrito por el usuario). Se busca por descripción y
 * no por nombre: la maleta pudo renombrarse, o una propia llamarse así.
 * Solo cambia la descripción: los artículos pueden estar personalizados.
 */
export const SCHEMA_V8 = {}

/** Descripción con la que v1.0.0 creaba la "Maleta básica". */
export const BASIC_DESCRIPTION_V1_0_0 =
  'Plantilla base: duplícala (⧉) para cada viaje.'

/**
 * Las instrucciones tal como eran al crear la v8: COPIA congelada a
 * propósito, no un import de defaultData. Una migración es una foto de un
 * momento (como en Alembic, que no importa los modelos de la app): si se
 * importara el texto vivo, cambiarlo mañana cambiaría también lo que hace
 * esta migración, y su test dejaría de describir lo que pasó.
 */
export const BASIC_DESCRIPTION_V8 = [
  'Instrucciones básicas de uso, ábreme :)',
  '',
  'Esta maleta sirve de plantilla, ajústala a tu gusto: añadiendo, quitando o renombrando artículos y compartimentos.',
  '',
  'Crea tu primera maleta: «Mis maletas» → «Nueva maleta», y en «Empezar con» elige esta.',
  '',
  'Trucos:',
  '• Toca la barra de progreso para ver todo lo que está listo.',
  '• El ojo oculta los artículos y compartimentos listos sin mover nada.',
  '• Toca un artículo para cambiar las unidades, renombrarlo o quitarlo.',
  '• Arrastra usando ≡ para ordenar (o ↑ ↓ al tocar un artículo).',
  '• ⋯ → Compartir: manda la lista por WhatsApp.',
  '• ⋯ → Reiniciar maleta: desmarca todo para reutilizarla.',
  '• Los compartimentos (neceser, mochila…) guardan artículos y se pliegan solos al estar todo listo.',
  '• Consulta todos tus artículos y compartimentos en el catálogo: «Mis maletas» → «Catálogo».',
  '',
  'Espero que esta aplicación te sea útil.',
  '¡Feliz viaje!',
].join('\n')

/** v8: instrucciones nuevas en la "Maleta básica" sin editar (ver SCHEMA_V8). */
function updateBasicInstructions(tx: Transaction) {
  const now = new Date().toISOString()
  return tx
    .table<Luggage>('luggages')
    .toCollection()
    .modify((luggage) => {
      if (luggage.description !== BASIC_DESCRIPTION_V1_0_0) return
      luggage.description = BASIC_DESCRIPTION_V8
      luggage.updatedAt = now
    })
}

interface LegacyCompartment {
  id: string
  luggageId: string
  name: string
  isReady: boolean
  position: string
  createdAt: string
  updatedAt: string
}

/**
 * Migración v6: cada compartimento se convierte en una línea contenedor.
 * - La línea conserva el MISMO id que el compartimento: sus artículos (que
 *   apuntan a él con compartmentId) no se tocan, y lo plegado u oculto en
 *   localStorage (claves por id) se conserva.
 * - El contenedor del catálogo se reutiliza entre maletas por nombre
 *   (isSameItemName: "Neceser" = "neceser").
 * - Si ya había un artículo NORMAL con ese nombre: si no se usa en ninguna
 *   maleta, se convierte en contenedor; si se usa, se crea el contenedor
 *   "Nombre (compartimento)" (un artículo en uso no puede pasar a contener
 *   cosas sin romper sus maletas).
 * - Un compartimento por maleta y contenedor: si una maleta tenía dos con el
 *   mismo nombre, el segundo se FUSIONA en el primero (sus artículos pasan a
 *   él).
 * - "Listo" del compartimento → la línea guardada (1 de 1).
 */
async function migrateCompartmentsToContainers(tx: Transaction) {
  const items: { id: string; name: string; isContainer?: boolean }[] = await tx
    .table('items')
    .toArray()
  const lines: { itemId: string; luggageId: string }[] = await tx
    .table('itemQuantities')
    .toArray()
  const compartments: LegacyCompartment[] = await tx
    .table('compartments')
    .toArray()
  compartments.sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || (a.id < b.id ? -1 : 1),
  )

  const usedItemIds = new Set(lines.map((line) => line.itemId))
  const containers: { id: string; name: string }[] = []
  const toConvert = new Set<string>()
  const newItems: object[] = []

  /** Contenedor del catálogo para un nombre (lo busca o lo crea). */
  function containerFor(compartment: LegacyCompartment): string {
    const name = compartment.name
    const known = containers.find((c) => isSameItemName(c.name, name))
    if (known) return known.id
    const existing = items.find((item) => isSameItemName(item.name, name))
    let id: string
    let finalName = name
    if (existing && !usedItemIds.has(existing.id)) {
      toConvert.add(existing.id)
      id = existing.id
      finalName = existing.name
    } else {
      if (existing) finalName = `${name} (compartimento)`
      id = uuidv7()
      newItems.push({
        id,
        name: finalName,
        isContainer: true,
        createdAt: compartment.createdAt,
        updatedAt: compartment.createdAt,
      })
    }
    containers.push({ id, name: finalName })
    return id
  }

  /** "maleta|contenedor" → id de la línea contenedor ya creada. */
  const lineByLuggageAndItem = new Map<string, string>()
  const newLines: object[] = []
  /** compartimento fusionado → línea en la que se fusiona. */
  const mergedInto = new Map<string, string>()

  for (const compartment of compartments) {
    const itemId = containerFor(compartment)
    const key = `${compartment.luggageId}|${itemId}`
    const existingLine = lineByLuggageAndItem.get(key)
    if (existingLine) {
      mergedInto.set(compartment.id, existingLine)
      continue
    }
    lineByLuggageAndItem.set(key, compartment.id)
    newLines.push({
      id: compartment.id,
      luggageId: compartment.luggageId,
      itemId,
      compartmentId: null,
      num: 1,
      nAlreadyPacked: compartment.isReady ? 1 : 0,
      position: compartment.position,
      createdAt: compartment.createdAt,
      updatedAt: compartment.updatedAt,
    })
  }

  await tx
    .table('items')
    .toCollection()
    .modify((item: { id: string; isContainer?: boolean }) => {
      item.isContainer = toConvert.has(item.id)
    })
  await tx.table('items').bulkAdd(newItems)
  await tx
    .table('itemQuantities')
    .toCollection()
    .modify((line: { compartmentId: string | null }) => {
      const target =
        line.compartmentId !== null
          ? mergedInto.get(line.compartmentId)
          : undefined
      if (target) line.compartmentId = target
    })
  await tx.table('itemQuantities').bulkAdd(newLines)
}

/**
 * Reparte claves de orden crecientes por maleta, en orden de añadido
 * (createdAt; empate → id, que es UUID v7). Lo usan las migraciones v4 y v5.
 */
async function assignPositionsByCreation(table: Table) {
  const rows: { id: string; luggageId: string; createdAt: string }[] =
    await table.toArray()
  const byLuggage = new Map<string, typeof rows>()
  for (const row of rows) {
    byLuggage.set(row.luggageId, [...(byLuggage.get(row.luggageId) ?? []), row])
  }
  const positionById = new Map<string, string>()
  for (const group of byLuggage.values()) {
    group.sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || (a.id < b.id ? -1 : 1),
    )
    const keys = positionsAfter(null, group.length)
    group.forEach((row, index) => positionById.set(row.id, keys[index]))
  }
  await table
    .toCollection()
    .modify((row: { id: string; position?: string }) => {
      row.position = positionById.get(row.id)
    })
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

    this.version(3)
      .stores(SCHEMA_V3)
      // Dos tablas en la misma migración: los cambios de esquema de una
      // misma entrega se agrupan (como una migración de Alembic). Todo en la
      // transacción del upgrade: o se migran las dos o ninguna.
      .upgrade(async (tx) => {
        await tx
          .table('luggages')
          .toCollection()
          .modify((luggage: { description?: string }) => {
            luggage.description = ''
          })
        await tx
          .table('compartments')
          .toCollection()
          .modify((compartment: { isReady?: boolean }) => {
            compartment.isReady = false
          })
      })

    this.version(4)
      .stores(SCHEMA_V4)
      // Cada maleta conserva el orden que tenía (el de añadido).
      .upgrade((tx) => assignPositionsByCreation(tx.table('itemQuantities')))

    this.version(5)
      .stores(SCHEMA_V5)
      .upgrade((tx) => assignPositionsByCreation(tx.table('compartments')))

    this.version(6)
      .stores(SCHEMA_V6)
      .upgrade((tx) => migrateCompartmentsToContainers(tx))

    this.version(7).stores(SCHEMA_V7)

    this.version(8)
      .stores(SCHEMA_V8)
      .upgrade((tx) => updateBasicInstructions(tx))
  }
}

/**
 * Instancia única para la app (patrón singleton a nivel de módulo).
 * Los tests NO la usan: crean su propia `new AppDb(nombreÚnico)`.
 */
export const db = new AppDb()

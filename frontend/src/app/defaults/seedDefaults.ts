import type { AppDb } from '@/shared/db/db'
import type { Repositories } from '@/shared/di/repositories'
import { BASIC_LUGGAGE, DEFAULT_CATALOG } from './defaultData'

/** Marca en la tabla `meta`: los datos por defecto ya se crearon. */
export const DEFAULTS_SEEDED_KEY = 'defaultsSeeded'

/**
 * Crea el catálogo por defecto y la "Maleta básica" UNA sola vez por
 * dispositivo. Reglas (decisión de producto):
 * - Solo la primera vez: la marca en `meta` lo recuerda. Si el usuario
 *   borra la maleta o algún artículo, NO vuelven a aparecer.
 * - Sin duplicar: si ya existe un artículo con ese nombre (p. ej. quien ya
 *   usaba la app), se reutiliza.
 * - Atómico: todo, marca incluida, en UNA transacción. Si algo fallara a
 *   medias no queda una maleta a medio crear, y se reintentará al volver a
 *   abrir la app.
 *
 * Vive en `app/` (arranque de la app) y recibe la db y los repositorios por
 * parámetro (inyección de dependencias): así se prueba con una db aislada.
 * Devuelve el id de la "Maleta básica" que acaba de crear, o null si no ha
 * creado nada: así el arranque puede mostrar sus instrucciones abiertas
 * (estado de UI) sin que esta función sepa nada de la interfaz.
 */
export async function seedDefaults(
  db: AppDb,
  repositories: Repositories,
): Promise<string | null> {
  const { items, luggages, compartments, quantities } = repositories

  // Las llamadas a los repositorios abren sus propias transacciones; dentro
  // de esta se "unen" a ella (Dexie permite transacciones anidadas sobre un
  // subconjunto de tablas), así que todo es una única unidad atómica.
  return db.transaction(
    'rw',
    [db.meta, db.items, db.luggages, db.itemQuantities],
    async () => {
      if (await db.meta.get(DEFAULTS_SEEDED_KEY)) return null

      // Catálogo: reutiliza lo que ya exista con ese nombre.
      const idByName = new Map<string, string>()
      for (const name of DEFAULT_CATALOG) {
        const item =
          (await items.findByName(name)) ?? (await items.create({ name }))
        idByName.set(name, item.id)
      }
      const idsOf = (names: readonly string[]) =>
        names.map((name) => {
          const id = idByName.get(name)
          // Error de programación: la plantilla usa un nombre que no está en
          // el catálogo por defecto (el test de defaultData lo impide).
          if (!id) throw new Error(`«${name}» no está en DEFAULT_CATALOG`)
          return id
        })

      // Maleta básica: sueltos + compartimentos con su contenido.
      const luggage = await luggages.create({
        name: BASIC_LUGGAGE.name,
        description: BASIC_LUGGAGE.description,
      })
      await quantities.addMany(luggage.id, idsOf(BASIC_LUGGAGE.loose))
      for (const {
        name,
        items: compartmentItems,
      } of BASIC_LUGGAGE.compartments) {
        const compartment = await compartments.create({
          luggageId: luggage.id,
          name,
        })
        await quantities.addMany(
          luggage.id,
          idsOf(compartmentItems),
          compartment.id,
        )
      }

      await db.meta.put({
        key: DEFAULTS_SEEDED_KEY,
        value: new Date().toISOString(),
      })
      return luggage.id
    },
  )
}

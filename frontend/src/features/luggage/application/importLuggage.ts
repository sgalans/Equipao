import type { ItemRepository } from '@/features/items/domain/itemRepository'
import type { CompartmentRepository } from '../domain/compartmentRepository'
import type { ItemQuantityRepository } from '../domain/itemQuantityRepository'
import type { Luggage } from '../domain/luggage'
import type { LuggageRepository } from '../domain/luggageRepository'
import type { LuggageText } from '../domain/luggageText'
import { DuplicateError } from '@/shared/domain/errors'
import { addItemByName } from './addItemByName'

/** Nombre si el texto no traía "🧳 Nombre" (una lista cualquiera). */
export const IMPORTED_LUGGAGE_NAME = 'Maleta importada'

/**
 * Caso de uso "importar una maleta desde texto" (ver domain/luggageText).
 *
 * Crea SIEMPRE una maleta nueva (nunca pisa nada), con sus compartimentos y
 * artículos, sin nada guardado. Los artículos se reutilizan del catálogo por
 * nombre ("calcetines" = "Calcetines") y solo se crean los que faltan
 * (addItemByName).
 *
 * Cada repositorio abre sus propias transacciones, así que la importación
 * entera NO es atómica. Si algo falla a medias, se BORRA la maleta recién
 * creada (su borrado en cascada se lleva compartimentos y líneas): una
 * "acción compensatoria", como en el patrón saga. Los artículos que se
 * hubieran creado en el catálogo se quedan: no molestan y se reutilizarán.
 */
export async function importLuggage(
  repositories: {
    luggages: LuggageRepository
    compartments: CompartmentRepository
    items: ItemRepository
    quantities: ItemQuantityRepository
  },
  luggageText: LuggageText,
): Promise<Luggage> {
  const { luggages, compartments } = repositories

  /**
   * Si el nombre es el de un artículo NORMAL del catálogo (no puede ser un
   * compartimento), se crea «Nombre (compartimento)», como en la migración
   * v6: mejor eso que hacer fallar toda la importación.
   */
  async function createCompartment(luggageId: string, name: string) {
    try {
      return await compartments.create({ luggageId, name })
    } catch (error) {
      if (!(error instanceof DuplicateError)) throw error
      return compartments.create({ luggageId, name: `${name} (compartimento)` })
    }
  }
  const luggage = await luggages.create({
    name: luggageText.name ?? IMPORTED_LUGGAGE_NAME,
  })

  try {
    for (const item of luggageText.loose) {
      await addItemByName(repositories, luggage.id, item.name, null, item.num)
    }
    for (const block of luggageText.compartments) {
      const compartment = await createCompartment(luggage.id, block.name)
      for (const item of block.items) {
        await addItemByName(
          repositories,
          luggage.id,
          item.name,
          compartment.id,
          item.num,
        )
      }
    }
  } catch (error) {
    await luggages.remove(luggage.id)
    throw error
  }
  return luggage
}

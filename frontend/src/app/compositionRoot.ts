import { createDexieItemRepository } from '@/features/items/data/dexieItemRepository'
import { createDexieCompartmentRepository } from '@/features/luggage/data/dexieCompartmentRepository'
import { createDexieItemQuantityRepository } from '@/features/luggage/data/dexieItemQuantityRepository'
import { createDexieLuggageRepository } from '@/features/luggage/data/dexieLuggageRepository'
import type { AppDb } from '@/shared/db/db'
import type { Repositories } from '@/shared/di/repositories'

/**
 * Composition root: el ÚNICO sitio donde se eligen las implementaciones
 * concretas. En la fase 2 bastará con cambiar este fichero para usar
 * repositorios contra la API (o una mezcla) sin tocar ningún componente.
 */
export function createDexieRepositories(db: AppDb): Repositories {
  return {
    luggages: createDexieLuggageRepository(db),
    quantities: createDexieItemQuantityRepository(db),
    compartments: createDexieCompartmentRepository(db),
    items: createDexieItemRepository(db),
  }
}

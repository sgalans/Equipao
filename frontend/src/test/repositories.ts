import { onTestFinished, vi } from 'vitest'
import { createDexieItemRepository } from '@/features/items/data/dexieItemRepository'
import { createDexieCompartmentRepository } from '@/features/luggage/data/dexieCompartmentRepository'
import { createDexieItemQuantityRepository } from '@/features/luggage/data/dexieItemQuantityRepository'
import { createDexieLuggageRepository } from '@/features/luggage/data/dexieLuggageRepository'
import { createTestDb } from './db'

/**
 * Base de datos aislada + todos los repositorios conectados a ella.
 * Es la "composition root" de los tests: el único sitio donde se cablean
 * las dependencias (en la app será src/app/).
 */
export function createTestRepositories() {
  const db = createTestDb()
  return {
    db,
    luggages: createDexieLuggageRepository(db),
    quantities: createDexieItemQuantityRepository(db),
    compartments: createDexieCompartmentRepository(db),
    items: createDexieItemRepository(db),
  }
}

/**
 * Congela el reloj (solo `Date`, no los temporizadores, que IndexedDB
 * necesita) en el instante dado. Se restaura solo al acabar el test.
 */
export function freezeTime(iso: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(iso))
  onTestFinished(() => {
    vi.useRealTimers()
  })
}

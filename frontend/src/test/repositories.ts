import { onTestFinished, vi } from 'vitest'
import { createDexieItemRepository } from '@/features/items/data/dexieItemRepository'
import { createDexieItemQuantityRepository } from '@/features/luggage/data/dexieItemQuantityRepository'
import { createDexieLuggageRepository } from '@/features/luggage/data/dexieLuggageRepository'
import { createDexieTripRepository } from '@/features/trips/data/dexieTripRepository'
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
    trips: createDexieTripRepository(db),
    luggages: createDexieLuggageRepository(db),
    quantities: createDexieItemQuantityRepository(db),
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

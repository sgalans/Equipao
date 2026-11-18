import { createContext, useContext } from 'react'
import type { ItemRepository } from '@/features/items/domain/itemRepository'
import type { ItemQuantityRepository } from '@/features/luggage/domain/itemQuantityRepository'
import type { LuggageRepository } from '@/features/luggage/domain/luggageRepository'
import type { TripRepository } from '@/features/trips/domain/tripRepository'

/**
 * Contrato con todos los repositorios de la app. Solo conoce las INTERFACES
 * (ports), nunca Dexie: así la UI no sabe cómo se guardan los datos.
 */
export interface Repositories {
  trips: TripRepository
  luggages: LuggageRepository
  quantities: ItemQuantityRepository
  items: ItemRepository
}

/**
 * Inyección de dependencias al estilo React: el valor lo pone la composition
 * root (src/app/) en la app y un helper de test en los tests.
 * `null` por defecto para detectar si alguien olvida el Provider.
 */
export const RepositoriesContext = createContext<Repositories | null>(null)

/** Hook para que los componentes obtengan los repositorios. */
export function useRepositories(): Repositories {
  const repositories = useContext(RepositoriesContext)
  if (!repositories) {
    // Fail fast: un error claro es mejor que un "cannot read property of null".
    throw new Error('useRepositories debe usarse dentro de RepositoriesContext')
  }
  return repositories
}

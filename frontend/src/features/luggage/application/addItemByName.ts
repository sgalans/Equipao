import type { ItemRepository } from '@/features/items/domain/itemRepository'
import { NameSchema } from '@/shared/domain/schemas'
import type { ItemQuantity } from '../domain/itemQuantity'
import type { ItemQuantityRepository } from '../domain/itemQuantityRepository'

/**
 * Caso de uso "añadir un artículo a la maleta escribiendo su nombre".
 *
 * Capa `application` (clean architecture): coordina varios repositorios y no
 * pertenece a ninguno. Solo conoce los PORTS, así que funcionaría igual con
 * repositorios contra una API.
 *
 * 1. Reutiliza el artículo del catálogo si ya existe ("calcetines" =
 *    "Calcetines"); si no, lo crea: el catálogo se llena solo.
 * 2. Lo añade a la maleta con la cantidad indicada (1 por defecto), suelto
 *    o en el compartimento indicado.
 *
 * Si ya estaba en la maleta, quantities.add lanza DuplicateError (índice
 * único) y la UI lo avisa. El orden importa: un artículo NUEVO nunca puede
 * estar ya en la maleta, así que no queda basura en el catálogo por un
 * duplicado.
 */
export async function addItemByName(
  repositories: { items: ItemRepository; quantities: ItemQuantityRepository },
  luggageId: string,
  rawName: string,
  compartmentId: string | null = null,
  num = 1,
): Promise<ItemQuantity> {
  const { items, quantities } = repositories
  const name = NameSchema.parse(rawName)

  const item = (await items.findByName(name)) ?? (await items.create({ name }))
  return quantities.add({
    luggageId,
    itemId: item.id,
    compartmentId,
    num,
    nAlreadyPacked: 0,
  })
}

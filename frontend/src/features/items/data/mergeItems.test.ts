import { describe, expect, it } from 'vitest'
import { ConsistencyError } from '@/shared/domain/errors'
import { createTestRepositories } from '@/test/repositories'

/*
 * Unir artículos del catálogo ("peolota" → "pelota", decisión del usuario):
 * queda solo el destino, en todas las maletas.
 */

async function setup() {
  const repos = createTestRepositories()
  const [big, small] = [
    await repos.luggages.create({ name: 'Grande' }),
    await repos.luggages.create({ name: 'Pequeña' }),
  ]
  const typo = await repos.items.create({ name: 'Peolota' })
  const ball = await repos.items.create({ name: 'Pelota' })
  const put = (luggageId: string, itemId: string, num = 1, packed = 0) =>
    repos.quantities.add({ luggageId, itemId, num, nAlreadyPacked: packed })
  return { ...repos, big, small, typo, ball, put }
}

describe('items.merge', () => {
  it('donde estaba el origen pasa a estar el destino, y el origen desaparece del catálogo', async () => {
    const { items, quantities, small, typo, ball, put } = await setup()
    await put(small.id, typo.id, 2)

    await items.merge(typo.id, ball.id)

    expect((await items.list()).map((i) => i.name)).toEqual(['Pelota'])
    const [line] = await quantities.listEntriesByLuggage(small.id)
    expect(line).toMatchObject({ itemName: 'Pelota', num: 2 })
  })

  it('una maleta con los dos queda con UNA línea: cantidad mayor, guardada solo si lo estaban las dos', async () => {
    const { items, quantities, big, typo, ball, put } = await setup()
    await put(big.id, ball.id, 1, 1) // guardada
    await put(big.id, typo.id, 3, 0) // sin guardar

    await items.merge(typo.id, ball.id)

    const lines = await quantities.listByLuggage(big.id)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      itemId: ball.id,
      num: 3,
      nAlreadyPacked: 0,
    })
  })

  it('dos compartimentos en una maleta: queda uno con los artículos de los dos', async () => {
    const { items, compartments, quantities, big } = await setup()
    const kit = await compartments.create({
      luggageId: big.id,
      name: 'Neceser',
    })
    const typoKit = await compartments.create({
      luggageId: big.id,
      name: 'Necesr',
    })
    const [brush, paste] = [
      await items.create({ name: 'Cepillo' }),
      await items.create({ name: 'Pasta' }),
    ]
    await quantities.addMany(big.id, [brush.id], kit.id)
    await quantities.addMany(big.id, [paste.id], typoKit.id)

    await items.merge(typoKit.itemId, kit.itemId)

    const [only] = await compartments.listByLuggage(big.id)
    expect(only.name).toBe('Neceser')
    const lines = await quantities.listByLuggage(big.id)
    expect(lines.every((line) => line.compartmentId === only.id)).toBe(true)
    expect(lines).toHaveLength(2)
  })

  it('no se mezclan artículos y compartimentos', async () => {
    const { items, compartments, big, ball } = await setup()
    const kit = await compartments.create({
      luggageId: big.id,
      name: 'Neceser',
    })

    await expect(items.merge(ball.id, kit.itemId)).rejects.toThrow(
      ConsistencyError,
    )
  })

  it('unir algo consigo mismo no hace nada', async () => {
    const { items, ball } = await setup()

    await items.merge(ball.id, ball.id)

    expect(await items.getById(ball.id)).toBeDefined()
  })
})

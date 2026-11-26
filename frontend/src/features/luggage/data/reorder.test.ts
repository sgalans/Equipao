import { describe, expect, it } from 'vitest'
import { ConsistencyError, EntityNotFoundError } from '@/shared/domain/errors'
import { createTestRepositories } from '@/test/repositories'

const MISSING_ID = '0190a0a0-0000-7000-8000-000000000000'

/** Maleta con A, B, C, D (en ese orden) y otra maleta con X. */
async function setup() {
  const repos = createTestRepositories()
  const luggage = await repos.luggages.create({ name: 'Grande' })
  const other = await repos.luggages.create({ name: 'Otra' })
  const line = async (luggageId: string, name: string) => {
    const item = await repos.items.create({ name })
    return repos.quantities.add({
      luggageId,
      itemId: item.id,
      num: 1,
      nAlreadyPacked: 0,
    })
  }
  const [a, b, c, d] = [
    await line(luggage.id, 'A'),
    await line(luggage.id, 'B'),
    await line(luggage.id, 'C'),
    await line(luggage.id, 'D'),
  ]
  const x = await line(other.id, 'X')
  const order = async () =>
    (await repos.quantities.listEntriesByLuggage(luggage.id)).map(
      (entry) => entry.itemName,
    )
  return { ...repos, luggage, a, b, c, d, x, order }
}

describe('Orden manual (position)', () => {
  it('lo añadido va al final, también al añadir varios de golpe', async () => {
    const repos = await setup()
    const [e, f] = [
      await repos.items.create({ name: 'E' }),
      await repos.items.create({ name: 'F' }),
    ]

    await repos.quantities.addMany(repos.luggage.id, [e.id, f.id])

    expect(await repos.order()).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
  })

  it('reorder coloca una línea entre dos y solo cambia ESA fila', async () => {
    const { quantities, a, b, d, order, luggage } = await setup()
    const before = await quantities.listByLuggage(luggage.id)

    await quantities.reorder(d.id, a.id, b.id)

    expect(await order()).toEqual(['A', 'D', 'B', 'C'])
    const after = await quantities.listByLuggage(luggage.id)
    const changed = after.filter(
      (row) =>
        before.find((old) => old.id === row.id)?.position !== row.position,
    )
    expect(changed.map((row) => row.id)).toEqual([d.id])
  })

  it('null = al principio o al final', async () => {
    const { quantities, a, c, d, order } = await setup()

    await quantities.reorder(c.id, null, a.id)
    expect(await order()).toEqual(['C', 'A', 'B', 'D'])

    await quantities.reorder(a.id, d.id, null)
    expect(await order()).toEqual(['C', 'B', 'D', 'A'])
  })

  it('al duplicar, la copia conserva el orden manual', async () => {
    const { quantities, luggages, luggage, a, d } = await setup()
    await quantities.reorder(d.id, null, a.id)

    const copy = await luggages.duplicate(luggage.id)

    expect(
      (await quantities.listEntriesByLuggage(copy.id)).map((e) => e.itemName),
    ).toEqual(['D', 'A', 'B', 'C'])
  })

  it('rechaza líneas inexistentes o de otra maleta', async () => {
    const { quantities, a, b, x } = await setup()

    await expect(quantities.reorder(MISSING_ID, a.id, b.id)).rejects.toThrow(
      EntityNotFoundError,
    )
    await expect(quantities.reorder(a.id, MISSING_ID, null)).rejects.toThrow(
      EntityNotFoundError,
    )
    await expect(quantities.reorder(a.id, x.id, null)).rejects.toThrow(
      ConsistencyError,
    )
  })
})

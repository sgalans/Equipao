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

describe('Orden manual de compartimentos', () => {
  /** Maleta con los compartimentos Neceser, Mochila y Bolsa (en ese orden). */
  async function withCompartments() {
    const repos = createTestRepositories()
    const luggage = await repos.luggages.create({ name: 'Grande' })
    const [kit, bag, sack] = [
      await repos.compartments.create({
        luggageId: luggage.id,
        name: 'Neceser',
      }),
      await repos.compartments.create({
        luggageId: luggage.id,
        name: 'Mochila',
      }),
      await repos.compartments.create({ luggageId: luggage.id, name: 'Bolsa' }),
    ]
    const order = async () =>
      (await repos.compartments.listByLuggage(luggage.id)).map((c) => c.name)
    return { ...repos, luggage, kit, bag, sack, order }
  }

  it('los nuevos van al final y reorder los coloca entre dos', async () => {
    const { compartments, kit, sack, order } = await withCompartments()
    expect(await order()).toEqual(['Neceser', 'Mochila', 'Bolsa'])

    await compartments.reorder(sack.id, null, kit.id)

    expect(await order()).toEqual(['Bolsa', 'Neceser', 'Mochila'])
  })

  it('al duplicar, la copia conserva el orden de los compartimentos', async () => {
    const { compartments, luggages, luggage, kit, sack } =
      await withCompartments()
    await compartments.reorder(sack.id, null, kit.id)

    const copy = await luggages.duplicate(luggage.id)

    expect(
      (await compartments.listByLuggage(copy.id)).map((c) => c.name),
    ).toEqual(['Bolsa', 'Neceser', 'Mochila'])
  })

  it('rechaza compartimentos inexistentes', async () => {
    const { compartments, kit } = await withCompartments()

    await expect(
      compartments.reorder(kit.id, MISSING_ID, null),
    ).rejects.toThrow(EntityNotFoundError)
  })
})

describe('place (arrastrar entre grupos)', () => {
  it('mete la línea en un compartimento, entre dos, en una sola escritura', async () => {
    const repos = createTestRepositories()
    const luggage = await repos.luggages.create({ name: 'Grande' })
    const kit = await repos.compartments.create({
      luggageId: luggage.id,
      name: 'Neceser',
    })
    const line = async (name: string, compartmentId: string | null) => {
      const item = await repos.items.create({ name })
      return repos.quantities.add({
        luggageId: luggage.id,
        itemId: item.id,
        compartmentId,
        num: 1,
        nAlreadyPacked: 0,
      })
    }
    const loose = await line('Suelto', null)
    const brush = await line('Cepillo', kit.id)
    const paste = await line('Pasta', kit.id)

    const placed = await repos.quantities.place(
      loose.id,
      kit.id,
      brush.id,
      paste.id,
    )

    expect(placed.compartmentId).toBe(kit.id)
    const inKit = (await repos.quantities.listEntriesByLuggage(luggage.id))
      .filter((e) => e.compartmentId === kit.id)
      .map((e) => e.itemName)
    expect(inKit).toEqual(['Cepillo', 'Suelto', 'Pasta'])

    // Y de vuelta a suelto (sin vecinos: solo).
    expect(
      (await repos.quantities.place(loose.id, null, null, null)).compartmentId,
    ).toBeNull()
  })

  it('rechaza un compartimento de otra maleta', async () => {
    const repos = createTestRepositories()
    const luggage = await repos.luggages.create({ name: 'Grande' })
    const other = await repos.luggages.create({ name: 'Otra' })
    const foreign = await repos.compartments.create({
      luggageId: other.id,
      name: 'Ajeno',
    })
    const item = await repos.items.create({ name: 'A' })
    const a = await repos.quantities.add({
      luggageId: luggage.id,
      itemId: item.id,
      num: 1,
      nAlreadyPacked: 0,
    })

    await expect(
      repos.quantities.place(a.id, foreign.id, null, null),
    ).rejects.toThrow(ConsistencyError)
  })
})

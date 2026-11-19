import { describe, expect, it } from 'vitest'
import { ConsistencyError, EntityNotFoundError } from '@/shared/domain/errors'
import { createTestRepositories } from '@/test/repositories'

const MISSING_ID = '0190a0a0-0000-7000-8000-000000000000'

/** Maleta con 3 artículos sueltos (Cepillo, Pasta, Toalla) y un "Neceser". */
async function setup() {
  const repos = createTestRepositories()
  const luggage = await repos.luggages.create({ name: 'Mochila' })
  const kit = await repos.compartments.create({
    luggageId: luggage.id,
    name: 'Neceser',
  })
  const names = ['Cepillo', 'Pasta', 'Toalla']
  const ids: string[] = []
  for (const name of names) {
    const item = await repos.items.create({ name })
    ids.push(item.id)
  }
  const { added } = await repos.quantities.addMany(luggage.id, ids)
  const [brush, paste, towel] = added
  return { ...repos, luggage, kit, brush, paste, towel }
}

/** Otra maleta con un artículo, para probar la mezcla de maletas. */
async function otherLuggageLine(repos: Awaited<ReturnType<typeof setup>>) {
  const other = await repos.luggages.create({ name: 'Otra' })
  const item = await repos.items.create({ name: 'Libro' })
  const { added } = await repos.quantities.addMany(other.id, [item.id])
  return { other, line: added[0] }
}

describe('quantities.moveMany', () => {
  it('mueve varios a un compartimento y luego a sueltos', async () => {
    const { quantities, luggage, kit, brush, paste, towel } = await setup()

    await quantities.moveMany([brush.id, paste.id], kit.id)
    let lines = await quantities.listByLuggage(luggage.id)
    expect(lines.map((q) => q.compartmentId)).toEqual([kit.id, kit.id, null])

    await quantities.moveMany([brush.id], null)
    lines = await quantities.listByLuggage(luggage.id)
    expect(lines.find((q) => q.id === brush.id)?.compartmentId).toBeNull()
    expect(lines.find((q) => q.id === towel.id)?.compartmentId).toBeNull()
  })

  it('no toca cantidades ni lo ya guardado', async () => {
    const { quantities, kit, brush } = await setup()
    await quantities.resize(brush.id, 3)
    await quantities.togglePacked(brush.id)

    const [moved] = await quantities.moveMany([brush.id], kit.id)

    expect(moved).toMatchObject({ num: 3, nAlreadyPacked: 3 })
  })

  it('todo o nada: si una línea no existe, no mueve ninguna', async () => {
    const { quantities, luggage, kit, brush } = await setup()

    await expect(
      quantities.moveMany([brush.id, MISSING_ID], kit.id),
    ).rejects.toBeInstanceOf(EntityNotFoundError)
    const lines = await quantities.listByLuggage(luggage.id)
    expect(lines.every((q) => q.compartmentId === null)).toBe(true)
  })

  it('rechaza mezclar artículos de maletas distintas', async () => {
    const repos = await setup()
    const { line } = await otherLuggageLine(repos)

    await expect(
      repos.quantities.moveMany([repos.brush.id, line.id], null),
    ).rejects.toBeInstanceOf(ConsistencyError)
  })

  it('rechaza un compartimento de otra maleta', async () => {
    const repos = await setup()
    const { other } = await otherLuggageLine(repos)
    const otherKit = await repos.compartments.create({
      luggageId: other.id,
      name: 'Neceser',
    })

    await expect(
      repos.quantities.moveMany([repos.brush.id], otherKit.id),
    ).rejects.toBeInstanceOf(ConsistencyError)
  })
})

describe('quantities.removeMany', () => {
  it('quita varios de golpe; el catálogo no cambia', async () => {
    const { quantities, items, luggage, brush, paste, towel } = await setup()

    await quantities.removeMany([brush.id, paste.id])

    expect(
      (await quantities.listByLuggage(luggage.id)).map((q) => q.id),
    ).toEqual([towel.id])
    expect(await items.list()).toHaveLength(3)
  })

  it('es idempotente: quitar algo que ya no está no falla', async () => {
    const { quantities, brush } = await setup()
    await quantities.removeMany([brush.id])

    await expect(
      quantities.removeMany([brush.id, MISSING_ID]),
    ).resolves.toBeUndefined()
  })
})

describe('compartments.createWithQuantities ("mover a un compartimento nuevo")', () => {
  it('crea el compartimento y mete en él los artículos', async () => {
    const { compartments, quantities, luggage, brush, paste } = await setup()

    const created = await compartments.createWithQuantities(
      { luggageId: luggage.id, name: ' Aseo ' },
      [brush.id, paste.id],
    )

    expect(created).toMatchObject({ name: 'Aseo', isReady: false })
    const lines = await quantities.listByLuggage(luggage.id)
    expect(lines.filter((q) => q.compartmentId === created.id)).toHaveLength(2)
  })

  it('todo o nada: si un artículo no existe, no crea el compartimento', async () => {
    const { compartments, luggage, brush } = await setup()

    await expect(
      compartments.createWithQuantities(
        { luggageId: luggage.id, name: 'Aseo' },
        [brush.id, MISSING_ID],
      ),
    ).rejects.toBeInstanceOf(EntityNotFoundError)
    // Solo sigue el "Neceser" de antes: ningún compartimento a medias.
    expect(
      (await compartments.listByLuggage(luggage.id)).map((c) => c.name),
    ).toEqual(['Neceser'])
  })

  it('rechaza artículos de otra maleta', async () => {
    const repos = await setup()
    const { line } = await otherLuggageLine(repos)

    await expect(
      repos.compartments.createWithQuantities(
        { luggageId: repos.luggage.id, name: 'Aseo' },
        [line.id],
      ),
    ).rejects.toBeInstanceOf(ConsistencyError)
  })
})

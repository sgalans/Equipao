import { describe, expect, it } from 'vitest'
import { ConsistencyError, DuplicateError } from '@/shared/domain/errors'
import { createTestRepositories } from '@/test/repositories'

/*
 * Reglas del modelo nuevo (refactor/compartments): un compartimento es una
 * LÍNEA cuyo artículo del catálogo es un CONTENEDOR (patrón Composite).
 */

async function setup() {
  const repos = createTestRepositories()
  const big = await repos.luggages.create({ name: 'Grande' })
  const small = await repos.luggages.create({ name: 'Pequeña' })
  return { ...repos, big, small }
}

describe('Compartimentos como contenedores del catálogo', () => {
  it('el mismo nombre en dos maletas reutiliza UN contenedor del catálogo', async () => {
    const { compartments, items, big, small } = await setup()

    await compartments.create({ luggageId: big.id, name: 'Neceser' })
    await compartments.create({ luggageId: small.id, name: 'neceser' })

    const catalog = await items.list()
    expect(catalog).toEqual([
      expect.objectContaining({ name: 'Neceser', isContainer: true }),
    ])
  })

  it('un Neceser por maleta: el segundo se rechaza', async () => {
    const { compartments, big } = await setup()
    await compartments.create({ luggageId: big.id, name: 'Neceser' })

    await expect(
      compartments.create({ luggageId: big.id, name: 'Neceser' }),
    ).rejects.toThrow(DuplicateError)
  })

  it('no se puede crear un compartimento con el nombre de un artículo normal', async () => {
    const { compartments, items, big } = await setup()
    await items.create({ name: 'Toalla' })

    await expect(
      compartments.create({ luggageId: big.id, name: 'Toalla' }),
    ).rejects.toThrow(DuplicateError)
  })

  it('renombrar un compartimento lo renombra en TODAS las maletas', async () => {
    const { compartments, big, small } = await setup()
    const kit = await compartments.create({
      luggageId: big.id,
      name: 'Neceser',
    })
    await compartments.create({ luggageId: small.id, name: 'Neceser' })

    await compartments.update(kit.id, { name: 'Bolsa de aseo' })

    const [other] = await compartments.listByLuggage(small.id)
    expect(other.name).toBe('Bolsa de aseo')
  })

  it('"listo" del compartimento = su línea guardada', async () => {
    const { compartments, big } = await setup()
    const kit = await compartments.create({
      luggageId: big.id,
      name: 'Neceser',
    })

    expect((await compartments.toggleReady(kit.id)).isReady).toBe(true)
    expect((await compartments.toggleReady(kit.id)).isReady).toBe(false)
  })

  it('las líneas de la maleta (artículos) no incluyen los compartimentos', async () => {
    const { compartments, quantities, items, big } = await setup()
    await compartments.create({ luggageId: big.id, name: 'Neceser' })
    const towel = await items.create({ name: 'Toalla' })
    await quantities.add({
      luggageId: big.id,
      itemId: towel.id,
      num: 1,
      nAlreadyPacked: 0,
    })

    expect(
      (await quantities.listEntriesByLuggage(big.id)).map((e) => e.itemName),
    ).toEqual(['Toalla'])
  })
})

describe('Un solo nivel', () => {
  it('un contenedor no puede ir dentro de otro compartimento', async () => {
    const { compartments, items, quantities, big } = await setup()
    const kit = await compartments.create({
      luggageId: big.id,
      name: 'Neceser',
    })
    const bag = await items.create({ name: 'Mochila', isContainer: true })

    await expect(
      quantities.add({
        luggageId: big.id,
        itemId: bag.id,
        compartmentId: kit.id,
        num: 1,
        nAlreadyPacked: 0,
      }),
    ).rejects.toThrow(ConsistencyError)
  })

  it('addMany con contenedores los deja como compartimentos de primer nivel', async () => {
    const { compartments, items, quantities, big } = await setup()
    const kit = await compartments.create({
      luggageId: big.id,
      name: 'Neceser',
    })
    const bag = await items.create({ name: 'Mochila', isContainer: true })
    const brush = await items.create({ name: 'Cepillo' })

    // "Añadir estos al Neceser" con una Mochila en medio: la Mochila va
    // como compartimento de la maleta; el Cepillo, dentro del Neceser.
    await quantities.addMany(big.id, [bag.id, brush.id], kit.id)

    expect(
      (await compartments.listByLuggage(big.id)).map((c) => c.name),
    ).toEqual(['Neceser', 'Mochila'])
    const [brushLine] = await quantities.listByLuggage(big.id)
    expect(brushLine?.compartmentId).toBe(kit.id)
  })

  it('un artículo normal no es un compartimento válido para meter cosas', async () => {
    const { items, quantities, big } = await setup()
    const towel = await items.create({ name: 'Toalla' })
    const sock = await items.create({ name: 'Calcetines' })
    const towelLine = await quantities.add({
      luggageId: big.id,
      itemId: towel.id,
      num: 1,
      nAlreadyPacked: 0,
    })

    await expect(
      quantities.addMany(big.id, [sock.id], towelLine.id),
    ).rejects.toThrow(ConsistencyError)
  })
})

describe('Borrar', () => {
  it('borrar del catálogo un contenedor en uso deja sus artículos sueltos', async () => {
    const { compartments, items, quantities, big } = await setup()
    const kit = await compartments.create({
      luggageId: big.id,
      name: 'Neceser',
    })
    const brush = await items.create({ name: 'Cepillo' })
    await quantities.addMany(big.id, [brush.id], kit.id)
    const [container] = (await items.list()).filter((i) => i.isContainer)

    await items.remove(container.id)

    expect(await compartments.listByLuggage(big.id)).toEqual([])
    const [line] = await quantities.listByLuggage(big.id)
    expect(line.compartmentId).toBeNull()
  })

  it('borrar un compartimento nunca borra un artículo por error', async () => {
    const { items, quantities, compartments, big } = await setup()
    const towel = await items.create({ name: 'Toalla' })
    const line = await quantities.add({
      luggageId: big.id,
      itemId: towel.id,
      num: 1,
      nAlreadyPacked: 0,
    })

    await compartments.remove(line.id)

    expect(await quantities.listByLuggage(big.id)).toHaveLength(1)
  })

  it('al borrar un compartimento, el contenedor sigue en el catálogo', async () => {
    const { compartments, items, big } = await setup()
    const kit = await compartments.create({
      luggageId: big.id,
      name: 'Neceser',
    })

    await compartments.remove(kit.id)

    expect((await items.list()).map((i) => i.name)).toEqual(['Neceser'])
  })
})

it('duplicar copia los compartimentos (sin "listo") con sus artículos dentro', async () => {
  const { compartments, items, quantities, luggages, big } = await setup()
  const kit = await compartments.create({ luggageId: big.id, name: 'Neceser' })
  await compartments.toggleReady(kit.id)
  const brush = await items.create({ name: 'Cepillo' })
  await quantities.addMany(big.id, [brush.id], kit.id)

  const copy = await luggages.duplicate(big.id)

  const [copiedKit] = await compartments.listByLuggage(copy.id)
  expect(copiedKit).toMatchObject({ name: 'Neceser', isReady: false })
  expect(copiedKit.id).not.toBe(kit.id)
  const [copiedBrush] = await quantities.listByLuggage(copy.id)
  expect(copiedBrush.compartmentId).toBe(copiedKit.id)
})

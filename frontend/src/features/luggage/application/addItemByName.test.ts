import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import { DuplicateError } from '@/shared/domain/errors'
import { createTestRepositories } from '@/test/repositories'
import { addItemByName } from './addItemByName'

async function setup() {
  const repos = createTestRepositories()
  const luggage = await repos.luggages.create({ name: 'Mochila' })
  return { ...repos, luggage }
}

describe('addItemByName', () => {
  it('si el artículo no existe, lo crea en el catálogo y lo añade con cantidad 1', async () => {
    const repos = await setup()

    const added = await addItemByName(repos, repos.luggage.id, '  Toalla ')

    const catalog = await repos.items.list()
    expect(catalog.map((i) => i.name)).toEqual(['Toalla'])
    expect(added).toMatchObject({
      luggageId: repos.luggage.id,
      itemId: catalog[0].id,
      num: 1,
      nAlreadyPacked: 0,
    })
  })

  it('si ya existe en el catálogo (aunque se escriba distinto), lo reutiliza', async () => {
    const repos = await setup()
    const camera = await repos.items.create({ name: 'Cámara' })

    const added = await addItemByName(repos, repos.luggage.id, 'camara')

    expect(added.itemId).toBe(camera.id)
    expect(await repos.items.list()).toHaveLength(1)
  })

  it('si ya está en la maleta, lanza DuplicateError y no toca nada', async () => {
    const repos = await setup()
    await addItemByName(repos, repos.luggage.id, 'Cargador')

    await expect(
      addItemByName(repos, repos.luggage.id, 'CARGADOR'),
    ).rejects.toBeInstanceOf(DuplicateError)
    expect(await repos.items.list()).toHaveLength(1)
    expect(await repos.quantities.listByLuggage(repos.luggage.id)).toHaveLength(
      1,
    )
  })

  it('rechaza un nombre vacío sin crear nada', async () => {
    const repos = await setup()

    await expect(
      addItemByName(repos, repos.luggage.id, '   '),
    ).rejects.toBeInstanceOf(ZodError)
    expect(await repos.items.list()).toEqual([])
  })
})

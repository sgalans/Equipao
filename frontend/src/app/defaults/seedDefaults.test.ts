import { describe, expect, it } from 'vitest'
import { createTestRepositories } from '@/test/repositories'
import { BASIC_LUGGAGE, DEFAULT_CATALOG } from './defaultData'
import { DEFAULTS_SEEDED_KEY, seedDefaults } from './seedDefaults'

describe('seedDefaults', () => {
  it('la primera vez crea el catálogo y la "Maleta básica" con su neceser', async () => {
    const repos = createTestRepositories()

    expect(await seedDefaults(repos.db, repos)).toEqual(expect.any(String))

    expect(await repos.items.list()).toHaveLength(DEFAULT_CATALOG.length + 1) // + el contenedor «Neceser»
    const [luggage] = await repos.luggages.list()
    expect(luggage).toMatchObject({
      name: 'Maleta básica',
      description: BASIC_LUGGAGE.description,
    })
    const [kit] = await repos.compartments.listByLuggage(luggage.id)
    expect(kit.name).toBe('Neceser')
    const entries = await repos.quantities.listEntriesByLuggage(luggage.id)
    const loose = entries.filter((e) => e.compartmentId === null)
    const inKit = entries.filter((e) => e.compartmentId === kit.id)
    expect(loose.map((e) => e.itemName)).toEqual([...BASIC_LUGGAGE.loose])
    expect(inKit.map((e) => e.itemName)).toEqual([
      ...BASIC_LUGGAGE.compartments[0].items,
    ])
    // Todo con cantidad 1 y sin guardar: es una plantilla.
    expect(entries.every((e) => e.num === 1 && e.nAlreadyPacked === 0)).toBe(
      true,
    )
  })

  it('solo una vez: la segunda llamada no hace nada', async () => {
    const repos = createTestRepositories()
    await seedDefaults(repos.db, repos)

    expect(await seedDefaults(repos.db, repos)).toBeNull()

    expect(await repos.luggages.list()).toHaveLength(1)
    expect(await repos.items.list()).toHaveLength(DEFAULT_CATALOG.length + 1) // + el contenedor «Neceser»
  })

  it('lo que el usuario borra no vuelve a aparecer', async () => {
    const repos = createTestRepositories()
    await seedDefaults(repos.db, repos)
    const [luggage] = await repos.luggages.list()
    await repos.luggages.remove(luggage.id)

    await seedDefaults(repos.db, repos)

    expect(await repos.luggages.list()).toEqual([])
  })

  it('reutiliza los artículos que ya existían (sin duplicar)', async () => {
    const repos = createTestRepositories()
    // Quien ya usaba la app tiene "calcetines" (en minúscula).
    const mine = await repos.items.create({ name: 'calcetines' })

    await seedDefaults(repos.db, repos)

    const catalog = await repos.items.list()
    expect(catalog).toHaveLength(DEFAULT_CATALOG.length + 1) // + el contenedor «Neceser»
    expect(
      catalog.filter((i) => i.name.toLowerCase() === 'calcetines'),
    ).toEqual([mine])
  })

  it('es atómico: si algo falla a medias no queda nada, ni la marca', async () => {
    const repos = createTestRepositories()
    const failing = {
      ...repos,
      compartments: {
        ...repos.compartments,
        create: () => Promise.reject(new Error('fallo a mitad')),
      },
    }

    await expect(seedDefaults(repos.db, failing)).rejects.toThrow(
      'fallo a mitad',
    )

    expect(await repos.items.list()).toEqual([])
    expect(await repos.luggages.list()).toEqual([])
    expect(await repos.db.meta.get(DEFAULTS_SEEDED_KEY)).toBeUndefined()
    // …y la próxima vez lo reintenta y funciona.
    expect(await seedDefaults(repos.db, repos)).toEqual(expect.any(String))
  })

  it('devuelve el id de la "Maleta básica" creada (para abrir sus instrucciones)', async () => {
    const repos = createTestRepositories()

    const basicId = await seedDefaults(repos.db, repos)

    const basic = await repos.luggages.getById(basicId ?? '')
    expect(basic?.name).toBe('Maleta básica')
  })
})

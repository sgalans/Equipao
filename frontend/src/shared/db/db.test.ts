import { v7 as uuidv7 } from 'uuid'
import { describe, expect, it } from 'vitest'
import type { ItemQuantity } from '@/features/luggage/domain/itemQuantity'
import { createTestDb, TEST_TIMESTAMP } from '@/test/db'

/** ItemQuantity válida; se sobrescribe lo que cada test necesite. */
function makeQuantity(overrides: Partial<ItemQuantity> = {}): ItemQuantity {
  return {
    id: uuidv7(),
    luggageId: uuidv7(),
    itemId: uuidv7(),
    num: 2,
    nAlreadyPacked: 0,
    createdAt: TEST_TIMESTAMP,
    updatedAt: TEST_TIMESTAMP,
    ...overrides,
  }
}

describe('AppDb', () => {
  it('guarda y recupera una maleta por su id', async () => {
    const db = createTestDb()
    const luggage = {
      id: uuidv7(),
      name: 'Mochila Japón',
      createdAt: TEST_TIMESTAMP,
      updatedAt: TEST_TIMESTAMP,
    }

    await db.luggages.add(luggage)

    expect(await db.luggages.get(luggage.id)).toEqual(luggage)
  })

  describe('índice único [luggageId+itemId]', () => {
    it('rechaza el mismo ítem dos veces en la misma maleta', async () => {
      const db = createTestDb()
      const luggageId = uuidv7()
      const itemId = uuidv7()
      await db.itemQuantities.add(makeQuantity({ luggageId, itemId }))

      // Distinto id, pero misma pareja (maleta, ítem) → viola el UNIQUE.
      await expect(
        db.itemQuantities.add(makeQuantity({ luggageId, itemId })),
      ).rejects.toMatchObject({ name: 'ConstraintError' })
      expect(await db.itemQuantities.count()).toBe(1)
    })

    it('permite el mismo ítem en maletas distintas', async () => {
      const db = createTestDb()
      const itemId = uuidv7()

      await db.itemQuantities.bulkAdd([
        makeQuantity({ itemId, luggageId: uuidv7() }),
        makeQuantity({ itemId, luggageId: uuidv7() }),
      ])

      expect(
        await db.itemQuantities.where('itemId').equals(itemId).count(),
      ).toBe(2)
    })
  })
})

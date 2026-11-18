import { v7 as uuidv7 } from 'uuid'
import { describe, expect, it } from 'vitest'
import { errorPaths } from '@/test/zod'
import { NewItemQuantitySchema } from './itemQuantity'

const validQuantity = {
  luggageId: uuidv7(),
  itemId: uuidv7(),
  num: 3,
  nAlreadyPacked: 1,
}

// Cada test corresponde a una restricción CHECK de Architecture.md.
describe('NewItemQuantitySchema', () => {
  it('acepta una cantidad válida', () => {
    expect(NewItemQuantitySchema.safeParse(validQuantity).success).toBe(true)
  })

  it('acepta valores límite: todo empaquetado (nAlreadyPacked = num)', () => {
    const q = { ...validQuantity, num: 3, nAlreadyPacked: 3 }
    expect(NewItemQuantitySchema.safeParse(q).success).toBe(true)
  })

  it('acepta valores límite: num = 0 y nAlreadyPacked = 0', () => {
    const q = { ...validQuantity, num: 0, nAlreadyPacked: 0 }
    expect(NewItemQuantitySchema.safeParse(q).success).toBe(true)
  })

  it('CHECK (num >= 0): rechaza num negativo', () => {
    const q = { ...validQuantity, num: -1, nAlreadyPacked: 0 }
    expect(errorPaths(NewItemQuantitySchema.safeParse(q))).toContain('num')
  })

  it('CHECK (nAlreadyPacked >= 0): rechaza nAlreadyPacked negativo', () => {
    const q = { ...validQuantity, nAlreadyPacked: -1 }
    expect(errorPaths(NewItemQuantitySchema.safeParse(q))).toContain(
      'nAlreadyPacked',
    )
  })

  it('CHECK (nAlreadyPacked <= num): rechaza más empaquetados que el total', () => {
    const q = { ...validQuantity, num: 2, nAlreadyPacked: 3 }
    expect(errorPaths(NewItemQuantitySchema.safeParse(q))).toEqual([
      'nAlreadyPacked',
    ])
  })

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rechaza cantidades no enteras: %s',
    (num) => {
      const q = { ...validQuantity, num }
      expect(NewItemQuantitySchema.safeParse(q).success).toBe(false)
    },
  )

  it('rechaza claves foráneas con formato inválido', () => {
    const q = { ...validQuantity, luggageId: 'no-es-uuid' }
    expect(errorPaths(NewItemQuantitySchema.safeParse(q))).toEqual([
      'luggageId',
    ])
  })
})

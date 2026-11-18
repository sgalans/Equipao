import { describe, expect, it } from 'vitest'
import { NewItemSchema } from './item'

describe('NewItemSchema', () => {
  it('acepta un ítem válido y normaliza el color a minúsculas', () => {
    const result = NewItemSchema.parse({ name: 'Calcetines', color: '#FF8800' })
    expect(result).toEqual({ name: 'Calcetines', color: '#ff8800' })
  })

  it.each(['red', '#fff', '#12345g', 'ff8800', '#ff88001'])(
    'rechaza el color inválido %j',
    (color) => {
      const result = NewItemSchema.safeParse({ name: 'Calcetines', color })
      expect(result.success).toBe(false)
    },
  )
})

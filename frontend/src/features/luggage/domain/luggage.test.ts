import { v7 as uuidv7 } from 'uuid'
import { describe, expect, it } from 'vitest'
import { NewLuggageSchema } from './luggage'

describe('NewLuggageSchema', () => {
  it('acepta una maleta válida', () => {
    const result = NewLuggageSchema.safeParse({
      tripId: uuidv7(),
      name: 'Maleta grande',
    })
    expect(result.success).toBe(true)
  })

  it('rechaza una maleta sin viaje', () => {
    const result = NewLuggageSchema.safeParse({ name: 'Maleta grande' })
    expect(result.success).toBe(false)
  })
})

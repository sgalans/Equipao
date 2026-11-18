import { describe, expect, it } from 'vitest'
import { errorPaths } from '@/test/zod'
import { NewItemSchema } from './item'

describe('NewItemSchema', () => {
  it('acepta un ítem válido y recorta el nombre', () => {
    expect(NewItemSchema.parse({ name: ' Calcetines ' })).toEqual({
      name: 'Calcetines',
    })
  })

  it('rechaza el nombre vacío', () => {
    expect(errorPaths(NewItemSchema.safeParse({ name: ' ' }))).toEqual(['name'])
  })
})

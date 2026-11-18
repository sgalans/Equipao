import { describe, expect, it } from 'vitest'
import { errorPaths } from '@/test/zod'
import { NewLuggageSchema } from './luggage'

describe('NewLuggageSchema', () => {
  it('acepta una maleta válida y recorta el nombre', () => {
    expect(NewLuggageSchema.parse({ name: '  Mochila Japón ' })).toEqual({
      name: 'Mochila Japón',
    })
  })

  it.each(['', '   '])('rechaza el nombre vacío %j', (name) => {
    expect(errorPaths(NewLuggageSchema.safeParse({ name }))).toEqual(['name'])
  })
})

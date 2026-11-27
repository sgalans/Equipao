import { describe, expect, it } from 'vitest'
import { errorPaths } from '@/test/zod'
import { DESCRIPTION_MAX_LENGTH, NewLuggageSchema } from './luggage'

describe('NewLuggageSchema', () => {
  it('acepta una maleta válida y recorta el nombre', () => {
    expect(NewLuggageSchema.parse({ name: '  Mochila Japón ' })).toEqual({
      name: 'Mochila Japón',
      // Sin descripción → '' (un único valor para "vacía").
      description: '',
    })
  })

  it.each(['', '   '])('rechaza el nombre vacío %j', (name) => {
    expect(errorPaths(NewLuggageSchema.safeParse({ name }))).toEqual(['name'])
  })

  it('recorta la descripción y admite saltos de línea', () => {
    const { description } = NewLuggageSchema.parse({
      name: 'Mochila',
      description: '  Japón, 2 semanas.\nHace frío.  ',
    })

    expect(description).toBe('Japón, 2 semanas.\nHace frío.')
  })

  it('acepta hasta DESCRIPTION_MAX_LENGTH (1000) caracteres y rechaza uno más', () => {
    const at = (length: number) =>
      NewLuggageSchema.safeParse({
        name: 'Mochila',
        description: 'a'.repeat(length),
      })

    expect(DESCRIPTION_MAX_LENGTH).toBe(1000)
    expect(at(DESCRIPTION_MAX_LENGTH).success).toBe(true)
    expect(errorPaths(at(DESCRIPTION_MAX_LENGTH + 1))).toEqual(['description'])
  })
})

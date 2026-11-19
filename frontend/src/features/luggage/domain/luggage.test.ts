import { describe, expect, it } from 'vitest'
import { errorPaths } from '@/test/zod'
import { NewLuggageSchema } from './luggage'

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

  it('rechaza una descripción de más de 500 caracteres', () => {
    const result = NewLuggageSchema.safeParse({
      name: 'Mochila',
      description: 'a'.repeat(501),
    })

    expect(errorPaths(result)).toEqual(['description'])
  })
})

import { describe, expect, it } from 'vitest'
import { containersNote } from './containersNote'

describe('containersNote', () => {
  it('uno: en singular', () => {
    expect(containersNote(['Mochila'], 'Neceser')).toBe(
      'El compartimento «Mochila» se añadirá suelto en la maleta, no dentro del compartimento «Neceser».',
    )
  })

  it('dos: en plural, unidos con "y"', () => {
    expect(containersNote(['Mochila', 'Maletín'], 'Neceser')).toBe(
      'Los compartimentos «Mochila» y «Maletín» se añadirán sueltos en la maleta, no dentro del compartimento «Neceser».',
    )
  })

  it('tres o más: comas y "y" al final', () => {
    expect(containersNote(['A', 'B', 'C'], 'Neceser')).toBe(
      'Los compartimentos «A», «B» y «C» se añadirán sueltos en la maleta, no dentro del compartimento «Neceser».',
    )
  })
})

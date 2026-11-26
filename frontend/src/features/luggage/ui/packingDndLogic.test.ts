import { describe, expect, it } from 'vitest'
import { parseFlat, resolveFlatDrop } from './packingDndLogic'

/*
 * Lógica pura del arrastre ("árbol aplanado"). El GESTO no se puede probar
 * en jsdom (no mide la pantalla); esto prueba lo importante: a qué grupo va
 * cada cosa y entre qué vecinos se guarda.
 */

// Sueltos A, B · [K] Neceser con C, D · [M] Mochila vacía · [N] Bolsa con E.
const flat = ['A', 'B', 'K', 'C', 'D', 'M', 'N', 'E']
const isCompartment = (id: string) => ['K', 'M', 'N'].includes(id)
const drop = (activeId: string, overId: string) =>
  resolveFlatDrop(flat, isCompartment, activeId, overId)

describe('parseFlat', () => {
  it('lo de antes de la primera cabecera es suelto; lo de después, de cada una', () => {
    expect(parseFlat(flat, isCompartment)).toEqual({
      loose: ['A', 'B'],
      compartmentIds: ['K', 'M', 'N'],
      items: { K: ['C', 'D'], M: [], N: ['E'] },
    })
  })
})

describe('resolveFlatDrop: artículos', () => {
  it('dentro de su grupo: cambia de sitio con sus vecinos', () => {
    expect(drop('A', 'B')).toMatchObject({
      compartmentId: null,
      beforeId: 'B',
      afterId: null,
    })
  })

  it('al cruzar una cabecera ya está DENTRO de ese compartimento', () => {
    // A baja hasta la posición de C. Al bajar, dnd-kit lo deja DETRÁS del
    // que hay debajo (lo que se ve al arrastrar): entre C y D, en K.
    expect(drop('A', 'C')).toMatchObject({
      compartmentId: 'K',
      beforeId: 'C',
      afterId: 'D',
    })
    // Y justo debajo de la cabecera: bajando hasta la propia cabecera K.
    expect(drop('A', 'K')).toMatchObject({
      compartmentId: 'K',
      beforeId: null,
      afterId: 'C',
    })
  })

  it('de un compartimento a otro', () => {
    expect(drop('C', 'E')).toMatchObject({
      compartmentId: 'N',
      beforeId: 'E',
      afterId: null,
    })
  })

  it('a un compartimento vacío: justo debajo de su cabecera, sin vecinos', () => {
    // C baja hasta M (vacío): queda tras la cabecera M.
    expect(drop('C', 'M')).toMatchObject({
      compartmentId: 'M',
      beforeId: null,
      afterId: null,
    })
  })

  it('sacarlo a sueltos: por encima de la primera cabecera', () => {
    // C sube hasta la posición de la cabecera K: queda antes de ella.
    expect(drop('C', 'K')).toMatchObject({
      compartmentId: null,
      beforeId: 'B',
      afterId: null,
    })
  })

  it('soltar en su mismo sitio no cambia nada', () => {
    expect(drop('D', 'D')).toMatchObject({
      compartmentId: 'K',
      beforeId: 'C',
      afterId: null,
    })
  })
})

describe('resolveFlatDrop: compartimentos', () => {
  it('sus vecinos son las cabeceras de antes y después (no los artículos)', () => {
    // N sube hasta la posición de C: entre las cabeceras K y M.
    expect(drop('N', 'C')).toMatchObject({
      type: 'compartment',
      beforeId: 'K',
      afterId: 'M',
    })
  })

  it('al principio de todo: primero, sin vecino por arriba', () => {
    expect(drop('M', 'A')).toMatchObject({
      type: 'compartment',
      beforeId: null,
      afterId: 'K',
    })
  })
})

it('algo que no está en la lista: nada que guardar', () => {
  expect(drop('Z', 'A')).toBeNull()
})

import { describe, expect, it } from 'vitest'
import {
  formatLuggageText,
  isEmptyLuggageText,
  parseLuggageText,
  type LuggageText,
} from './luggageText'

const mallorca: LuggageText = {
  name: 'Mallorca',
  loose: [
    { name: 'Camisetas', num: 3 },
    { name: 'Bañador', num: 1 },
  ],
  compartments: [
    {
      name: 'Neceser',
      items: [{ name: 'Cepillo de dientes', num: 1 }],
    },
  ],
}

describe('formatLuggageText', () => {
  it('nombre, sueltos y compartimentos, separados por una línea en blanco', () => {
    expect(formatLuggageText(mallorca)).toBe(
      [
        '🧳 Mallorca',
        '',
        '- Camisetas ×3',
        '- Bañador',
        '',
        'Neceser:',
        '- Cepillo de dientes',
      ].join('\n'),
    )
  })

  it('sin sueltos no deja un bloque vacío; un compartimento vacío sale solo con su nombre', () => {
    expect(
      formatLuggageText({
        name: 'Finde',
        loose: [],
        compartments: [{ name: 'Mochila', items: [] }],
      }),
    ).toBe('🧳 Finde\n\nMochila:')
  })
})

describe('parseLuggageText', () => {
  it('lee lo que escribe formatLuggageText (ida y vuelta)', () => {
    expect(parseLuggageText(formatLuggageText(mallorca))).toEqual(mallorca)
  })

  it('una lista cualquiera, una cosa por línea: todo sueltos y sin nombre', () => {
    expect(parseLuggageText('Toalla\n\nCrema solar\n')).toEqual({
      name: null,
      loose: [
        { name: 'Toalla', num: 1 },
        { name: 'Crema solar', num: 1 },
      ],
      compartments: [],
    })
  })

  it.each([
    ['- Calcetines ×3', 3],
    ['Calcetines x3', 3],
    ['• Calcetines X 2', 2],
    ['3 × Calcetines', 3],
    ['2x Calcetines', 2],
    ['* Calcetines', 1],
  ])('"%s" → Calcetines ×%i', (line, num) => {
    expect(parseLuggageText(line).loose).toEqual([{ name: 'Calcetines', num }])
  })

  it('la cantidad se limita a 1–99', () => {
    expect(parseLuggageText('Pinzas ×500\nGomas ×0').loose).toEqual([
      { name: 'Pinzas', num: 99 },
      { name: 'Gomas', num: 1 },
    ])
  })

  it('un artículo repetido solo cuenta la primera vez (sin mirar mayúsculas ni tildes)', () => {
    expect(
      parseLuggageText('- Cámara\nNeceser:\n- camara\n- Peine').compartments,
    ).toEqual([{ name: 'Neceser', items: [{ name: 'Peine', num: 1 }] }])
  })

  it('un compartimento repetido se junta en uno (un Neceser por maleta)', () => {
    expect(
      parseLuggageText(
        [
          'Neceser:',
          '- Cepillo',
          'Mochila:',
          '- Libro',
          'neceser:',
          '- Pasta',
        ].join('\n'),
      ).compartments,
    ).toEqual([
      {
        name: 'Neceser',
        items: [
          { name: 'Cepillo', num: 1 },
          { name: 'Pasta', num: 1 },
        ],
      },
      { name: 'Mochila', items: [{ name: 'Libro', num: 1 }] },
    ])
  })

  it('una línea con viñeta que acaba en ":" es un artículo, no un compartimento', () => {
    expect(parseLuggageText('- Ver: museo').loose).toEqual([
      { name: 'Ver: museo', num: 1 },
    ])
  })

  it('ignora líneas vacías, CRLF de Windows y un segundo "🧳"', () => {
    expect(parseLuggageText('🧳 Uno\r\n\r\n🧳 Dos\r\n- A')).toEqual({
      name: 'Uno',
      loose: [{ name: 'A', num: 1 }],
      compartments: [],
    })
  })

  it('recorta los nombres demasiado largos a 100 caracteres', () => {
    const [item] = parseLuggageText('a'.repeat(150)).loose
    expect(item.name).toHaveLength(100)
  })
})

describe('isEmptyLuggageText', () => {
  it.each([
    ['', true],
    ['\n  \n', true],
    ['Toalla', false],
    ['🧳 Solo el nombre', false],
  ])('"%s" → %s', (text, empty) => {
    expect(isEmptyLuggageText(parseLuggageText(text))).toBe(empty)
  })
})

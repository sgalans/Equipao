import { describe, expect, it } from 'vitest'
import { formatDateRange } from './dates'

// Intl puede usar espacios especiales (no separables, finos…). Los
// normalizamos para que el test compruebe el contenido, no la tipografía.
const normalize = (s: string) => s.replace(/\s/g, ' ')

describe('formatDateRange', () => {
  it('no repite mes ni año si coinciden', () => {
    expect(normalize(formatDateRange('2027-04-01', '2027-04-15'))).toBe(
      '1–15 abr 2027',
    )
  })

  it('muestra los dos meses si son distintos', () => {
    expect(normalize(formatDateRange('2027-04-28', '2027-05-03'))).toBe(
      '28 abr – 3 may 2027',
    )
  })

  it('muestra un solo día si inicio y fin coinciden', () => {
    expect(normalize(formatDateRange('2027-04-01', '2027-04-01'))).toBe(
      '1 abr 2027',
    )
  })

  it('no se desplaza un día por la zona horaria (el 1 sigue siendo el 1)', () => {
    expect(normalize(formatDateRange('2027-01-01', '2027-01-01'))).toBe(
      '1 ene 2027',
    )
  })
})

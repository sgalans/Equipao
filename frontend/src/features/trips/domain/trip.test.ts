import { v7 as uuidv7 } from 'uuid'
import { describe, expect, it } from 'vitest'
import { errorPaths } from '../../../test/zod'
import { NewTripSchema, TripSchema } from './trip'

// Patrón "test data builder": un objeto válido por defecto y en cada test
// solo sobrescribimos lo que nos interesa. El test enseña qué cambia y por qué.
const validNewTrip = {
  name: 'Japón',
  startDate: '2027-04-01',
  endDate: '2027-04-15',
}

describe('NewTripSchema', () => {
  it('acepta un viaje válido', () => {
    expect(NewTripSchema.safeParse(validNewTrip).success).toBe(true)
  })

  it('acepta un viaje de un solo día (inicio = fin)', () => {
    const trip = { ...validNewTrip, endDate: validNewTrip.startDate }
    expect(NewTripSchema.safeParse(trip).success).toBe(true)
  })

  it('recorta los espacios del nombre', () => {
    const result = NewTripSchema.parse({ ...validNewTrip, name: '  Japón  ' })
    expect(result.name).toBe('Japón')
  })

  it.each(['', '   '])('rechaza el nombre vacío %j', (name) => {
    const result = NewTripSchema.safeParse({ ...validNewTrip, name })
    expect(errorPaths(result)).toEqual(['name'])
  })

  it('rechaza que el fin sea anterior al inicio y señala endDate', () => {
    const result = NewTripSchema.safeParse({
      ...validNewTrip,
      startDate: '2027-04-15',
      endDate: '2027-04-01',
    })
    expect(errorPaths(result)).toEqual(['endDate'])
  })

  it.each(['2027-4-1', '01/04/2027', '2027-13-01', '2027-04-01T10:00:00Z'])(
    'rechaza la fecha con formato inválido %j',
    (startDate) => {
      const result = NewTripSchema.safeParse({ ...validNewTrip, startDate })
      expect(result.success).toBe(false)
    },
  )
})

describe('TripSchema', () => {
  const now = new Date().toISOString()
  const validTrip = {
    id: uuidv7(),
    ...validNewTrip,
    createdAt: now,
    updatedAt: now,
  }

  it('acepta una entidad completa con UUID v7 y timestamps ISO', () => {
    expect(TripSchema.safeParse(validTrip).success).toBe(true)
  })

  it('rechaza un id que no es UUID', () => {
    const result = TripSchema.safeParse({ ...validTrip, id: '123' })
    expect(errorPaths(result)).toEqual(['id'])
  })

  it('también aplica la regla de fechas a la entidad persistida', () => {
    const result = TripSchema.safeParse({
      ...validTrip,
      startDate: '2027-04-15',
      endDate: '2027-04-01',
    })
    expect(errorPaths(result)).toEqual(['endDate'])
  })
})

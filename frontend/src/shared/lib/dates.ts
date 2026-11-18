/**
 * Formatea un rango de fechas 'YYYY-MM-DD' para mostrarlo: "1–15 abr 2027".
 *
 * Interpretamos las fechas en UTC y formateamos también en UTC. Si usáramos
 * new Date('2027-04-01') con la zona horaria local, en algunos husos el día
 * se mostraría como el 31 de marzo: el bug clásico de las fechas sin hora.
 *
 * formatRange es inteligente: no repite el mes ni el año si coinciden.
 */
const rangeFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

function parseIsoDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`)
}

export function formatDateRange(startDate: string, endDate: string): string {
  return rangeFormatter.formatRange(
    parseIsoDate(startDate),
    parseIsoDate(endDate),
  )
}

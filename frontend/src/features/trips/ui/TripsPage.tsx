import { useLiveQuery } from 'dexie-react-hooks'
import { useRepositories } from '@/shared/di/repositories'
import { formatDateRange } from '@/shared/lib/dates'
import styles from './TripsPage.module.css'

/** Pantalla principal: lista de viajes. */
export function TripsPage() {
  const { trips } = useRepositories()

  // useLiveQuery ejecuta la consulta y se SUSCRIBE a ella: si cualquier
  // parte de la app (u otra pestaña) cambia los viajes, se vuelve a ejecutar
  // y el componente se re-renderiza solo. Dexie es la single source of truth:
  // no copiamos los datos a un estado propio (ni a Zustand).
  //
  // Funciona aunque llamemos al repositorio y no a Dexie directamente,
  // porque Dexie detecta las consultas que se hacen dentro de la función.
  const tripList = useLiveQuery(() => trips.list(), [trips])

  // Mientras la primera consulta no termina, useLiveQuery devuelve undefined.
  if (tripList === undefined) {
    return <p aria-busy="true">Cargando viajes…</p>
  }

  return (
    <section>
      <h1 className={styles.title}>Mis viajes</h1>

      {tripList.length === 0 ? (
        <p className={styles.empty}>Aún no tienes viajes.</p>
      ) : (
        <ul className={styles.list}>
          {tripList.map((trip) => (
            // `key` estable (el id) para que React sepa qué fila es cuál
            // al añadir, borrar o reordenar. Nunca el índice del array.
            <li key={trip.id} className={styles.card}>
              <span className={styles.name}>{trip.name}</span>
              <span className={styles.dates}>
                {formatDateRange(trip.startDate, trip.endDate)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

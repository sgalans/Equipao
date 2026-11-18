import { useLiveQuery } from 'dexie-react-hooks'
import { useRepositories } from '@/shared/di/repositories'
import page from '@/shared/ui/page.module.css'
import styles from './LuggageListPage.module.css'

/** Pantalla de inicio: lista de maletas. */
export function LuggageListPage() {
  const { luggages } = useRepositories()

  // useLiveQuery ejecuta la consulta y se SUSCRIBE a ella: si cualquier
  // parte de la app (u otra pestaña) cambia las maletas, se vuelve a ejecutar
  // y el componente se re-renderiza solo. Dexie es la single source of truth.
  const luggageList = useLiveQuery(() => luggages.list(), [luggages])

  // Mientras la primera consulta no termina, useLiveQuery devuelve undefined.
  if (luggageList === undefined) {
    return <p aria-busy="true">Cargando maletas…</p>
  }

  return (
    <section>
      <header className={page.header}>
        <h1 className={page.title}>Mis maletas</h1>
      </header>

      {luggageList.length === 0 ? (
        <p className={styles.empty}>Aún no tienes maletas.</p>
      ) : (
        <ul className={styles.list}>
          {luggageList.map((luggage) => (
            // `key` estable (el id), nunca el índice del array.
            <li key={luggage.id} className={styles.card}>
              {luggage.name}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

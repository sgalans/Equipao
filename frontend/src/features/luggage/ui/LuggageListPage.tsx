import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { useRepositories } from '@/shared/di/repositories'
import page from '@/shared/ui/page.module.css'
import { CreateLuggageForm } from './CreateLuggageForm'
import { PackingProgress } from './PackingProgress'
import { progressLabel } from './progressLabel'
import styles from './LuggageListPage.module.css'

/** Pantalla de inicio: crear maletas y abrirlas con un toque. */
export function LuggageListPage() {
  const { luggages } = useRepositories()

  // useLiveQuery ejecuta la consulta y se SUSCRIBE a ella: si cualquier
  // parte de la app (u otra pestaña) cambia las maletas, se vuelve a ejecutar
  // y el componente se re-renderiza solo. Dexie es la single source of truth:
  // al crear una maleta no hace falta "avisar" a la lista, aparece sola.
  // listSummaries: cada maleta con su progreso, en solo dos consultas.
  const luggageList = useLiveQuery(() => luggages.listSummaries(), [luggages])

  return (
    <section>
      <header className={page.header}>
        <h1 className={page.title}>Mis maletas</h1>
      </header>

      {/* El formulario se muestra ya mientras carga: se puede escribir sin
          esperar a la lista. */}
      <CreateLuggageForm />

      {luggageList === undefined ? (
        <p aria-busy="true">Cargando maletas…</p>
      ) : luggageList.length === 0 ? (
        <p className={styles.empty}>
          Aún no tienes maletas. Escribe un nombre arriba para crear la primera.
        </p>
      ) : (
        <ul className={styles.list}>
          {luggageList.map((luggage) => (
            // `key` estable (el id), nunca el índice del array.
            <li key={luggage.id}>
              {/* Toda la tarjeta es el enlace: zona táctil grande, un toque. */}
              <Link
                to={`/luggages/${luggage.id}`}
                className={styles.card}
                // Nombre accesible explícito: "Mochila, 3 de 5 listos".
                // Empieza por el texto visible (regla WCAG "label in name").
                aria-label={`${luggage.name}, ${progressLabel(luggage.done, luggage.total)}`}
              >
                <span className={styles.name}>{luggage.name}</span>
                <PackingProgress
                  done={luggage.done}
                  total={luggage.total}
                  variant="compact"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

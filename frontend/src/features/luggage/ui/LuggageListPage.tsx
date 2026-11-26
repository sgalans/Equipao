import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { useRepositories } from '@/shared/di/repositories'
import buttons from '@/shared/ui/buttons.module.css'
import highlightStyles from '@/shared/ui/highlight.module.css'
import page from '@/shared/ui/page.module.css'
import { useTemporaryHighlight } from '@/shared/ui/useTemporaryHighlight'
import { CreateLuggageForm } from './CreateLuggageForm'
import { DuplicateLuggageButton } from './DuplicateLuggageButton'
import { PackingProgress } from './PackingProgress'
import { progressLabel } from './progressLabel'
import styles from './LuggageListPage.module.css'

/** Primera línea de la descripción (la tarjeta solo muestra esa). */
function firstLine(description: string): string {
  return description.split('\n')[0].trim()
}

/** Pantalla de inicio: crear, abrir y duplicar maletas. */
export function LuggageListPage() {
  const { luggages } = useRepositories()

  // useLiveQuery ejecuta la consulta y se SUSCRIBE a ella: si cualquier
  // parte de la app (u otra pestaña) cambia las maletas, se vuelve a ejecutar
  // y el componente se re-renderiza solo. Dexie es la single source of truth:
  // al crear una maleta no hace falta "avisar" a la lista, aparece sola.
  // listSummaries: cada maleta con su progreso, en solo dos consultas.
  const luggageList = useLiveQuery(() => luggages.listSummaries(), [luggages])

  // Copia recién creada: se resalta un momento para que se vea qué ha
  // pasado (aparece la primera porque la lista va de más reciente a más
  // antigua). Mismo patrón que el aviso de duplicados en el detalle.
  const { highlightedId, highlight } = useTemporaryHighlight()

  return (
    <section>
      <header className={page.header}>
        <h1 className={page.title}>Mis maletas</h1>
        {/* Crear una maleta pegando una lista (p. ej. la que alguien ha
            compartido por WhatsApp). */}
        <Link to="/import" className={buttons.headerAction}>
          Importar
        </Link>
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
            <li
              key={luggage.id}
              className={
                highlightedId === luggage.id
                  ? `${styles.row} ${highlightStyles.highlighted}`
                  : styles.row
              }
            >
              {/* La tarjeta es un enlace y el botón va a su LADO, no dentro:
                  HTML no permite un elemento interactivo dentro de otro. */}
              <Link
                to={`/luggages/${luggage.id}`}
                className={styles.card}
                // Nombre accesible explícito: "Mochila, Japón, 3 de 5 listos"
                // (lo mismo que se ve). Empieza por el texto visible (regla
                // WCAG "label in name").
                aria-label={[
                  luggage.name,
                  firstLine(luggage.description),
                  progressLabel(luggage.done, luggage.total),
                ]
                  .filter(Boolean)
                  .join(', ')}
              >
                <span className={styles.name}>{luggage.name}</span>
                {luggage.description && (
                  <span className={styles.description}>
                    {firstLine(luggage.description)}
                  </span>
                )}
                <PackingProgress
                  done={luggage.done}
                  total={luggage.total}
                  variant="compact"
                />
              </Link>
              <DuplicateLuggageButton
                luggage={luggage}
                onDuplicated={(copy) => highlight(copy.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

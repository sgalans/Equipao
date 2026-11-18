import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router'
import { useRepositories } from '@/shared/di/repositories'
import { EditableTitle } from '@/shared/ui/EditableTitle'
import page from '@/shared/ui/page.module.css'
import { DeleteLuggageButton } from './DeleteLuggageButton'
import styles from './LuggageDetailPage.module.css'

/** Pantalla /luggages/:luggageId. En la iteración 4 tendrá la lista de artículos. */
export function LuggageDetailPage() {
  const { luggageId = '' } = useParams<{ luggageId: string }>()
  const { luggages } = useRepositories()
  const navigate = useNavigate()

  // Tres estados distinguibles (getById devuelve undefined si no existe,
  // igual que useLiveQuery mientras carga; por eso lo convertimos a null):
  //   undefined → cargando · null → no existe · Luggage → listo
  const luggage = useLiveQuery(
    async () => (await luggages.getById(luggageId)) ?? null,
    [luggages, luggageId],
  )

  if (luggage === undefined) {
    return <p aria-busy="true">Cargando maleta…</p>
  }

  if (luggage === null) {
    return (
      <section>
        <h1 className={page.title}>No encontramos esta maleta</h1>
        <p>Puede que se haya borrado.</p>
        <Link to="/">Volver a mis maletas</Link>
      </section>
    )
  }

  return (
    <section>
      <header className={page.header}>
        <EditableTitle
          // key: si cambiamos de maleta sin desmontar la página, el título
          // empieza de cero (sin un borrador de la maleta anterior).
          key={luggage.id}
          value={luggage.name}
          editLabel="Renombrar maleta"
          onSave={async (name) => {
            await luggages.update(luggage.id, { name })
          }}
        />
        <DeleteLuggageButton
          luggage={luggage}
          // replace: la pantalla de una maleta borrada no queda en el
          // historial; "atrás" no lleva a una maleta que ya no existe.
          onDeleted={() => navigate('/', { replace: true })}
        />
      </header>

      <p className={styles.empty}>Esta maleta está vacía.</p>
    </section>
  )
}

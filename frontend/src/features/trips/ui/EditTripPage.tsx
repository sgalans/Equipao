import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router'
import { useRepositories } from '@/shared/di/repositories'
import page from '@/shared/ui/page.module.css'
import { TripForm } from './TripForm'

/** Pantalla /trips/:tripId/edit: reutiliza TripForm con los datos del viaje. */
export function EditTripPage() {
  // El tipo dice string, pero en runtime podría faltar: por eso el `?? ''`.
  const { tripId = '' } = useParams<{ tripId: string }>()
  const { trips } = useRepositories()
  const navigate = useNavigate()

  // Tres estados distinguibles (getById devuelve undefined si no existe,
  // igual que useLiveQuery mientras carga; por eso lo convertimos a null):
  //   undefined → cargando · null → no existe · Trip → listo
  const trip = useLiveQuery(
    async () => (await trips.getById(tripId)) ?? null,
    [trips, tripId],
  )

  if (trip === undefined) {
    return <p aria-busy="true">Cargando viaje…</p>
  }

  if (trip === null) {
    return (
      <section>
        <h1 className={page.title}>No encontramos este viaje</h1>
        <p>Puede que se haya borrado.</p>
        <Link to="/">Volver a mis viajes</Link>
      </section>
    )
  }

  return (
    <section>
      <header className={page.header}>
        <h1 className={page.title}>Editar viaje</h1>
      </header>
      <TripForm
        // React Hook Form solo lee defaultValues al montarse. La `key` fuerza
        // un formulario nuevo si cambiamos de viaje sin desmontar la página.
        key={trip.id}
        defaultValues={{
          name: trip.name,
          startDate: trip.startDate,
          endDate: trip.endDate,
        }}
        submitLabel="Guardar cambios"
        onSubmit={async (changes) => {
          await trips.update(trip.id, changes)
          await navigate('/')
        }}
        onCancel={() => void navigate('/')}
      />
    </section>
  )
}

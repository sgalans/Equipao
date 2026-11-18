import { useNavigate } from 'react-router'
import { useRepositories } from '@/shared/di/repositories'
import page from '@/shared/ui/page.module.css'
import { TripForm } from './TripForm'

/**
 * Pantalla /trips/new (componente contenedor): conecta el formulario con el
 * repositorio y con la navegación.
 */
export function NewTripPage() {
  const { trips } = useRepositories()
  const navigate = useNavigate()

  return (
    <section>
      <header className={page.header}>
        <h1 className={page.title}>Nuevo viaje</h1>
      </header>
      <TripForm
        submitLabel="Crear viaje"
        onSubmit={async (input) => {
          await trips.create(input)
          // Iteración 3: navegar al detalle del viaje recién creado.
          await navigate('/')
        }}
        onCancel={() => void navigate('/')}
      />
    </section>
  )
}

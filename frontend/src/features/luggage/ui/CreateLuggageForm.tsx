import { useRepositories } from '@/shared/di/repositories'
import { QuickCreateForm } from '@/shared/ui/QuickCreateForm'

/** Crear una maleta "en línea" en "Mis maletas": escribir + Intro (o "+"). */
export function CreateLuggageForm() {
  const { luggages } = useRepositories()

  return (
    <QuickCreateForm
      label="Nombre de la nueva maleta"
      placeholder="Nueva maleta…"
      submitLabel="Crear maleta"
      errorMessage="No se ha podido crear la maleta. Inténtalo de nuevo."
      onCreate={async (name) => {
        await luggages.create({ name })
      }}
    />
  )
}

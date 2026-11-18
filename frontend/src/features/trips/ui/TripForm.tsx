import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import buttons from '@/shared/ui/buttons.module.css'
import { FormField } from '@/shared/ui/FormField'
import { NewTripSchema, type NewTrip } from '../domain/trip'
import styles from './TripForm.module.css'

/** Lo que contiene el formulario ANTES de validar (z.input, sin transformar). */
export type TripFormValues = z.input<typeof NewTripSchema>

const EMPTY_TRIP: TripFormValues = { name: '', startDate: '', endDate: '' }

interface TripFormProps {
  /** Valores iniciales: vacíos al crear, los del viaje al editar. */
  defaultValues?: TripFormValues
  submitLabel: string
  /** Recibe los datos YA validados y normalizados por Zod. */
  onSubmit: (trip: NewTrip) => Promise<void>
  onCancel: () => void
}

/**
 * Formulario de viaje (componente presentacional): pinta y valida, pero no
 * sabe si crea o edita ni dónde se guarda. Eso lo decide la página que lo usa.
 */
export function TripForm({
  defaultValues = EMPTY_TRIP,
  submitLabel,
  onSubmit,
  onCancel,
}: TripFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    // El MISMO esquema que valida el repositorio: las reglas del formulario
    // y las de la capa de datos no pueden divergir. El path ['endDate'] del
    // refine hace que el error de fechas salga bajo el campo "Fin".
    resolver: zodResolver(NewTripSchema),
    defaultValues,
  })

  // handleSubmit solo llama a esta función si la validación pasa.
  const submit = handleSubmit(async (trip) => {
    try {
      await onSubmit(trip)
    } catch (error) {
      // Errores inesperados (p. ej. IndexedDB llena): se muestran al usuario
      // en lugar de fallar en silencio, y se registran para depurar.
      console.error(error)
      setError('root', {
        message: 'No se ha podido guardar el viaje. Inténtalo de nuevo.',
      })
    }
  })

  return (
    // noValidate desactiva los globos de validación nativos del navegador,
    // distintos en cada navegador: los mensajes los da siempre Zod.
    <form onSubmit={submit} noValidate className={styles.form}>
      <FormField
        label="Nombre"
        autoComplete="off"
        error={errors.name?.message}
        {...register('name')}
      />
      <div className={styles.dates}>
        <FormField
          label="Inicio"
          type="date"
          error={errors.startDate?.message}
          {...register('startDate')}
        />
        <FormField
          label="Fin"
          type="date"
          error={errors.endDate?.message}
          {...register('endDate')}
        />
      </div>

      {errors.root && (
        // role="alert": el lector de pantalla lo anuncia en cuanto aparece.
        <p role="alert" className={styles.formError}>
          {errors.root.message}
        </p>
      )}

      <div className={styles.actions}>
        <button type="button" className={buttons.secondary} onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="submit"
          className={buttons.primary}
          // Evita el doble envío (doble viaje creado) si se pulsa dos veces.
          disabled={isSubmitting}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

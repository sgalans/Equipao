import { useId, type ComponentProps } from 'react'
import styles from './FormField.module.css'

interface FormFieldProps extends ComponentProps<'input'> {
  label: string
  /** Mensaje de error a mostrar bajo el campo (si lo hay). */
  error?: string
}

/**
 * Campo de formulario accesible: <label> + <input> + mensaje de error.
 *
 * - useId genera un id único y estable para enlazar label ↔ input
 *   (pulsar la etiqueta enfoca el campo; el lector de pantalla los asocia).
 * - aria-invalid + aria-describedby hacen que VoiceOver/TalkBack lean el
 *   error al enfocar el campo, no solo que se vea en rojo.
 *
 * Acepta cualquier prop de <input>, así que se le puede pasar tal cual lo que
 * devuelve register('campo') de React Hook Form (name, onChange, onBlur, ref).
 */
export function FormField({ label, error, id, ...inputProps }: FormFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`

  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}

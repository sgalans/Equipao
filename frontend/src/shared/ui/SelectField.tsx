import type { ReactNode } from 'react'
import { ChevronDownIcon } from './icons/ChevronDownIcon'
import styles from './SelectField.module.css'

interface SelectFieldProps {
  id: string
  value: string
  onChange: (value: string) => void
  /** Los <option>. */
  children: ReactNode
}

/**
 * Desplegable (<select> nativo: en iOS abre su menú) con aspecto de campo y
 * una flecha ▾ propia, para que se vea claramente que es un desplegable
 * (decisión del usuario). Lo usan "Dónde" (Añadir a la maleta) y "Empezar
 * con" (Nueva maleta). La etiqueta (<label htmlFor={id}>) la pone quien lo usa.
 */
export function SelectField({
  id,
  value,
  onChange,
  children,
}: SelectFieldProps) {
  return (
    <span className={styles.wrap}>
      <select
        id={id}
        className={styles.select}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
      <span className={styles.chevron} aria-hidden="true">
        <ChevronDownIcon />
      </span>
    </span>
  )
}

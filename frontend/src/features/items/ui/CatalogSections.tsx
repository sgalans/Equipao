import type { ReactNode } from 'react'
import type { ItemSummary } from '../domain/itemRepository'
import styles from './CatalogSections.module.css'

interface CatalogSectionsProps {
  items: ItemSummary[]
  renderRow: (item: ItemSummary) => ReactNode
}

/**
 * El catálogo en dos secciones: COMPARTIMENTOS (contenedores: Neceser,
 * Mochila…) arriba y ARTÍCULOS debajo. Lo comparten el catálogo (/items) y
 * "Añadir artículos". Si no hay ningún contenedor (p. ej. al buscar), una
 * sola lista sin cabeceras: una cabecera "Artículos" sola no aporta nada.
 * Cada sección conserva el orden alfabético de `items`.
 */
export function CatalogSections({ items, renderRow }: CatalogSectionsProps) {
  const containers = items.filter((item) => item.isContainer)
  const regular = items.filter((item) => !item.isContainer)

  if (containers.length === 0) {
    return <ul className={styles.list}>{regular.map(renderRow)}</ul>
  }
  return (
    <>
      <h2 className={styles.group}>Compartimentos</h2>
      <ul className={styles.list}>{containers.map(renderRow)}</ul>
      {regular.length > 0 && (
        <>
          <h2 className={styles.group}>Artículos</h2>
          <ul className={styles.list}>{regular.map(renderRow)}</ul>
        </>
      )}
    </>
  )
}

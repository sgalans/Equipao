import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useMemo, useState } from 'react'
import { useRepositories } from '@/shared/di/repositories'
import page from '@/shared/ui/page.module.css'
import { normalizeForSearch } from '../domain/search'
import { CatalogRow } from './CatalogRow'
import styles from './ItemsCatalogPage.module.css'

/** Pantalla /items: todos los artículos, para renombrarlos o borrarlos. */
export function ItemsCatalogPage() {
  const { items } = useRepositories()
  const catalog = useLiveQuery(() => items.listWithUsage(), [items])
  const [query, setQuery] = useState('')
  // Acordeón: una sola fila desplegada a la vez (igual que en la maleta).
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const searchId = useId()

  // Misma búsqueda tolerante que las sugerencias (sin tildes ni mayúsculas).
  const visible = useMemo(() => {
    const needle = normalizeForSearch(query)
    if (!catalog || needle === '') return catalog ?? []
    return catalog.filter((item) =>
      normalizeForSearch(item.name).includes(needle),
    )
  }, [catalog, query])

  if (catalog === undefined) {
    return <p aria-busy="true">Cargando artículos…</p>
  }

  return (
    <section>
      <header className={page.header}>
        <h1 className={page.title}>Artículos</h1>
      </header>

      {catalog.length === 0 ? (
        <p className={styles.empty}>
          Aún no tienes artículos. Se crean al añadirlos a una maleta.
        </p>
      ) : (
        <>
          <label htmlFor={searchId} className="visually-hidden">
            Buscar artículos
          </label>
          <input
            id={searchId}
            // type="search": en iOS el teclado muestra "Buscar" y el campo
            // trae su botón de borrar el texto.
            type="search"
            className={styles.search}
            placeholder="Buscar…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
            autoCorrect="off"
          />

          {visible.length === 0 ? (
            <p className={styles.empty}>
              Ningún artículo coincide con «{query.trim()}».
            </p>
          ) : (
            <ul className={styles.list}>
              {visible.map((item) => (
                <CatalogRow
                  key={item.id}
                  item={item}
                  isExpanded={expandedId === item.id}
                  onToggleExpanded={() =>
                    setExpandedId((current) =>
                      current === item.id ? null : item.id,
                    )
                  }
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

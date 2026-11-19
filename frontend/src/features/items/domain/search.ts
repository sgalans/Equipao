/**
 * Búsqueda tolerante para las sugerencias del catálogo: sin distinguir
 * mayúsculas ni tildes ("cepi" encuentra "Cepillo", "camara" encuentra
 * "Cámara").
 *
 * normalize('NFD') separa cada letra de su tilde ("á" → "a" + "´") y luego
 * quitamos las marcas diacríticas. Efecto secundario aceptado: "ñ" → "n";
 * para sugerir, ser algo más permisivo es bueno.
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es')
    .trim()
}

/**
 * Hasta `limit` artículos cuyo nombre contiene la búsqueda, excluyendo los
 * que ya están en la maleta (`excludeIds`). Primero los que EMPIEZAN por el
 * texto (suelen ser lo que buscas), después el resto.
 */
export function suggestItems<T extends { id: string; name: string }>(
  catalog: T[],
  query: string,
  excludeIds: ReadonlySet<string>,
  limit = 5,
): T[] {
  const needle = normalizeForSearch(query)
  if (needle === '') return []

  const startsWith: T[] = []
  const contains: T[] = []
  for (const item of catalog) {
    if (excludeIds.has(item.id)) continue
    const haystack = normalizeForSearch(item.name)
    if (haystack.startsWith(needle)) startsWith.push(item)
    else if (haystack.includes(needle)) contains.push(item)
  }
  return [...startsWith, ...contains].slice(0, limit)
}

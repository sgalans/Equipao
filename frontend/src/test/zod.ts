/**
 * Devuelve las rutas de los campos con error de un `safeParse` de Zod,
 * p. ej. ['endDate'] o ['items.0.name']. Útil para afirmar en un test *qué*
 * campo ha fallado, no solo que algo ha fallado.
 */
export function errorPaths(result: {
  error?: { issues: { path: PropertyKey[] }[] }
}): string[] {
  return result.error?.issues.map((issue) => issue.path.join('.')) ?? []
}

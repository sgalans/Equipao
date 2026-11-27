// Une los nombres como se escribe en español: "«Mochila» y «Maletín»",
// "«A», «B» y «C»". Creado una vez y reutilizado.
const listFormat = new Intl.ListFormat('es', {
  style: 'long',
  type: 'conjunction',
})

/**
 * Aviso en "Añadir a la maleta" cuando se eligen compartimentos y "Dónde"
 * es OTRO compartimento: uno nunca va dentro de otro, así que van sueltos
 * (texto acordado con el usuario, con los nombres de los que "fallan"):
 *   "El compartimento «Mochila» se añadirá suelto en la maleta, no dentro
 *    del compartimento «Neceser»."
 *   "Los compartimentos «Mochila» y «Maletín» se añadirán sueltos en la
 *    maleta, no dentro del compartimento «Neceser»."
 */
export function containersNote(
  containerNames: string[],
  destinationName: string,
): string {
  const names = listFormat.format(containerNames.map((name) => `«${name}»`))
  const subject =
    containerNames.length === 1
      ? `El compartimento ${names} se añadirá suelto`
      : `Los compartimentos ${names} se añadirán sueltos`
  return `${subject} en la maleta, no dentro del compartimento «${destinationName}».`
}

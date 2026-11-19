/**
 * Contenido por defecto de la app (acordado con el usuario, que es el
 * jefe de producto). Son DATOS, no lógica: se revisan y cambian aquí sin
 * tocar el código que los crea (seedDefaults.ts).
 *
 * Los nombres deben ser únicos con el criterio del catálogo
 * (isSameItemName); hay un test que lo comprueba.
 */

/** "Maleta básica": plantilla general para duplicar en cada viaje. */
export const BASIC_LUGGAGE = {
  name: 'Maleta básica',
  description: 'Plantilla base: duplícala (⧉) para cada viaje.',
  loose: [
    'DNI / Pasaporte',
    'Cartera',
    'Llaves de casa',
    'Cargador del móvil',
    'Auriculares',
    'Camisetas',
    'Pantalones',
    'Ropa interior',
    'Calcetines',
    'Pijama',
    'Sudadera',
    'Chanclas',
  ],
  compartments: [
    {
      name: 'Neceser',
      items: [
        'Cepillo de dientes',
        'Pasta de dientes',
        'Desodorante',
        'Champú',
        'Gel de ducha',
        'Peine',
        'Crema solar',
        'Cacao para los labios',
        'Cortaúñas',
        'Medicamentos',
      ],
    },
  ],
} as const

/**
 * Catálogo por defecto. Incluye todo lo de la maleta básica más artículos
 * específicos. Agrupado solo para que sea fácil de revisar: en la app se
 * muestra en orden alfabético.
 */
export const DEFAULT_CATALOG: readonly string[] = [
  // Ropa
  'Camisetas',
  'Camisa',
  'Pantalones',
  'Pantalones cortos',
  'Pantalones de lino',
  'Pantalón de deporte',
  'Vestidos',
  'Falda',
  'Ropa interior',
  'Bóxers',
  'Sujetadores',
  'Calcetines',
  'Medias',
  'Pijama',
  'Sudadera',
  'Chaqueta',
  'Abrigo',
  // Baño y playa
  'Bañador',
  'Bikini',
  'Chanclas de playa',
  'Toalla de playa',
  'Toalla de piscina',
  'Toalla',
  'Gafas de sol',
  'Gorra',
  // Calzado
  'Zapatillas',
  'Zapatos',
  'Chanclas',
  'Zapatillas de casa',
  // Frío y nieve
  'Gorro',
  'Guantes',
  'Bufanda',
  'Buff',
  'Guantes de nieve',
  'Pantalones de nieve',
  'Mallas térmicas',
  // Aseo
  'Cepillo de dientes',
  'Pasta de dientes',
  'Desodorante',
  'Champú',
  'Gel de ducha',
  'Peine',
  'Crema solar',
  'Cacao para los labios',
  'Cortaúñas',
  'Colonia',
  'Máquina de afeitar',
  'Espuma de afeitar',
  'Cera para el pelo',
  'Maquillaje',
  'Desmaquillante',
  'Compresas / Tampones',
  'Gomas del pelo',
  'Secador',
  'Lentillas',
  'Gafas graduadas',
  // Salud
  'Medicamentos',
  'Tiritas',
  'Repelente de mosquitos',
  // Electrónica
  'Cargador del móvil',
  'Batería externa',
  'Auriculares',
  'Altavoz',
  'Portátil',
  'Cargador del portátil',
  'Ratón',
  'Teclado',
  'Adaptador de enchufe',
  // Documentos y llaves
  'DNI / Pasaporte',
  'Cartera',
  'Llaves de casa',
  'Llaves del coche',
  'Llaves de la moto',
  // Varios
  'Bolsa para la ropa sucia',
  'Botella de agua',
  'Libro',
  'Libreta',
  'Bolígrafos',
  'Baraja de cartas',
  'Regalos',
  'Pala de pádel',
  'Sábanas',
  'Funda de almohada',
  'Paraguas',
]

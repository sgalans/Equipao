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
  // Instrucciones de uso dentro de la propia maleta (decisión del usuario):
  // ayuda en contexto, sin pantallas de bienvenida. La PRIMERA línea es la
  // única que se ve en la tarjeta del listado: invita a abrirla. Solo
  // trucos que no se ven a simple vista. Máx. 1000 caracteres (hay un test).
  // "Nueva maleta" → "Empezar con" no copia la descripción (la de la copia
  // es la que se escribe), así los trucos no acaban en cada viaje.
  description: [
    'Instrucciones básicas de uso, ábreme :)',
    '',
    'Crea tu primera maleta: en "Mis maletas" pulsa «Nueva maleta» y empieza con esta que ya tiene elementos básicos.',
    '',
    'Esta maleta sirve de plantilla, ajustala a tu gusto: añadiendo, quitando o renombrando artículos y compartimentos',
    '',
    'Trucos:',
    '• Toca la barra de progreso para ver todo lo que está listo.',
    '• El ojo oculta los artículos y compartimentos listos sin mover nada.',
    '• Toca un artículo para cambiar las unidades, renombrarlo o quitarlo.',
    '• Arrastra usando ≡ para ordenar (o ↑ ↓ al tocar un artículo).',
    '• ⋯ → Compartir: manda la lista por WhatsApp.',
    '• Los compartimentos (neceser, mochila…) guardan artículos y se pliegan solos al estar todo listo.',
    '• Consulta todos tus artículos y compartimentos en el catálogo: Mis maletas → Catálogo.',
  ].join('\n'),
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

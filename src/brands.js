import { normalize } from './data.js'

// Logos (public/marcas) extraídos del Excel de precios. Clave = archivo, match = textos de Marca que lo usan
const LOGOS = [
  ['union-ganadera', ['union ganadera', 'ug']],
  ['victoria', ['victoria']],
  ['fargo', ['fargo']],
  ['tuki', ['tuki']],
  ['krachitos', ['krachitos', 'kranchitos']],
  ['pehuamar', ['pehuamar']],
  ['pringles', ['pringles']],
  ['kansas', ['kansas']],
  ['la-quesera', ['la quesera']],
  ['tonadita', ['tonadita']],
  ['milkaut', ['milkaut']],
  ['el-sabor-del-pan', ['el sabor del pan']],
  ['simplot', ['simplot']],
  ['lamb-weston', ['lamb weston', 'lamweston']],
  ['mccain', ['mccain']],
  ['butler', ['butler']],
  ['natura', ['natura']],
  ['benidorm', ['benidorm']],
  ['hellmanns', ['hellmann']],
  ['savora', ['savora']],
  ['mcdonalds', ['mcdonald']],
  ['adler', ['adler']],
  ['finca-las-bayas', ['finca las bayas']],
  ['ardo', ['ardo']],
  ['scudetto', ['scudetto']],
  ['granja-tres-arroyos', ['grangy']],
].map(([file, keys]) => ({ file, keys: keys.map(normalize) }))

const NOMBRES = {
  'union-ganadera': 'Unión Ganadera', 'el-sabor-del-pan': 'El Sabor del Pan', 'lamb-weston': 'Lamb Weston', mccain: 'McCain',
  hellmanns: 'Hellmann´s', mcdonalds: 'McDonald´s', 'finca-las-bayas': 'Finca las Bayas', 'la-quesera': 'La Quesera',
  'granja-tres-arroyos': 'Granja Tres Arroyos',
}
// '/marcas/mccain.webp' -> 'McCain'
export const nombreLogo = (ruta) => {
  const f = ruta.split('/').pop().replace('.webp', '')
  return NOMBRES[f] || f.charAt(0).toUpperCase() + f.slice(1)
}

const cache = new Map()
// "Unión Ganadera / Fargo" -> ['/marcas/union-ganadera.webp', '/marcas/fargo.webp']
export function logosDe(marca) {
  if (!marca) return []
  if (cache.has(marca)) return cache.get(marca)
  const partes = marca.split('/').map((p) => normalize(p).replace(/[^a-z0-9 ]/g, '').trim())
  const out = []
  for (const p of partes) {
    const l = LOGOS.find((x) => x.keys.some((k) => p === k || p.startsWith(k + ' ') || p.includes(k) && k.length > 3))
    if (l && !out.includes(l.file)) out.push(l.file)
  }
  const res = out.map((f) => `/marcas/${f}.webp`)
  cache.set(marca, res)
  return res
}

const slug = (s) => normalize(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const FOTOS = new Set(['hamburguesas', 'medallones', 'combos', 'panchos-y-salchichas', 'pan', 'quesos', 'fiambres', 'rebozados',
  'papas-congeladas', 'aderezos-y-salsas', 'aceites', 'snacks', 'lacteos', 'bebidas', 'alfajores', 'frutas-y-verduras', 'bondiolas'])
export const fotoCategoria = (cat) => `/img/${FOTOS.has(slug(cat)) ? slug(cat) : 'otros'}.webp`

export const TAGLINES = {
  'Hamburguesas': '100% carne, del freezer a la plancha',
  'Medallones': 'Rendidores y económicos',
  'Combos': 'Con pan de papa, listos para vender',
  'Panchos y Salchichas': 'El clásico que nunca falla',
  'Pan': 'Pan fresco para cada ocasión',
  'Quesos': 'Cheddar y fetas para coronar',
  'Fiambres': 'Calidad fiambrería',
  'Rebozados': 'Crocantes por fuera, tiernos por dentro',
  'Papas congeladas': 'Las mejores marcas del mercado',
  'Aderezos y Salsas': 'El toque final',
  'Aceites': 'Para cocina y freidora',
  'Snacks': 'Para picar en cualquier momento',
  'Lácteos': 'Leche y chocolatada',
  'Bebidas': 'Bien frías, para acompañar',
  'Alfajores': 'El dulce argentino',
  'Frutas y Verduras': 'Congelados listos para usar',
  'Bondiolas': 'Para sándwiches de bondiola',
}

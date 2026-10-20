import { normalize } from './data.js'

// ---------- Subfiltros por categoría ----------
// Cada producto se clasifica por su nombre/detalle/marca: un producto nuevo cae solo en su subfiltro (o en "Otros").
const gramos = (p) => Number((p.producto.match(/(\d+)\s*g(?:r)?\b/i) || [])[1]) || 0
const txt = (p) => normalize(`${p.producto} ${p.detalle}`)
const por = (fn, orden) => ({ fn, orden })
const reglas = (lista) => (p) => {
  const t = txt(p)
  for (const [nombre, re] of lista) if (re.test(t)) return nombre
  return 'Otros'
}

const TAMANIO = por((p) => {
  const g = gramos(p)
  if (!g) return 'Otros'
  return g <= 69 ? 'Chicas' : g <= 110 ? 'Medianas' : 'Grandes'
}, ['Chicas', 'Medianas', 'Grandes', 'Otros'])

const SUBFILTROS = {
  'Hamburguesas': TAMANIO,
  'Medallones': TAMANIO,
  'Combos': por((p) => (/promo/.test(txt(p)) ? 'Promos x4' : 'Combos x12'), ['Combos x12', 'Promos x4']),
  'Aderezos y Salsas': por(reglas([
    ['Balde 3 kg', /\b(3|2,9|2\.9)\s*k(g|gr|ilo)?s?\b|3kgr/],
    ['Sachets', /sachet|\b8\s*gr?\b|192u/],
  ]), ['Otros', 'Balde 3 kg', 'Sachets']),
  'Pan': por(reglas([
    ['Pancho', /pancho/],
    ['Lomito', /lomito/],
    ['Pan de mesa', /pan de mesa|lactal/],
    ['Hamburguesa', /hamb|pan de papa|artesanal|\bh x\d/],
  ]), ['Hamburguesa', 'Pancho', 'Lomito', 'Pan de mesa', 'Otros']),
  'Papas congeladas': por((p) => p.marca || 'Otros', null),
  'Quesos': por(reglas([
    ['Dip', /\bdip\b/],
    ['Pouch', /pouch/],
    ['Barras', /\bbarras?\b/],
    ['Cheddar en fetas', /cheddar|feta/],
  ]), ['Cheddar en fetas', 'Barras', 'Pouch', 'Dip', 'Otros']),
  'Rebozados': por(reglas([
    ['Pollo', /nugg|pollo|crispy|suprema|ricosaur/],
    ['Queso y muzzarella', /pickers|baston|teque|muzza|mozza/],
    ['Veggie', /brocoli|calabaza|espinaca|vegan|vegetal/],
    ['Queso y muzzarella', /queso/],
  ]), ['Pollo', 'Queso y muzzarella', 'Veggie', 'Otros']),
  'Frutas y Verduras': por(reglas([['Frutas', /durazno|frutilla|arandano|anana|frutos rojos|mango|palta/]]), ['Frutas', 'Otros']),
  'Snacks': por((p) => p.marca || 'Otros', null),
  'Bebidas': por(reglas([
    ['Gaseosas chicas', /pequena/],
    ['Gaseosas grandes', /grande/],
    ['Jugos', /jugo|baggio/],
  ]), ['Gaseosas chicas', 'Gaseosas grandes', 'Jugos', 'Otros']),
  'Fiambres': por(reglas([
    ['Jamón crudo', /crudo/],
    ['Jamón cocido', /cocido/],
    ['Panceta', /panceta/],
    ['Mortadela', /mortadela/],
  ]), ['Jamón crudo', 'Jamón cocido', 'Panceta', 'Mortadela', 'Otros']),
}
// Lo que no entra en ninguna regla: en Frutas y Verduras es verdura, en Aderezos es envase chico
const RENOMBRE = { 'Frutas y Verduras': { Otros: 'Verduras' }, 'Aderezos y Salsas': { Otros: 'Envase chico' } }

export function subfiltroDe(p) {
  const s = SUBFILTROS[p.categoria]
  if (!s) return null
  const n = s.fn(p)
  return RENOMBRE[p.categoria]?.[n] || n
}

// Opciones disponibles para una categoría (solo si hay al menos 2 grupos con productos)
export function opcionesSubfiltro(cat, productos) {
  const s = SUBFILTROS[cat]
  if (!s) return []
  const cuenta = new Map()
  for (const p of productos) if (p.categoria === cat) { const k = subfiltroDe(p); cuenta.set(k, (cuenta.get(k) || 0) + 1) }
  let orden = s.orden ? s.orden.map((o) => RENOMBRE[cat]?.[o] || o) : [...cuenta.keys()].sort((a, b) => (a === 'Otros') - (b === 'Otros'))
  orden = orden.filter((o) => cuenta.has(o))
  return orden.length >= 2 ? orden.map((o) => ({ nombre: o, n: cuenta.get(o) })) : []
}

// ---------- Agrupación por cantidad ----------
// "12 Hamburguesas UG 69g" / "Barras Milkaut x 4" / "Leche larga vida Milkaut (unidad)" -> una tarjeta con tabla de cantidades
const AGRUPABLES = new Set(['Hamburguesas', 'Medallones', 'Quesos', 'Lácteos'])

function parseCantidad(p) {
  let m = p.producto.match(/^(\d+)\s+(Hamburguesas|Medallones)\s+(.*)$/i)
  if (m) {
    const resto = m[3].replace(/(\d+)\s*g(r)?\b/i, '$1gr')
    return { base: `${m[2]} ${resto}`, qty: Number(m[1]), label: `x${m[1]}`, porUnidad: true, conDetalle: true }
  }
  m = p.producto.match(/^(.*?)\s+x\s*(\d+)$/i)
  if (m) return { base: m[1], qty: Number(m[2]), label: `x${m[2]}`, porUnidad: false, conDetalle: false }
  m = p.producto.match(/^(.*?)\s+\(unidad\)$/i)
  if (m) return { base: m[1], qty: 0, label: 'Unidad', porUnidad: false, conDetalle: false }
  return null
}

// Devuelve una lista de items: { tipo: 'producto', p } o { tipo: 'grupo', key, titulo, ... filas }
export function agrupar(productos) {
  const out = []; const grupos = new Map()
  for (const p of productos) {
    const c = AGRUPABLES.has(p.categoria) ? parseCantidad(p) : null
    if (!c) { out.push({ tipo: 'producto', p }); continue }
    const key = [p.lista, p.categoria, p.marca, c.base, c.conDetalle ? p.detalle : ''].join('|')
    if (!grupos.has(key)) {
      const g = { tipo: 'grupo', key, titulo: c.base, marca: p.marca, categoria: p.categoria, lista: p.lista,
        detalle: c.conDetalle ? p.detalle : '', porUnidad: c.porUnidad, filas: [] }
      grupos.set(key, g); out.push(g)
    }
    grupos.get(key).filas.push({ p, qty: c.qty, label: c.label })
  }
  return out.map((it) => {
    if (it.tipo !== 'grupo') return it
    if (it.filas.length < 2) return { tipo: 'producto', p: it.filas[0].p }
    it.filas.sort((a, b) => a.qty - b.qty)
    // columnas = nombres de variante; si cada fila tiene una sola variante con nombre propio ("4 unidades"), una sola columna "Precio"
    const unaSola = it.filas.every((f) => f.p.variantes.length === 1)
    it.columnas = unaSola ? ['Precio'] : [...new Set(it.filas.flatMap((f) => f.p.variantes.map((v) => v.nombre)))]
    it.unaSola = unaSola
    // detalle por fila cuando difiere (ej. leches: 12lts / 36lts)
    const dets = new Set(it.filas.map((f) => f.p.detalle))
    it.detallePorFila = !it.detalle && dets.size > 1
    if (!it.detalle && dets.size === 1) it.detalle = [...dets][0]
    const st = it.filas.flatMap((f) => f.p.variantes.map((v) => v.stock))
    it.stock = st.every((s) => s === 'sin') ? 'sin' : ''
    return it
  })
}

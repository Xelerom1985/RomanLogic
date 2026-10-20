import Papa from 'papaparse'

// Google Sheets publicado como CSV (Archivo → Compartir → Publicar en la Web)
const BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTeGIM17OcxV8CIBUFVemumuhoyL-jPgU9cMs00_j0nK9ZJQ_GrKgE4F9yxuRyF045uRTM9OKqYIU2q/pub'
export const APP_URL = `${BASE}?gid=689900947&single=true&output=csv`
// Solapa APP_CONFIG publicada (null = usar DEFAULT_CONFIG)
export const CONFIG_GID = '335456408'
const CONFIG_URL = CONFIG_GID ? `${BASE}?gid=${CONFIG_GID}&single=true&output=csv` : null

export const DEFAULT_CONFIG = {
  negocio: 'Distribución ROMÁN Logic',
  slogan: 'Momentos únicos',
  whatsapp: '5491167610307',
  fecha_lista: '',
  aviso: 'Los valores pueden ser modificados sin previo aviso.',
}

export const CATEGORIAS = [
  'Hamburguesas', 'Medallones', 'Combos', 'Panchos y Salchichas', 'Pan', 'Quesos', 'Fiambres', 'Rebozados',
  'Papas congeladas', 'Aderezos y Salsas', 'Aceites', 'Snacks', 'Lácteos', 'Bebidas', 'Alfajores',
  'Frutas y Verduras', 'Bondiolas', 'Otros',
]

const CACHE_KEY = 'roman-logic-cache-v1'

// "$ 110882.2000" -> 110882.2 ; "-" / "" / "#REF!" -> null
export function parsePrecio(s) {
  if (s == null) return null
  let t = String(s).replace(/[^\d.,-]/g, '')
  if (!t || t === '-') return null
  if (t.includes(',') && t.includes('.')) {
    t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  } else if (t.includes(',')) {
    t = t.replace(',', '.')
  }
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

const csv = (text) => Papa.parse(text, { header: true, skipEmptyLines: true }).data

async function fetchText(url) {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.text()
}

// Agrupa las filas (una por precio) en productos con sus variantes
// La marca es "Krachitos" (así figura en su logo); en la planilla quedó como "Kranchitos"
const fixNombre = (s) => (s || '').replace(/Kranchitos/g, 'Krachitos')

export function buildCatalog(rows) {
  const productos = new Map()
  for (const raw of rows) {
    const r = { ...raw, Marca: fixNombre(raw.Marca), Producto: fixNombre(raw.Producto) }
    const precio = parsePrecio(r.Precio)
    const activo = String(r.Activo).toUpperCase() === 'TRUE' || r.Activo === 'VERDADERO'
    if (!activo || precio == null || precio <= 0) continue
    const key = [r.Lista, r.Categoria, r.Marca, r.Producto, r.Detalle].join('|')
    if (!productos.has(key)) {
      productos.set(key, {
        key, lista: r.Lista, categoria: r.Categoria || 'Otros', marca: r.Marca, producto: r.Producto,
        detalle: r.Detalle, unidad: r.Unidad, orden: Number(r.Orden) || 0, variantes: [],
      })
    }
    productos.get(key).variantes.push({ id: r.ID, nombre: r.Variante, precio, unidad: r.Unidad })
  }
  const catIdx = (c) => { const i = CATEGORIAS.indexOf(c); return i < 0 ? 99 : i }
  return [...productos.values()].sort((a, b) => catIdx(a.categoria) - catIdx(b.categoria) || a.orden - b.orden)
}

function parseConfig(rows) {
  const cfg = { ...DEFAULT_CONFIG }
  const notas = []
  for (const r of rows) {
    const k = (r.Clave || '').trim(); const v = (r.Valor || '').trim()
    if (!k || !v) continue
    if (k.startsWith('nota_')) notas.push(v); else cfg[k] = v
  }
  cfg.notas = notas
  return cfg
}

export function loadCached() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) } catch { return null }
}

export async function loadData() {
  const [appText, cfgText] = await Promise.all([
    fetchText(APP_URL),
    CONFIG_URL ? fetchText(CONFIG_URL).catch(() => null) : Promise.resolve(null),
  ])
  const data = {
    productos: buildCatalog(csv(appText)),
    config: cfgText ? parseConfig(csv(cfgText)) : { ...DEFAULT_CONFIG, notas: [] },
    actualizado: new Date().toISOString(),
  }
  if (!data.productos.length) throw new Error('La lista llegó vacía')
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch { /* sin storage */ }
  return data
}

const fmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
export const money = (n) => fmt.format(Math.round(n))

export const normalize = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

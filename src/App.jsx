import { useEffect, useMemo, useState } from 'react'
import { CATEGORIAS, DEFAULT_CONFIG, loadCached, loadData, money, normalize } from './data.js'
import { TAGLINES, fotoCategoria, logosDe, nombreLogo } from './brands.js'

const LISTAS = ['Minorista', 'Mayorista']
const CART_KEY = 'roman-logic-pedido-v1'
const LISTA_KEY = 'roman-logic-lista'

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v) } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* sin storage */ } },
}

export default function App() {
  const [data, setData] = useState(() => loadCached())
  const [estado, setEstado] = useState('cargando') // cargando | ok | offline | error
  const [lista, setLista] = useState(() => store.get(LISTA_KEY, 'Minorista'))
  const [cat, setCat] = useState('Todas')
  const [marca, setMarca] = useState(null) // ruta del logo seleccionado
  const [q, setQ] = useState('')
  const [cart, setCart] = useState(() => store.get(CART_KEY, {}))
  const [verPedido, setVerPedido] = useState(false)

  const refrescar = () => {
    setEstado('cargando')
    loadData()
      .then((d) => { setData(d); setEstado('ok') })
      .catch(() => setEstado(loadCached() ? 'offline' : 'error'))
  }
  useEffect(refrescar, [])
  useEffect(() => store.set(LISTA_KEY, lista), [lista])
  useEffect(() => store.set(CART_KEY, cart), [cart])

  // al llegar precios nuevos, actualizar los del pedido (y quitar lo que ya no está activo)
  useEffect(() => {
    if (!data) return
    const vigentes = new Map()
    for (const p of data.productos) for (const v of p.variantes) vigentes.set(v.id, v.precio)
    setCart((c) => {
      const n = {}
      for (const [id, it] of Object.entries(c)) if (vigentes.has(id)) n[id] = { ...it, precio: vigentes.get(id) }
      return n
    })
  }, [data])

  const config = data?.config || { ...DEFAULT_CONFIG, notas: [] }
  const deLista = useMemo(() => (data?.productos || []).filter((p) => p.lista === lista), [data, lista])
  const cats = useMemo(() => {
    const s = new Set(deLista.map((p) => p.categoria))
    return CATEGORIAS.filter((c) => s.has(c)).concat([...s].filter((c) => !CATEGORIAS.includes(c)))
  }, [deLista])
  const marcas = useMemo(() => {
    const cuenta = new Map()
    for (const p of deLista) for (const l of logosDe(p.marca)) cuenta.set(l, (cuenta.get(l) || 0) + 1)
    return [...cuenta.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l)
  }, [deLista])
  useEffect(() => { if (cat !== 'Todas' && !cats.includes(cat)) setCat('Todas') }, [cats, cat])
  useEffect(() => { if (marca && !marcas.includes(marca)) setMarca(null) }, [marcas, marca])

  const visibles = useMemo(() => {
    const words = normalize(q).split(/\s+/).filter(Boolean)
    return deLista.filter((p) => {
      if (cat !== 'Todas' && p.categoria !== cat) return false
      if (marca && !logosDe(p.marca).includes(marca)) return false
      if (!words.length) return true
      const hay = normalize([p.producto, p.marca, p.detalle, p.categoria, ...p.variantes.map((v) => v.nombre)].join(' '))
      return words.every((w) => hay.includes(w))
    })
  }, [deLista, cat, marca, q])

  const grupos = useMemo(() => {
    const m = new Map()
    for (const p of visibles) { if (!m.has(p.categoria)) m.set(p.categoria, []); m.get(p.categoria).push(p) }
    return [...m.entries()]
  }, [visibles])

  const setQty = (p, v, qty) => setCart((c) => {
    const n = { ...c }
    if (qty <= 0) delete n[v.id]
    else n[v.id] = { qty, precio: v.precio, producto: p.producto, variante: v.nombre, marca: p.marca, lista: p.lista, categoria: p.categoria }
    return n
  })
  const items = Object.entries(cart)
  const total = items.reduce((s, [, it]) => s + it.qty * it.precio, 0)
  const unidades = items.reduce((s, [, it]) => s + it.qty, 0)
  const fecha = (config.fecha_lista || '').split(/\s+LOS VALORES/i)[0].trim()
  const elegirCat = (c) => { setCat(c); window.scrollTo({ top: document.getElementById('catalogo')?.offsetTop - 4 || 0, behavior: 'smooth' }) }

  return (
    <div className="mx-auto max-w-3xl pb-28">
      <Hero config={config} fecha={fecha} estado={estado} refrescar={refrescar} />

      <div id="catalogo" className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--bg)] px-4 pt-3 pb-2 shadow-lg shadow-black/40">
        <div className="grid grid-cols-2 rounded-xl bg-[var(--bg2)] p-1 text-sm font-semibold">
          {LISTAS.map((l) => (
            <button key={l} onClick={() => setLista(l)}
              className={`rounded-lg py-2 transition ${lista === l ? 'bg-[var(--accent)] text-black shadow' : 'text-[var(--muted)]'}`}>
              {l}
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto, marca…" type="search"
          className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg2)] px-3 py-2 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]" />
        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
          {['Todas', ...cats].map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border py-0.5 pr-3 text-xs ${c === 'Todas' ? 'pl-3' : 'pl-0.5'} ${cat === c
                ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent2)]'
                : 'border-[var(--line)] text-[var(--muted)]'}`}>
              {c !== 'Todas' && <img src={fotoCategoria(c)} alt="" className="h-6 w-6 rounded-full object-cover" />}
              {c}
            </button>
          ))}
        </div>
        {marca && (
          <button onClick={() => setMarca(null)}
            className="mt-1.5 flex items-center gap-2 rounded-full bg-white py-0.5 pr-3 pl-1 text-xs font-semibold text-black">
            <img src={marca} alt="" className="h-6 w-10 object-contain" />
            <span>{nombreLogo(marca)}</span> ✕
          </button>
        )}
      </div>

      {estado === 'offline' && (
        <p className="mx-4 mt-3 rounded-lg bg-[var(--red)]/15 px-3 py-2 text-xs text-red-300">
          Sin conexión: mostrando la última lista descargada ({new Date(data.actualizado).toLocaleString('es-AR')}).
        </p>
      )}
      {estado === 'error' && !data && (
        <div className="mx-4 mt-10 text-center text-sm text-[var(--muted)]">
          No se pudo cargar la lista de precios.<br />
          <button onClick={refrescar} className="mt-3 rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-black">Reintentar</button>
        </div>
      )}
      {!data && estado === 'cargando' && <p className="mt-10 text-center text-sm text-[var(--muted)]">Cargando lista de precios…</p>}

      {data && cat === 'Todas' && !q && !marca && (
        <>
          <Marcas marcas={marcas} onPick={setMarca} />
          <Categorias cats={cats} deLista={deLista} onPick={elegirCat} />
        </>
      )}

      <main className="px-4">
        {data && !visibles.length && <p className="mt-10 text-center text-sm text-[var(--muted)]">No hay productos para “{q}”.</p>}
        {grupos.map(([c, prods]) => (
          <section key={c} className="mt-6">
            <BannerCategoria cat={c} n={prods.length} />
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {prods.map((p) => <Producto key={p.key} p={p} cart={cart} setQty={setQty} />)}
            </div>
          </section>
        ))}
      </main>

      {data && <Pie config={config} fecha={fecha} actualizado={data.actualizado} />}

      {items.length > 0 && !verPedido && (
        <button onClick={() => setVerPedido(true)}
          className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-3xl items-center justify-between rounded-2xl bg-[var(--accent)] px-5 py-3.5 font-bold text-black shadow-2xl shadow-black/60 active:scale-[0.99]">
          <span>🛒 Ver pedido · {unidades} {unidades === 1 ? 'ítem' : 'ítems'}</span>
          <span>{money(total)}</span>
        </button>
      )}
      {verPedido && <Pedido items={items} total={total} config={config} setCart={setCart} onClose={() => setVerPedido(false)} />}
    </div>
  )
}

// Instalación PWA: Android/Chrome usa el evento beforeinstallprompt; iPhone no lo tiene y hay que explicar los pasos
const esStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

function useInstalar() {
  const [evento, setEvento] = useState(null)
  const [instalada, setInstalada] = useState(esStandalone)
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setEvento(e) }
    const onInstalled = () => { setInstalada(true); setEvento(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [])
  const ios = esIOS()
  return { visible: !instalada && (!!evento || ios), ios, instalar: async () => { if (!evento) return; evento.prompt(); await evento.userChoice; setEvento(null) } }
}

function Hero({ config, fecha, estado, refrescar }) {
  const inst = useInstalar()
  const [ayudaIOS, setAyudaIOS] = useState(false)
  return (
    <header className="relative overflow-hidden">
      <img src="/img/hero.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/50 to-[var(--bg)]" />
      <button onClick={refrescar} aria-label="Actualizar precios"
        className="absolute top-3 right-3 z-10 rounded-full bg-black/45 px-3 py-1.5 text-xs text-white/85 active:scale-95">
        {estado === 'cargando' ? 'Actualizando…' : '↻ Actualizar'}
      </button>
      <div className="relative flex flex-col items-center px-6 pt-8 pb-7 text-center">
        <img src="/img/logo-transparente.webp" alt="" className="w-64 max-w-[78vw] drop-shadow-[0_4px_14px_rgba(0,0,0,0.95)]" />
        <h1 className="sr-only">{config.negocio} — {config.slogan}</h1>
        {inst.visible && (
          <button onClick={() => (inst.ios ? setAyudaIOS(true) : inst.instalar())}
            className="mt-3 rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-extrabold text-black shadow-lg shadow-black/50 active:scale-95">
            📲 Instalar app
          </button>
        )}
        {ayudaIOS && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setAyudaIOS(false)}>
            <div className="safe-bottom w-full rounded-t-3xl bg-[var(--bg2)] p-5 text-left text-sm" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold">Instalar en iPhone</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-[var(--text)]">
                <li>Abrí esta página en <b>Safari</b>.</li>
                <li>Tocá el botón <b>Compartir</b> <span className="rounded bg-white/10 px-1.5">⬆︎</span> (abajo en la pantalla).</li>
                <li>Elegí <b>“Agregar a pantalla de inicio”</b> y tocá <b>Agregar</b>.</li>
              </ol>
              <button onClick={() => setAyudaIOS(false)} className="mt-4 w-full rounded-xl bg-[var(--accent)] py-3 font-bold text-black">Entendido</button>
            </div>
          </div>
        )}
        <p className="mt-3 max-w-xs text-[13px] leading-snug text-white/80">
          Hamburguesas, panchos, papas, quesos y todo para tu negocio gastronómico.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <a href={`https://wa.me/${config.whatsapp}`} target="_blank" rel="noreferrer"
            className="rounded-full bg-[var(--wa)] px-4 py-2 text-sm font-bold text-black shadow-lg active:scale-95">
            Consultanos por WhatsApp
          </a>
          {fecha && <span className="rounded-full border border-white/25 bg-black/30 px-3 py-1.5 text-xs text-white/85">{fecha}</span>}
        </div>
      </div>
    </header>
  )
}

function Marcas({ marcas, onPick }) {
  if (!marcas.length) return null
  return (
    <section className="mt-5">
      <h2 className="px-4 text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Trabajamos con las mejores marcas</h2>
      <div className="no-scrollbar mt-2 flex gap-2.5 overflow-x-auto px-4 pb-1">
        {marcas.map((m) => (
          <button key={m} onClick={() => onPick(m)} aria-label={`Ver productos ${nombreLogo(m)}`}
            className="flex h-16 w-24 shrink-0 items-center justify-center rounded-2xl bg-white p-2 shadow-md shadow-black/30 active:scale-95">
            <img src={m} alt={nombreLogo(m)} loading="lazy" className="max-h-full max-w-full object-contain" />
          </button>
        ))}
      </div>
    </section>
  )
}

function Categorias({ cats, deLista, onPick }) {
  const n = (c) => deLista.filter((p) => p.categoria === c).length
  return (
    <section className="mt-6 px-4">
      <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Categorías</h2>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {cats.map((c) => (
          <button key={c} onClick={() => onPick(c)}
            className="group relative aspect-[4/3] overflow-hidden rounded-2xl text-left shadow-md shadow-black/40 active:scale-[0.98]">
            <img src={fotoCategoria(c)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
            <div className="absolute inset-x-2 bottom-1.5">
              <p className="text-[13px] font-bold leading-tight text-white">{c}</p>
              <p className="text-[10px] text-white/70">{n(c)} productos</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

function BannerCategoria({ cat, n }) {
  return (
    <div className="relative h-28 overflow-hidden rounded-2xl">
      <img src={fotoCategoria(cat)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent" />
      <div className="relative flex h-full flex-col justify-end p-4">
        <h2 className="text-xl font-black uppercase tracking-wide text-white">{cat}</h2>
        <p className="text-xs text-white/80">{TAGLINES[cat] || ''}{TAGLINES[cat] ? ' · ' : ''}{n} productos</p>
      </div>
    </div>
  )
}

function Producto({ p, cart, setQty }) {
  const logos = logosDe(p.marca)
  return (
    <article className="flex gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-3">
      <div className="flex w-16 shrink-0 flex-col gap-1.5">
        {logos.length ? logos.map((l) => (
          <div key={l} className="flex h-14 items-center justify-center rounded-xl bg-white p-1.5">
            <img src={l} alt={p.marca} loading="lazy" className="max-h-full max-w-full object-contain" />
          </div>
        )) : (
          <img src={fotoCategoria(p.categoria)} alt="" loading="lazy" className="h-16 w-16 rounded-xl object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold leading-snug">{p.producto}</h3>
        {(p.marca || p.detalle) && (
          <p className="mt-0.5 text-xs text-[var(--muted)]">{[p.marca, p.detalle].filter(Boolean).join(' · ')}</p>
        )}
        <ul className="mt-1.5 divide-y divide-[var(--line)]">
          {p.variantes.map((v) => {
            const qty = cart[v.id]?.qty || 0
            return (
              <li key={v.id} className="flex items-center justify-between gap-2 py-1.5">
                <div className="min-w-0">
                  <span className="text-xs text-[var(--muted)]">{v.nombre}</span>
                  <div className="text-[17px] font-extrabold text-[var(--accent2)]">{money(v.precio)}</div>
                </div>
                {qty === 0 ? (
                  <button onClick={() => setQty(p, v, 1)} aria-label={`Agregar ${p.producto} ${v.nombre}`}
                    className="rounded-lg bg-[var(--accent)]/12 px-3 py-1.5 text-sm font-semibold text-[var(--accent2)] ring-1 ring-[var(--accent)] active:scale-95">
                    + Agregar
                  </button>
                ) : (
                  <Stepper qty={qty} onChange={(n) => setQty(p, v, n)} />
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </article>
  )
}

function Pie({ config, fecha, actualizado }) {
  const guia = []; const notas = []; const vistas = new Set()
  for (const n of config.notas || []) {
    const m = n.match(/^Gu[ií]a de tamaños:\s*(.+)$/i)
    if (m) { guia.push(m[1].split('·').map((s) => s.trim())); continue }
    const k = normalize(n).replace(/[^a-z0-9]/g, '')
    if ([...vistas].some((v) => v.includes(k) || k.includes(v))) continue
    vistas.add(k); notas.push(n)
  }
  return (
    <footer className="mt-10 space-y-4 px-4 text-center text-[11px] text-[var(--muted)]">
      {notas.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {notas.map((n, i) => <span key={i} className="rounded-full border border-[var(--line)] px-2.5 py-1">{n}</span>)}
        </div>
      )}
      {guia.length > 0 && (
        <table className="mx-auto text-left">
          <caption className="mb-1 font-semibold text-[var(--text)]">Guía de tamaños</caption>
          <thead><tr className="text-[var(--accent)]"><th className="pr-4">Gramos</th><th className="pr-4">Diámetro</th><th>Grosor</th></tr></thead>
          <tbody>{guia.map((g, i) => <tr key={i}>{g.map((c, j) => <td key={j} className="pr-4">{c}</td>)}</tr>)}</tbody>
        </table>
      )}
      <div className="space-y-0.5">
        <img src="/img/logo.webp" alt="" className="mx-auto mb-1 h-20 w-20 rounded-2xl" />
        {fecha && <p className="text-[var(--text)]">{fecha}</p>}
        <p>{config.aviso}</p>
        <p>Actualizado: {new Date(actualizado).toLocaleString('es-AR')}</p>
        <p className="pt-1 opacity-70">Fotos de categorías: Unsplash</p>
      </div>
    </footer>
  )
}

function Stepper({ qty, onChange }) {
  return (
    <div className="flex items-center overflow-hidden rounded-lg bg-[var(--accent)] font-bold text-black">
      <button onClick={() => onChange(qty - 1)} className="px-3 py-1.5 active:bg-black/10" aria-label="Quitar uno">−</button>
      <span className="min-w-6 text-center">{qty}</span>
      <button onClick={() => onChange(qty + 1)} className="px-3 py-1.5 active:bg-black/10" aria-label="Agregar uno">+</button>
    </div>
  )
}

function Pedido({ items, total, config, setCart, onClose }) {
  const [nombre, setNombre] = useState(() => store.get('roman-logic-nombre', ''))
  const [nota, setNota] = useState('')
  useEffect(() => store.set('roman-logic-nombre', nombre), [nombre])

  const mensaje = () => {
    const porLista = {}
    for (const [, it] of items) (porLista[it.lista] ||= []).push(it)
    const lineas = [`¡Hola ${config.negocio}! Quiero hacer este pedido:`]
    for (const [l, its] of Object.entries(porLista)) {
      lineas.push('', `*Lista ${l}*`)
      for (const it of its) lineas.push(`• ${it.qty} × ${it.producto} — ${it.variante} (${money(it.precio)}) = ${money(it.qty * it.precio)}`)
    }
    lineas.push('', `*Total estimado: ${money(total)}*`)
    if (nombre.trim()) lineas.push(`Nombre: ${nombre.trim()}`)
    if (nota.trim()) lineas.push(`Nota: ${nota.trim()}`)
    return lineas.join('\n')
  }
  const enviar = () => window.open(`https://wa.me/${config.whatsapp}?text=${encodeURIComponent(mensaje())}`, '_blank')
  const setQty = (id, qty) => setCart((c) => {
    const n = { ...c }
    if (qty <= 0) delete n[id]; else n[id] = { ...n[id], qty }
    return n
  })

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black/60" onClick={onClose}>
      <div className="safe-bottom mt-auto max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-[var(--bg2)] p-4 sm:mx-auto sm:max-w-3xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Tu pedido</h2>
          <button onClick={onClose} className="text-sm text-[var(--muted)]">Cerrar ✕</button>
        </div>
        {items.length === 0 && <p className="py-6 text-center text-sm text-[var(--muted)]">El pedido está vacío.</p>}
        <ul className="divide-y divide-[var(--line)]">
          {items.map(([id, it]) => {
            const logo = logosDe(it.marca)[0]
            return (
              <li key={id} className="flex items-center justify-between gap-3 py-2">
                {logo
                  ? <div className="flex h-10 w-12 shrink-0 items-center justify-center rounded-lg bg-white p-1"><img src={logo} alt="" className="max-h-full max-w-full object-contain" /></div>
                  : <img src={fotoCategoria(it.categoria || '')} alt="" className="h-10 w-12 shrink-0 rounded-lg object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug">{it.producto}</p>
                  <p className="text-xs text-[var(--muted)]">{it.variante} · {it.lista} · {money(it.precio)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Stepper qty={it.qty} onChange={(n) => setQty(id, n)} />
                  <span className="text-xs font-semibold">{money(it.qty * it.precio)}</span>
                </div>
              </li>
            )
          })}
        </ul>
        {items.length > 0 && (
          <>
            <div className="mt-3 flex justify-between border-t border-[var(--line)] pt-3 text-lg font-extrabold">
              <span>Total estimado</span><span className="text-[var(--accent2)]">{money(total)}</span>
            </div>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre o negocio (opcional)"
              className="mt-3 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} placeholder="Nota: dirección, horario… (opcional)"
              className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
            <button onClick={enviar}
              className="mt-3 w-full rounded-xl bg-[var(--wa)] py-3.5 text-base font-bold text-black active:scale-[0.99]">
              Enviar pedido por WhatsApp
            </button>
            <button onClick={() => { setCart({}); onClose() }} className="mt-2 w-full py-2 text-xs text-[var(--muted)]">
              Vaciar pedido
            </button>
            <p className="mt-1 text-center text-[11px] text-[var(--muted)]">{config.aviso}</p>
          </>
        )}
      </div>
    </div>
  )
}

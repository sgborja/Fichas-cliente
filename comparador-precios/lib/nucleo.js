// Lógica de búsqueda compartida por el servidor local (server.js) y las funciones de Vercel (api/*.js).
const { STORES } = require('../stores');
const { elegir, rankear } = require('../match');
const cache = new Map(); const TTL = 30 * 60 * 1000;
const MAX_ITEMS = 60, MAX_CONCURRENTES = 6;

// Límite de consultas simultáneas a los súper.
let activos = 0; const cola = [];
const limitar = (fn) => new Promise((ok, mal) => {
  const correr = () => { activos++; fn().then(ok, mal).finally(() => { activos--; cola.length && cola.shift()(); }); };
  activos < MAX_CONCURRENTES ? correr() : cola.push(correr);
});

async function precio(store, q, cp) {
  const k = store.id + '|' + q.toLowerCase() + '|' + (cp || '');
  const hit = cache.get(k);
  if (hit && Date.now() - hit.t < TTL) return structuredClone(hit.v);
  try {
    const c = await limitar(() => store.buscar(q, { cp }));
    const v = { match: elegir(q, c), opciones: rankear(q, c), region: c.regionId, regionNota: c.regionNota };
    if (!v.match) v.sinMatch = { cantidad: c.length, mejor: c[0]?.nombre || null, diag: c.diag };
    cache.set(k, { t: Date.now(), v: structuredClone(v) });
    return v;
  } catch (e) { return { error: e.message }; }
}

async function buscar({ items, stores, cp }) {
  if (!Array.isArray(items) || items.length > MAX_ITEMS) throw Object.assign(new Error(`Máximo ${MAX_ITEMS} productos por búsqueda`), { status: 400 });
  const sel = STORES.filter((s) => !stores || stores.includes(s.id));
  cp = String(cp || '').replace(/\D/g, '').slice(0, 4);
  const resultados = await Promise.all(items.map(async (it) => {
    const nombre = String(it.nombre || '').slice(0, 120);
    const por = {};
    await Promise.all(sel.map(async (s) => { por[s.id] = await precio(s, nombre, cp); }));
    return { nombre, qty: Math.max(1, +it.qty || 1), tiendas: por };
  }));
  return { resultados, cp };
}
module.exports = { buscar };

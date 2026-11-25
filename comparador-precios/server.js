const http = require('http'), fs = require('fs'), path = require('path');
const { STORES, MOCK } = require('./stores');
const { elegir, rankear, norm } = require('./match');
const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const HFILE = path.join(DATA_DIR, 'historial.json');
const PASSWORD = process.env.APP_PASSWORD || '';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const cache = new Map(); const TTL = 30 * 60 * 1000;
const MAX_ITEMS = 60, MAX_CONCURRENTES = 6;

// ---- Historial de precios (archivo JSON; clave = súper|código postal|producto) ----
let hist = {};
try { hist = JSON.parse(fs.readFileSync(HFILE, 'utf8')); } catch { /* primera vez */ }
let pendiente = null;
function guardarHist() {
  if (pendiente) return;
  pendiente = setTimeout(async () => {
    pendiente = null;
    try {
      await fs.promises.mkdir(DATA_DIR, { recursive: true });
      await fs.promises.writeFile(HFILE + '.tmp', JSON.stringify(hist));
      await fs.promises.rename(HFILE + '.tmp', HFILE);
    } catch (e) { console.error('No se pudo guardar el historial:', e.message); }
  }, 500);
}
// Al cerrar el programa (Ctrl+C) se guarda lo pendiente.
function guardarAlSalir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(HFILE, JSON.stringify(hist)); } catch { /* nada más que hacer */ }
  process.exit(0);
}
process.on('SIGINT', guardarAlSalir); process.on('SIGTERM', guardarAlSalir);
const hoy = () => new Date().toISOString().slice(0, 10);
// Registra el precio de hoy y devuelve el último precio de un día anterior (para mostrar subió/bajó).
function registrar(storeId, cp, o) {
  const hk = `${storeId}|${cp || ''}|${norm(o.nombre)}`;
  const serie = (hist[hk] ||= []);
  const d = hoy();
  const previo = [...serie].reverse().find(([f]) => f < d);
  const ya = serie.find(([f]) => f === d);
  if (ya) ya[1] = o.precio; else serie.push([d, o.precio]);
  if (serie.length > 120) serie.splice(0, serie.length - 120);
  guardarHist();
  o.hk = hk;
  if (previo) o.anterior = { fecha: previo[0], precio: previo[1] };
}

// ---- Límite de consultas simultáneas a los súper ----
let activos = 0; const cola = [];
const limitar = (fn) => new Promise((ok, mal) => {
  const correr = () => { activos++; fn().then(ok, mal).finally(() => { activos--; cola.length && cola.shift()(); }); };
  activos < MAX_CONCURRENTES ? correr() : cola.push(correr);
});

async function precio(store, q, cp) {
  const k = store.id + '|' + q.toLowerCase() + '|' + (cp || '');
  const hit = cache.get(k);
  let v;
  if (hit && Date.now() - hit.t < TTL) v = structuredClone(hit.v);
  else {
    try {
      const c = await limitar(() => store.buscar(q, { cp }));
      v = { match: elegir(q, c), opciones: rankear(q, c), region: c.regionId };
      if (!v.match) v.sinMatch = { cantidad: c.length, mejor: c[0]?.nombre || null, diag: c.diag };
      cache.set(k, { t: Date.now(), v: structuredClone(v) });
    } catch (e) { return { error: e.message }; }
  }
  // El historial se calcula al momento (no se guarda en el caché de 30 min).
  for (const o of v.opciones || []) registrar(store.id, cp, o);
  if (v.match) { const o = v.opciones.find((x) => x.nombre === v.match.nombre && x.precio === v.match.precio); if (o) v.match = o; }
  return v;
}

async function buscar({ items, stores, cp }) {
  if (!Array.isArray(items) || items.length > MAX_ITEMS) throw Object.assign(new Error(`Máximo ${MAX_ITEMS} productos por búsqueda`), { status: 400 });
  const sel = STORES.filter((s) => !stores || stores.includes(s.id));
  cp = String(cp || '').replace(/\D/g, '').slice(0, 4);
  return Promise.all(items.map(async (it) => {
    const nombre = String(it.nombre || '').slice(0, 120);
    const por = {};
    await Promise.all(sel.map(async (s) => { por[s.id] = await precio(s, nombre, cp); }));
    return { nombre, qty: Math.max(1, +it.qty || 1), tiendas: por };
  }));
}

function autorizado(req) {
  if (!PASSWORD) return true;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const pass = Buffer.from(h.slice(6), 'base64').toString().split(':').slice(1).join(':');
  return pass === PASSWORD;
}

http.createServer(async (req, res) => {
  try {
    if (!autorizado(req)) { res.statusCode = 401; res.setHeader('www-authenticate', 'Basic realm="Comparador"'); return res.end('Se necesita contraseña'); }
    const url = new URL(req.url, 'http://x');
    const json = (o, st = 200) => { res.statusCode = st; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
    if (url.pathname === '/api/tiendas') return json({ mock: MOCK, historial: true, tiendas: STORES.map(({ id, nombre, pendiente }) => ({ id, nombre, pendiente: !!pendiente })) });
    if (url.pathname === '/api/historial') return json(hist[url.searchParams.get('k')] || []);
    if (url.pathname === '/api/buscar' && req.method === 'POST') {
      let body = ''; for await (const c of req) { body += c; if (body.length > 1e6) throw new Error('Pedido demasiado grande'); }
      try { return json(await buscar(JSON.parse(body))); }
      catch (e) { return json({ error: e.message }, e.status || 500); }
    }
    let f = url.pathname; if (f === '/') f = '/index.html';
    const file = path.join(PUB, path.normalize(f));
    if (!file.startsWith(PUB)) { res.statusCode = 403; return res.end(); }
    const data = await fs.promises.readFile(file);
    res.setHeader('content-type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch (e) { res.statusCode = e.code === 'ENOENT' ? 404 : 500; res.end(String(e.message)); }
}).listen(PORT, () => console.log(`http://localhost:${PORT}  ${MOCK ? '(MODO PRUEBA: precios simulados)' : ''}${PASSWORD ? '  [con contraseña]' : ''}`));

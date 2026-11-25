const http = require('http'), fs = require('fs'), path = require('path');
const { STORES, MOCK } = require('./stores');
const { elegir } = require('./match');
const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
const cache = new Map(); const TTL = 30 * 60 * 1000;

async function precio(store, q, cp) {
  const k = store.id + '|' + q.toLowerCase() + '|' + (cp || '');
  const hit = cache.get(k);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  let v;
  try { const c = await store.buscar(q, { cp }); v = { match: elegir(q, c), region: c.regionId }; if (!v.match) v.sinMatch = { cantidad: c.length, mejor: c[0]?.nombre || null, diag: c.diag }; }
  catch (e) { v = { error: e.message }; }
  if (!v.error) cache.set(k, { t: Date.now(), v });
  return v;
}

async function buscar({ items, stores, cp }) {
  const sel = STORES.filter((s) => !stores || stores.includes(s.id));
  const resultado = await Promise.all(items.map(async (it) => {
    const por = {};
    await Promise.all(sel.map(async (s) => { por[s.id] = await precio(s, it.nombre, cp); }));
    return { nombre: it.nombre, qty: it.qty || 1, tiendas: por };
  }));
  return resultado;
}

http.createServer(async (req, res) => {
  try {
    if (req.url === '/api/tiendas') {
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ mock: MOCK, tiendas: STORES.map(({ id, nombre, pendiente }) => ({ id, nombre, pendiente: !!pendiente })) }));
    }
    if (req.url === '/api/buscar' && req.method === 'POST') {
      let body = ''; for await (const c of req) { body += c; if (body.length > 1e6) throw new Error('grande'); }
      const out = await buscar(JSON.parse(body));
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify(out));
    }
    let f = req.url.split('?')[0]; if (f === '/') f = '/index.html';
    const file = path.join(PUB, path.normalize(f));
    if (!file.startsWith(PUB)) { res.statusCode = 403; return res.end(); }
    const data = await fs.promises.readFile(file);
    res.setHeader('content-type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch (e) { res.statusCode = e.code === 'ENOENT' ? 404 : 500; res.end(String(e.message)); }
}).listen(PORT, () => console.log(`http://localhost:${PORT}  ${MOCK ? '(MODO PRUEBA: precios simulados)' : ''}`));

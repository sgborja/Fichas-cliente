// Historial de precios. Tres modos según dónde corra el programa:
//  - Upstash Redis (si hay UPSTASH_REDIS_REST_URL/KV_REST_API_URL + token): sirve en Vercel.
//  - Archivo JSON (servidor local o con disco): data/historial.json o DATA_DIR.
//  - Desactivado (Vercel sin base de datos).
const fs = require('fs'), path = require('path');
const { norm } = require('../match');
const hoy = () => new Date().toISOString().slice(0, 10);
const claveDe = (id, cp, nombre) => `${id}|${cp || ''}|${norm(nombre)}`;

function aplicar(serie, o) {
  const d = hoy();
  const previo = [...serie].reverse().find(([f]) => f < d);
  const ya = serie.find(([f]) => f === d);
  if (ya) ya[1] = o.precio; else serie.push([d, o.precio]);
  if (serie.length > 120) serie.splice(0, serie.length - 120);
  if (previo) o.anterior = { fecha: previo[0], precio: previo[1] };
}
function recorrer(resultados, fn) {
  for (const r of resultados) for (const [id, t] of Object.entries(r.tiendas)) for (const o of t.opciones || []) fn(id, o);
}
// match debe ser el mismo objeto (ya anotado) que su opción.
function reenlazar(resultados) {
  for (const r of resultados) for (const t of Object.values(r.tiendas)) {
    if (!t.match) continue;
    const o = (t.opciones || []).find((x) => x.nombre === t.match.nombre && x.precio === t.match.precio);
    if (o) t.match = o;
  }
}

function archivo(dir) {
  const file = path.join(dir, 'historial.json');
  let hist = {};
  try { hist = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* primera vez */ }
  let pendiente = null;
  const guardar = () => {
    if (pendiente) return;
    pendiente = setTimeout(async () => {
      pendiente = null;
      try { await fs.promises.mkdir(dir, { recursive: true }); await fs.promises.writeFile(file + '.tmp', JSON.stringify(hist)); await fs.promises.rename(file + '.tmp', file); }
      catch (e) { console.error('No se pudo guardar el historial:', e.message); }
    }, 500);
  };
  const alSalir = () => { try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(hist)); } catch { /* nada */ } process.exit(0); };
  process.on('SIGINT', alSalir); process.on('SIGTERM', alSalir);
  return {
    modo: 'archivo', habilitado: true,
    async anotar(resultados, cp) {
      recorrer(resultados, (id, o) => { o.hk = claveDe(id, cp, o.nombre); aplicar((hist[o.hk] ||= []), o); });
      reenlazar(resultados); guardar();
    },
    async serie(k) { return hist[k] || []; },
  };
}

function upstash(url, token) {
  const pipeline = async (cmds) => {
    const r = await fetch(url.replace(/\/$/, '') + '/pipeline', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(cmds), signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('Upstash HTTP ' + r.status);
    return r.json();
  };
  const leer = (v) => { try { return v ? JSON.parse(v) : []; } catch { return []; } };
  return {
    modo: 'upstash', habilitado: true,
    async anotar(resultados, cp) {
      try {
        const series = new Map();
        recorrer(resultados, (id, o) => { o.hk = claveDe(id, cp, o.nombre); series.set(o.hk, null); });
        const claves = [...series.keys()];
        if (!claves.length) return;
        const got = await pipeline(claves.map((k) => ['GET', 'h:' + k]));
        claves.forEach((k, i) => series.set(k, leer(got[i]?.result)));
        recorrer(resultados, (id, o) => aplicar(series.get(o.hk), o));
        await pipeline(claves.map((k) => ['SET', 'h:' + k, JSON.stringify(series.get(k)), 'EX', '31536000']));
        reenlazar(resultados);
      } catch (e) { console.error('Historial (Upstash):', e.message); }
    },
    async serie(k) { try { return leer((await pipeline([['GET', 'h:' + k]]))[0]?.result); } catch { return []; } },
  };
}

const nulo = { modo: 'desactivado', habilitado: false, async anotar() {}, async serie() { return []; } };

function crear() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) return upstash(url, token);
  if (process.env.VERCEL) return nulo;
  return archivo(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
}
module.exports = { crear, claveDe };

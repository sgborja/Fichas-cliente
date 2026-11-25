// Elige el mejor resultado para lo que escribió el usuario: exacto, similar o ninguno.
// Además lee el tamaño (1 l, 900 ml, 1 kg, 500 g...) para comparar por precio equivalente.
const sinTildes = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// "1 Lt." / "1,5 litros" -> "1.5l" ; "500 gr" -> "500g" ; "900 cc" -> "900ml"
function canon(s) {
  return sinTildes(s)
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:ml|cc)\b/g, (_, n) => n.replace(',', '.') + 'ml')
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:lts?|litros?|l)\b/g, (_, n) => n.replace(',', '.') + 'l')
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:kgs?|kilos?|kilogramos?)\b/g, (_, n) => n.replace(',', '.') + 'kg')
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:grs?|gramos?|g)\b/g, (_, n) => n.replace(',', '.') + 'g');
}
const norm = (s) => canon(s).replace(/[^a-z0-9. ]/g, ' ').replace(/(?<!\d)\.|\.(?!\d)/g, ' ').replace(/\s+/g, ' ').trim();
const toks = (s) => norm(s).split(' ').filter((t) => t.length > 1 || /\d/.test(t));

// Devuelve { cant, unidad:'l'|'kg' } (cant ya en l o kg), considerando packs "6 x 330ml", o null si no hay tamaño.
function tamano(s) {
  const t = canon(s);
  const pack = t.match(/(\d+)\s*x\s*(\d+(?:\.\d+)?)(ml|l|g|kg)\b/);
  const simple = t.match(/(\d+(?:\.\d+)?)(ml|l|g|kg)\b/);
  const m = pack ? [null, +pack[2], pack[3]] : simple ? [null, +simple[1], simple[2]] : null;
  if (!m) return null;
  const mult = pack ? +pack[1] : 1;
  const [, n, u] = m;
  const f = { ml: [0.001, 'l'], l: [1, 'l'], g: [0.001, 'kg'], kg: [1, 'kg'] }[u];
  return { cant: n * f[0] * mult, unidad: f[1] };
}

function elegir(consulta, candidatos) {
  const q = toks(consulta);
  if (!q.length) return null;
  let best = null;
  for (const c of candidatos) {
    const nt = new Set(toks(c.nombre));
    const hit = q.filter((t) => nt.has(t) || [...nt].some((n) => n.startsWith(t) && t.length > 3)).length;
    const cobertura = hit / q.length;
    const score = cobertura - Math.min(nt.size, 12) * 0.005;
    if (!best || score > best.score || (score === best.score && c.precio < best.c.precio)) best = { c, score, cobertura };
  }
  if (!best || best.cobertura < 0.5) return null;
  const r = { ...best.c, tipo: best.cobertura === 1 ? 'exacto' : 'similar' };
  const tq = tamano(consulta), tm = tamano(r.nombre);
  if (tm) r.porUnidad = { precio: r.precio / tm.cant, unidad: tm.unidad };
  // Si pediste un tamaño y el producto es de otro tamaño, se compara a precio equivalente.
  r.precioComparable = r.precio;
  if (tq && tm && tq.unidad === tm.unidad && Math.abs(tq.cant - tm.cant) / tq.cant > 0.02) {
    r.precioComparable = Math.round((r.precio / tm.cant) * tq.cant);
    r.ajustado = true;
  }
  return r;
}
module.exports = { elegir, norm, tamano };

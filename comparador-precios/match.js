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

function puntuar(qt, c) {
  const nt = new Set(toks(c.nombre));
  const hit = qt.filter((t) => nt.has(t) || [...nt].some((n) => n.startsWith(t) && t.length > 3)).length;
  const cobertura = hit / qt.length;
  return { c, cobertura, score: cobertura - Math.min(nt.size, 12) * 0.005 };
}

function enriquecer(consulta, c, tipo) {
  const r = { ...c, tipo };
  const tq = tamano(consulta), tm = tamano(r.nombre);
  if (tm) r.porUnidad = { precio: r.precio / tm.cant, unidad: tm.unidad };
  // Si pediste un tamaño y el producto es de otro tamaño, se compara a precio equivalente.
  r.precioComparable = r.precio;
  if (tq && tm && tq.unidad === tm.unidad && Math.abs(tq.cant - tm.cant) / tq.cant > 0.02) {
    r.precioComparable = Math.round((r.precio / tm.cant) * tq.cant);
    r.ajustado = true;
  }
  if (r.precioLista && r.precioLista > r.precio * 1.02) r.descuento = Math.round((1 - r.precio / r.precioLista) * 100);
  return r;
}

// Los mejores N candidatos, del más parecido al menos. tipo: exacto | similar | distinto (<50 % de coincidencia).
function rankear(consulta, candidatos, n = 6) {
  const qt = toks(consulta);
  if (!qt.length) return [];
  return candidatos.map((c) => puntuar(qt, c)).filter((x) => x.cobertura > 0)
    .sort((a, b) => b.score - a.score || a.c.precio - b.c.precio)
    .slice(0, n)
    .map((x) => enriquecer(consulta, x.c, x.cobertura === 1 ? 'exacto' : x.cobertura >= 0.5 ? 'similar' : 'distinto'));
}

function elegir(consulta, candidatos) {
  const r = rankear(consulta, candidatos, 1)[0];
  return r && r.tipo !== 'distinto' ? r : null;
}
module.exports = { elegir, rankear, enriquecer, norm, tamano };

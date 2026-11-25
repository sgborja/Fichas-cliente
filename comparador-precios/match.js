// Elige el mejor resultado para lo que escribió el usuario: exacto, similar o ninguno.
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9. ]/g, ' ').replace(/\s+/g, ' ').trim();
const toks = (s) => norm(s).split(' ').filter((t) => t.length > 1 || /\d/.test(t));

function elegir(consulta, candidatos) {
  const q = toks(consulta);
  if (!q.length) return null;
  let best = null;
  for (const c of candidatos) {
    const nt = new Set(toks(c.nombre));
    const hit = q.filter((t) => nt.has(t) || [...nt].some((n) => n.startsWith(t) && t.length > 3)).length;
    const cobertura = hit / q.length;
    const score = cobertura - Math.min(nt.size, 12) * 0.005; // leve preferencia por nombres más cortos
    if (!best || score > best.score || (score === best.score && c.precio < best.c.precio)) best = { c, score, cobertura };
  }
  if (!best || best.cobertura < 0.5) return null;
  return { ...best.c, tipo: best.cobertura === 1 ? 'exacto' : 'similar' };
}
module.exports = { elegir, norm };

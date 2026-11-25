// Adaptadores por supermercado. Cada uno: async buscar(texto) -> [{nombre, precio, precioLista, url, imagen}]
const MOCK = process.env.MOCK === '1';
const UA = 'Mozilla/5.0 (compatible; ComparadorPrecios/1.0)';

// Plataforma VTEX (la usan Carrefour, Disco, Vea, Changomás...). Endpoint público de catálogo.
function vtex({ id, nombre, base, sc }) {
  const headers = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    accept: 'application/json, text/plain, */*', 'accept-language': 'es-AR,es;q=0.9',
  };
  const pedir = async (u) => {
    let r;
    try { r = await fetch(u, { headers, signal: AbortSignal.timeout(12000) }); }
    catch (e) { throw new Error(`no se pudo conectar a ${u.host} (${e.cause?.code || e.message})`); }
    const txt = await r.text();
    if (!r.ok && r.status !== 206) throw new Error(`HTTP ${r.status} en ${u.pathname}: ${txt.slice(0, 120).replace(/\s+/g, ' ')}`);
    try { return JSON.parse(txt); } catch { throw new Error(`Respuesta no es JSON en ${u.pathname}: ${txt.slice(0, 80).replace(/\s+/g, ' ')}`); }
  };
  const aOfertas = (lista) => {
    const out = [];
    for (const p of lista || []) {
      const it = p.items?.[0];
      const offer = it?.sellers?.find((s) => s.commertialOffer?.AvailableQuantity > 0)?.commertialOffer;
      if (!offer || !(offer.Price > 0)) continue;
      out.push({ nombre: p.productName, precio: offer.Price, precioLista: offer.ListPrice, url: p.link, imagen: it.images?.[0]?.imageUrl });
    }
    return out;
  };
  return {
    id, nombre, verificado: false,
    async buscar(q) {
      const errores = [];
      // 1) API clásica de catálogo
      try {
        const u = new URL('/api/catalog_system/pub/products/search', base);
        u.searchParams.set('ft', q); u.searchParams.set('_from', '0'); u.searchParams.set('_to', '9');
        if (sc) u.searchParams.set('sc', sc);
        return aOfertas(await pedir(u));
      } catch (e) { errores.push(e.message); }
      // 2) Búsqueda inteligente (la usan los sitios VTEX más nuevos)
      try {
        const u = new URL('/api/io/_v/api/intelligent-search/product_search', base);
        u.searchParams.set('query', q); u.searchParams.set('count', '10'); u.searchParams.set('page', '1');
        if (sc) u.searchParams.set('sc', sc);
        return aOfertas((await pedir(u)).products);
      } catch (e) { errores.push(e.message); }
      throw new Error(`${nombre}: ${errores.join(' | ')}`);
    },
  };
}

// Sitios que publican los productos en la propia página (datos estándar schema.org en <script type="application/ld+json">).
// urlBusqueda lleva {q} donde va el texto buscado.
function jsonld({ id, nombre, urlBusqueda }) {
  const headers = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    accept: 'text/html,application/xhtml+xml', 'accept-language': 'es-AR,es;q=0.9',
  };
  return {
    id, nombre, verificado: false,
    async buscar(q) {
      const u = new URL(urlBusqueda.replace('{q}', encodeURIComponent(q)));
      let r;
      try { r = await fetch(u, { headers, signal: AbortSignal.timeout(15000) }); }
      catch (e) { throw new Error(`${nombre}: no se pudo conectar a ${u.host} (${e.cause?.code || e.message})`); }
      if (!r.ok) throw new Error(`${nombre}: HTTP ${r.status} en ${u.pathname}`);
      const html = await r.text();
      const out = [];
      const re = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
      let m;
      while ((m = re.exec(html))) {
        let j; try { j = JSON.parse(m[1]); } catch { continue; }
        for (const el of [].concat(j.itemListElement || [])) {
          const it = el.item || el;
          const o = [].concat(it.offers || [])[0];
          if (!it.name || !o || !(+o.price > 0)) continue;
          if (o.availability && !/InStock/i.test(o.availability)) continue;
          out.push({ nombre: it.name, precio: +o.price, url: it.url, imagen: it.image });
        }
      }
      if (!out.length && !/application\/ld\+json/i.test(html)) throw new Error(`${nombre}: la página no trae datos de productos (revisar urlBusqueda)`);
      return out;
    },
  };
}

// Sitios que NO son VTEX o cuya API hay que confirmar: se dejan como "pendientes" hasta verificarlos
// con una consulta real (ver README, sección "Agregar / ajustar un súper").
function pendiente(id, nombre) {
  return { id, nombre, verificado: false, pendiente: true, async buscar() { throw new Error(`${nombre}: adaptador pendiente de configurar`); } };
}

const REAL = [
  vtex({ id: 'carrefour', nombre: 'Carrefour', base: 'https://www.carrefour.com.ar' }),
  vtex({ id: 'disco', nombre: 'Disco', base: 'https://www.disco.com.ar' }),
  vtex({ id: 'vea', nombre: 'Vea', base: 'https://www.vea.com.ar' }),
  vtex({ id: 'changomas', nombre: 'Chango Más', base: 'https://www.masonline.com.ar' }),
  jsonld({ id: 'laanonima', nombre: 'La Anónima', urlBusqueda: 'https://www.laanonima.com.ar/buscar?clave={q}' }),
  pendiente('supermami', 'Supermami'),
];

// Modo prueba: precios simulados y repetibles
function hash(s) { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
function mock(st) {
  return {
    id: st.id, nombre: st.nombre, verificado: true,
    async buscar(q) {
      const base = 800 + (hash(q) % 4000);
      const factor = 0.9 + (hash(st.id + q) % 25) / 100;
      const sinStock = hash(st.id + q + 'x') % 11 === 0;
      if (sinStock) return [];
      const similar = hash(st.id + q + 's') % 5 === 0;
      return [{ nombre: similar ? `${q} marca alternativa` : `${q} 1 un`, precio: Math.round(base * factor), url: '#', imagen: null }];
    },
  };
}

module.exports = { STORES: MOCK ? REAL.map(mock) : REAL, MOCK };

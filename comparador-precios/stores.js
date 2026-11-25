// Adaptadores por supermercado. Cada uno: async buscar(texto) -> [{nombre, precio, precioLista, url, imagen}]
const MOCK = process.env.MOCK === '1';
const UA = 'Mozilla/5.0 (compatible; ComparadorPrecios/1.0)';

// Plataforma VTEX (la usan Carrefour, Disco, Vea, Changomás...). Endpoint público de catálogo.
function vtex({ id, nombre, base, sc }) {
  return {
    id, nombre, verificado: false,
    async buscar(q) {
      const u = new URL('/api/catalog_system/pub/products/search', base);
      u.searchParams.set('ft', q);
      u.searchParams.set('_from', '0');
      u.searchParams.set('_to', '14');
      if (sc) u.searchParams.set('sc', sc); // canal de venta / sucursal (ver README)
      const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
      if (!r.ok && r.status !== 206) throw new Error(`${nombre}: HTTP ${r.status}`);
      const data = await r.json();
      const out = [];
      for (const p of data) {
        const it = p.items?.[0];
        const offer = it?.sellers?.find((s) => s.commertialOffer?.AvailableQuantity > 0)?.commertialOffer;
        if (!offer || !(offer.Price > 0)) continue;
        out.push({ nombre: p.productName, precio: offer.Price, precioLista: offer.ListPrice, url: p.link, imagen: it.images?.[0]?.imageUrl });
      }
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
  vtex({ id: 'changomas', nombre: 'Chango Más', base: 'https://www.changomas.com.ar' }),
  pendiente('makro', 'Makro'),
  pendiente('laanonima', 'La Anónima'),
  pendiente('tadicor', 'Tadicor'),
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

// Adaptadores por supermercado. Cada uno: async buscar(texto) -> [{nombre, precio, precioLista, url, imagen}]
const MOCK = process.env.MOCK === '1';
const UA = 'Mozilla/5.0 (compatible; ComparadorPrecios/1.0)';

// Plataforma VTEX (la usan Carrefour, Disco, Vea, Changomás...). Endpoint público de catálogo.
function vtex({ id, nombre, base, sc: scBase }) {
  // Canal de venta (sc): en algunas cadenas (Disco, Vea) la zona se define así y no por región. Se puede cambiar con SC_<SUPER>.
  const sc = process.env['SC_' + id.toUpperCase()] || scBase || '';
  const headers = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    accept: 'application/json, text/plain, */*', 'accept-language': 'es-AR,es;q=0.9',
    ...(process.env['COOKIES_' + id.toUpperCase()] ? { cookie: process.env['COOKIES_' + id.toUpperCase()] } : {}),
  };
  const pedir = async (u) => {
    let r;
    try { r = await fetch(u, { headers, signal: AbortSignal.timeout(12000) }); }
    catch (e) { throw new Error(`no se pudo conectar a ${u.host} (${e.cause?.code || e.message})`); }
    const txt = await r.text();
    if (!r.ok && r.status !== 206) throw new Error(`HTTP ${r.status} en ${u.pathname}: ${txt.slice(0, 120).replace(/\s+/g, ' ')}`);
    try { return JSON.parse(txt); } catch { throw new Error(`Respuesta no es JSON en ${u.pathname}: ${txt.slice(0, 80).replace(/\s+/g, ' ')}`); }
  };
  // Toma el vendedor principal con stock (el que muestra la tienda) y guarda los campos de precio crudos en `detalle`.
  const aOfertas = (lista, fuente, rid) => {
    const out = [];
    for (const p of lista || []) {
      const it = p.items?.[0];
      const conStock = (it?.sellers || []).filter((s) => s.commertialOffer?.AvailableQuantity > 0);
      const vend = conStock.find((s) => s.sellerDefault) || conStock[0];
      const offer = vend?.commertialOffer;
      if (!offer || !(offer.Price > 0)) continue;
      out.push({
        nombre: p.productName, precio: offer.Price, precioLista: offer.ListPrice, url: p.link, imagen: it.images?.[0]?.imageUrl,
        detalle: { fuente, region: rid || null, vendedor: vend.sellerId, vendedorPrincipal: !!vend.sellerDefault, canal: sc || null, Price: offer.Price, ListPrice: offer.ListPrice,
          PriceWithoutDiscount: offer.PriceWithoutDiscount, spotPrice: offer.spotPrice, multiplicador: it.unitMultiplier, medida: it.measurementUnit },
      });
    }
    return out;
  };
  // Zona/sucursal: VTEX traduce un código postal a una "región" (grupo de vendedores de esa zona).
  // Se puede fijar la zona a mano con la variable REGION_<SUPER> (ej. REGION_DISCO), sin consultar el código postal.
  const regiones = new Map();
  const region = async (cp) => {
    if (sc) return { rid: null, nota: `zona por canal de venta (sc=${sc})`, porCanal: true };
    const fija = process.env['REGION_' + id.toUpperCase()];
    if (fija) return { rid: fija, nota: 'zona fijada por variable de entorno' };
    if (!cp) return { rid: null, nota: 'sin código postal' };
    if (regiones.has(cp)) return regiones.get(cp);
    let r;
    try {
      const u = new URL('/api/checkout/pub/regions', base);
      u.searchParams.set('country', 'ARG'); u.searchParams.set('postalCode', cp);
      const j = await pedir(u);
      const rid = j?.[0]?.id || null;
      r = { rid, nota: rid ? '' : `el sitio no reconoce el código postal ${cp} (respuesta: ${JSON.stringify(j).slice(0, 80)})` };
    } catch (e) { r = { rid: null, nota: e.message.slice(0, 160) }; }
    regiones.set(cp, r);
    return r;
  };
  const inteligente = async (q, rid) => {
    const u = new URL('/api/io/_v/api/intelligent-search/product_search', base);
    u.searchParams.set('query', q); u.searchParams.set('count', '10'); u.searchParams.set('page', '1');
    if (sc) u.searchParams.set('sc', sc);
    if (rid) u.searchParams.set('regionId', rid);
    return aOfertas((await pedir(u)).products, 'inteligente', rid);
  };
  const clasica = async (q) => {
    const u = new URL('/api/catalog_system/pub/products/search', base);
    u.searchParams.set('ft', q); u.searchParams.set('_from', '0'); u.searchParams.set('_to', '9');
    if (sc) u.searchParams.set('sc', sc);
    return aOfertas(await pedir(u), 'clasica', null);
  };
  return {
    id, nombre, verificado: false,
    async buscar(q, { cp } = {}) {
      const { rid, nota, porCanal } = await region(cp);
      // La búsqueda inteligente acepta zona; la clásica no. Con código postal se prueba primero la inteligente.
      const orden = (cp || rid || sc) ? [['inteligente', () => inteligente(q, rid)], ['clasica', () => clasica(q)]]
                       : [['clasica', () => clasica(q)], ['inteligente', () => inteligente(q, null)]];
      const errores = [];
      for (const [n, f] of orden) {
        try {
          let out = await f(), usoRegion = n === 'inteligente' ? rid : null;
          // Si con zona no hay resultados, se reintenta con precios generales (mejor eso que nada).
          let notaFinal = nota;
          if (!out.length && n === 'inteligente' && rid) { out = await inteligente(q, null); usoRegion = null; notaFinal = 'con esa zona el sitio no devolvió resultados; se usó el precio general'; }
          out.regionId = usoRegion; out.regionNota = usoRegion ? '' : notaFinal; out.canal = porCanal ? sc : null; return out;
        }
        catch (e) { errores.push(e.message); }
      }
      throw new Error(`${nombre}: ${errores.join(' | ')}`);
    },
  };
}

// La Anónima: la página de búsqueda trae cada producto en una etiqueta <a data-tipo="portadaProduct" data-nombre="..." data-precio="...">.
// La zona/sucursal de precios la define con cookies: se manda codigoPostal (el del campo de la pantalla) y,
// opcionalmente, las cookies de zona que fijes en la variable de entorno LAANONIMA_COOKIES (ver README).
function laAnonima({ id, nombre, urlBusqueda }) {
  const attr = (tag, k) => { const m = tag.match(new RegExp(`${k}\\s*=\\s*"([^"]*)"`)); return m ? m[1] : null; };
  const decodificar = (t) => t.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  return {
    id, nombre, verificado: false,
    async buscar(q, { cp } = {}) {
      const cookies = [cp ? `codigoPostal=${cp}; seleccionocp=1` : '', process.env.LAANONIMA_COOKIES || ''].filter(Boolean).join('; ');
      const headers = {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml', 'accept-language': 'es-AR,es;q=0.9',
        ...(cookies ? { cookie: cookies } : {}),
      };
      const pagina = async (texto) => {
        const u = new URL(urlBusqueda.replace('{q}', encodeURIComponent(texto)));
        let r;
        try { r = await fetch(u, { headers, signal: AbortSignal.timeout(15000) }); }
        catch (e) { throw new Error(`${nombre}: no se pudo conectar a ${u.host} (${e.cause?.code || e.message})`); }
        if (!r.ok) throw new Error(`${nombre}: HTTP ${r.status} en ${u.pathname}`);
        const html = await r.text();
        const out = [];
        // Etiqueta <a ...> respetando comillas: algunos valores (data-rutacategorias="Almacén > Arroz") contienen ">".
        for (const [tag] of html.matchAll(/<a\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
          if (!/data-tipo\s*=\s*"portadaProduct"/.test(tag)) continue;
          const n = attr(tag, 'data-nombre');
          const precios = [attr(tag, 'data-precio'), attr(tag, 'data-precio_oferta')].map(parseFloat).filter((x) => x > 0);
          if (!n || !precios.length) continue;
          const href = attr(tag, 'href');
          out.push({ nombre: decodificar(n), precio: Math.min(...precios), precioLista: parseFloat(attr(tag, 'data-precio_anterior')) || undefined, url: href ? new URL(href, u).href : undefined });
        }
        const total = html.match(/data-total-productos\s*=\s*"(\d+)"/)?.[1];
        return { out, html, diag: `${u.pathname} · ${html.length} caracteres · total declarado: ${total ?? 'n/d'}` };
      };
      // Si la búsqueda completa no devuelve nada, se prueba con menos palabras (el sitio puede no aceptar frases largas).
      const palabras = q.trim().split(/\s+/);
      let ultimo;
      for (let n = palabras.length; n >= 1; n--) {
        ultimo = await pagina(palabras.slice(0, n).join(' '));
        if (ultimo.out.length) return ultimo.out;
        if (n === palabras.length && !/productos-container/.test(ultimo.html))
          throw new Error(`${nombre}: la página no tiene el listado de productos (¿cambió el sitio o bloquea consultas?)`);
      }
      const vacio = []; vacio.diag = ultimo.diag; return vacio; // el sitio respondió pero sin productos
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
  vtex({ id: 'disco', nombre: 'Disco', base: 'https://www.disco.com.ar', sc: '33' }), // 33 = canal de venta de Córdoba (cookie vtex_segment)
  vtex({ id: 'vea', nombre: 'Vea', base: 'https://www.vea.com.ar', sc: '34' }), // 34 = canal de venta de Córdoba (cookie vtex_segment)
  vtex({ id: 'changomas', nombre: 'Chango Más', base: 'https://www.masonline.com.ar' }),
  laAnonima({ id: 'laanonima', nombre: 'La Anónima', urlBusqueda: 'https://www.laanonima.com.ar/buscar/{q}' }),
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

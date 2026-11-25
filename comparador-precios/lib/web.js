// Rutas /api/* independientes del servidor: las usan server.js y las funciones de Vercel.
const nucleo = require('./nucleo');
const { STORES, MOCK } = require('../stores');
const historial = require('./historial').crear();
const PASSWORD = process.env.APP_PASSWORD || '';

function autorizado(headers) {
  if (!PASSWORD) return true;
  if (headers['x-clave'] === PASSWORD) return true;
  const h = headers.authorization || '';
  return h.startsWith('Basic ') && Buffer.from(h.slice(6), 'base64').toString().split(':').slice(1).join(':') === PASSWORD;
}

// ruta: 'tiendas' | 'buscar' | 'historial'
async function manejar({ ruta, metodo, headers, query, cuerpo }) {
  if (!autorizado(headers)) return { status: 401, json: { error: 'Se necesita contraseña' } };
  if (ruta === 'tiendas') return { status: 200, json: { mock: MOCK, historial: historial.habilitado, tiendas: STORES.map(({ id, nombre, pendiente }) => ({ id, nombre, pendiente: !!pendiente })) } };
  if (ruta === 'historial') return { status: 200, json: await historial.serie(query.k || '') };
  if (ruta === 'buscar' && metodo === 'POST') {
    try {
      const body = typeof cuerpo === 'string' ? JSON.parse(cuerpo || '{}') : cuerpo || {};
      const { resultados, cp } = await nucleo.buscar(body);
      await historial.anotar(resultados, cp);
      return { status: 200, json: resultados };
    } catch (e) { return { status: e.status || 500, json: { error: e.message } }; }
  }
  return { status: 404, json: { error: 'No existe' } };
}
module.exports = { manejar };

// Servidor local / con disco (Windows, Mac, Linux, Docker). En Vercel se usan las funciones de api/.
const http = require('http'), fs = require('fs'), path = require('path');
const { MOCK } = require('./stores');
const { manejar } = require('./lib/web');
const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const m = url.pathname.match(/^\/api\/(tiendas|buscar|historial)$/);
    if (m) {
      let body = ''; for await (const c of req) { body += c; if (body.length > 1e6) throw new Error('Pedido demasiado grande'); }
      const out = await manejar({ ruta: m[1], metodo: req.method, headers: req.headers, query: Object.fromEntries(url.searchParams), cuerpo: body });
      res.statusCode = out.status; res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(out.json));
    }
    let f = url.pathname; if (f === '/') f = '/index.html';
    const file = path.join(PUB, path.normalize(f));
    if (!file.startsWith(PUB)) { res.statusCode = 403; return res.end(); }
    const data = await fs.promises.readFile(file);
    res.setHeader('content-type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch (e) { res.statusCode = e.code === 'ENOENT' ? 404 : 500; res.end(String(e.message)); }
}).listen(PORT, () => console.log(`http://localhost:${PORT}  ${MOCK ? '(MODO PRUEBA: precios simulados)' : ''}${process.env.APP_PASSWORD ? '  [con contraseña]' : ''}`));

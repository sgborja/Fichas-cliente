const { manejar } = require('../lib/web');
module.exports = async (req, res) => {
  const out = await manejar({ ruta: 'buscar', metodo: req.method, headers: req.headers, query: req.query || {}, cuerpo: req.body });
  res.status(out.status).json(out.json);
};

// Lee una lista de compras desde texto: CSV (; , o tabulación), celdas pegadas desde Excel o un producto por línea.
(function (root) {
  const sinComillas = (s) => s.trim().replace(/^"(.*)"$/s, '$1').replace(/""/g, '"').trim();
  const aCantidad = (s) => { const n = parseFloat(String(s ?? '').replace(',', '.')); return isFinite(n) && n > 0 ? Math.max(1, Math.round(n)) : null; };
  const ENCABEZADO = /^(producto|productos|nombre|art[ií]culo|articulo|item|descripci[oó]n|descripcion)$/i;

  function parsearLista(texto) {
    const lineas = String(texto || '').replace(/^﻿/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const out = [];
    lineas.forEach((linea, i) => {
      let nombre, qty = null;
      const sep = linea.includes('\t') ? '\t' : linea.includes(';') ? ';' : null;
      if (sep) {
        const c = linea.split(sep).map(sinComillas);
        nombre = c.find((x) => x) || '';
        const k = c.indexOf(nombre);
        qty = aCantidad(c.slice(k + 1).find((x) => x !== ''));
      } else {
        // Con coma solo se separa la cantidad si el último trozo es un número entero ("leche entera, 2").
        const m = linea.match(/^(.*\S),\s*(\d{1,3})\s*$/);
        if (m) { nombre = sinComillas(m[1]); qty = +m[2]; } else nombre = sinComillas(linea);
      }
      if (i === 0 && ENCABEZADO.test(nombre)) return; // fila de títulos
      if (nombre) out.push({ nombre: nombre.slice(0, 120), qty: qty || 1 });
    });
    return out;
  }
  // Excel en español suele guardar CSV en Windows-1252: se intenta UTF-8 y, si falla, ese.
  function decodificar(buffer) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
    catch { return new TextDecoder('windows-1252').decode(buffer); }
  }
  const PLANTILLA = '﻿Producto;Cantidad\r\nleche entera 1l;2\r\narroz parboil gallo 1 kg;1\r\naceite girasol 900ml;1\r\n';
  const api = { parsearLista, decodificar, PLANTILLA };
  if (typeof module !== 'undefined') module.exports = api; else root.Importar = api;
})(typeof self !== 'undefined' ? self : this);

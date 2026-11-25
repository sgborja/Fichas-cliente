const assert = require('assert');
const { analizar, colorFila } = require('./analysis');
const { elegir } = require('./match');
// Poca diferencia: no conviene recorrer 2 súper
let r = analizar([
  { nombre: 'a', qty: 1, precios: { x: 1000, y: 990 } },
  { nombre: 'b', qty: 1, precios: { x: 500, y: 520 } },
], { stores: ['x', 'y'], costoViaje: 300, tolerancia: 3 });
assert.deepStrictEqual(r.elegido.stores.length, 1);
// Gran diferencia: sí conviene dividir
r = analizar([
  { nombre: 'a', qty: 1, precios: { x: 1000, y: 600 } },
  { nombre: 'b', qty: 1, precios: { x: 500, y: 900 } },
], { stores: ['x', 'y'], costoViaje: 100, tolerancia: 3 });
assert.deepStrictEqual(r.elegido.stores.sort(), ['x', 'y']);
// Un súper con varios ítems apenas más baratos pero el viaje cuesta más que el ahorro
r = analizar([
  { nombre: 'a', qty: 1, precios: { x: 1000, y: 980 } },
  { nombre: 'b', qty: 1, precios: { x: 1000, y: 980 } },
  { nombre: 'c', qty: 1, precios: { x: 1000, y: 1200 } },
], { stores: ['x', 'y'], costoViaje: 500, tolerancia: 0 });
assert.deepStrictEqual(r.elegido.stores, ['x']);
// Faltantes
r = analizar([{ nombre: 'a', qty: 1, precios: { x: null, y: 100 } }], { stores: ['x', 'y'] });
assert.deepStrictEqual(r.elegido.stores, ['y']);
assert.deepStrictEqual(colorFila({ x: 100, y: 102, z: 150 }, ['x', 'y', 'z'], 3), { x: 'barato', y: 'cerca', z: 'caro' });
// Matching
assert.strictEqual(elegir('leche entera 1l', [{ nombre: 'Leche Entera La Serenísima 1L', precio: 1 }]).tipo, 'exacto');
assert.strictEqual(elegir('leche entera sancor', [{ nombre: 'Leche Entera Serenisima 1L', precio: 1 }]).tipo, 'similar');
assert.strictEqual(elegir('detergente', [{ nombre: 'Leche', precio: 1 }]), null);
console.log('OK');

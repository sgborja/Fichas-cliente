const assert = require('assert');
const { analizar, colorFila } = require('./public/analysis');
const { elegir, rankear, tamano } = require('./match');
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
// Tamaños y precio equivalente
assert.deepStrictEqual(tamano('Aceite 900 ml'), { cant: 0.9, unidad: 'l' });
assert.deepStrictEqual(tamano('Leche x 1 Lt.'), { cant: 1, unidad: 'l' });
assert.deepStrictEqual(tamano('Arroz 500 gr'), { cant: 0.5, unidad: 'kg' });
assert.strictEqual(Math.round(tamano('Gaseosa 6 x 330ml').cant * 1000), 1980);
assert.strictEqual(tamano('Detergente'), null);
let m = elegir('aceite girasol 900ml', [{ nombre: 'Aceite Girasol Cocinero 1.5 L', precio: 3000 }]);
assert.strictEqual(m.ajustado, true);
assert.strictEqual(m.precioComparable, 1800); // 3000/1.5*0.9
m = elegir('leche entera 1l', [{ nombre: 'Leche Entera 1 Lt.', precio: 2325 }]);
assert.strictEqual(m.tipo, 'exacto'); assert.strictEqual(m.ajustado, undefined);
// Opciones alternativas y descuentos
const cands = [{ nombre: 'Arroz Gallo 1 kg', precio: 2000, precioLista: 2500 }, { nombre: 'Arroz Lucchetti 1 kg', precio: 1900 }, { nombre: 'Fideos 500 g', precio: 800 }];
const rk = rankear('arroz 1kg', cands);
assert.strictEqual(rk.length, 2); assert.strictEqual(rk[0].descuento === undefined || rk[0].descuento === 20 || rk[1].descuento === 20, true);
assert.strictEqual(rankear('arroz', [{ nombre: 'Fideos', precio: 1 }]).length, 0);
assert.strictEqual(rankear('arroz', [{ nombre: 'Arroz', precio: 2750, precioLista: 275000 }])[0].descuento, undefined);
assert.strictEqual(rankear('arroz', [{ nombre: 'Arroz', precio: 800, precioLista: 1000 }])[0].descuento, 20);
// Importar listas
const { parsearLista } = require('./public/importar');
assert.deepStrictEqual(parsearLista('Producto;Cantidad\r\nleche entera 1l;2\r\narroz gallo 1 kg;1\r\n'), [{ nombre: 'leche entera 1l', qty: 2 }, { nombre: 'arroz gallo 1 kg', qty: 1 }]);
assert.deepStrictEqual(parsearLista('\uFEFF"aceite, girasol 900ml";3\npapel higienico'), [{ nombre: 'aceite, girasol 900ml', qty: 3 }, { nombre: 'papel higienico', qty: 1 }]);
assert.deepStrictEqual(parsearLista('yerba 1 kg, 2\nleche 1,5 l'), [{ nombre: 'yerba 1 kg', qty: 2 }, { nombre: 'leche 1,5 l', qty: 1 }]);
assert.deepStrictEqual(parsearLista('azucar 1kg\t4\nfideos\t'), [{ nombre: 'azucar 1kg', qty: 4 }, { nombre: 'fideos', qty: 1 }]);
assert.deepStrictEqual(parsearLista(''), []);
// Ahorro por súper (sin costo de recorrido)
r = analizar([
  { nombre: 'a', qty: 2, precios: { x: 1000, y: 700 } },
  { nombre: 'b', qty: 1, precios: { x: 500, y: 900 } },
  { nombre: 'c', qty: 1, precios: { x: 400, y: 600 } },
  { nombre: 'e', qty: 1, precios: { x: 300, y: 800 } },
  { nombre: 'd', qty: 1, precios: { x: null, y: 300 } },
], { stores: ['x', 'y'], costoViaje: 100, tolerancia: 0 });
assert.strictEqual(r.ahorros.principal, 'x');
assert.strictEqual(r.ahorros.porSuper.y.ahorro, 600);
assert.strictEqual(r.ahorros.porSuper.y.sinAlternativa, 1);
assert.strictEqual(r.ahorros.total, 600);
assert.strictEqual(analizar([{ nombre: 'a', qty: 1, precios: { x: 10, y: 20 } }], { stores: ['x', 'y'] }).ahorros, null);
console.log('OK');

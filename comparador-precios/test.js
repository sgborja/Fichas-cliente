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
assert.strictEqual(r.ahorros.porSuper.y.gasto, 1700);   // a: 700*2 + d: 300
assert.strictEqual(r.ahorros.porSuper.x.gasto, 1200);    // b + c + e
assert.strictEqual(analizar([{ nombre: 'a', qty: 1, precios: { x: 10, y: 20 } }], { stores: ['x', 'y'] }).ahorros, null);

const DINO_HTML = `<div class="col-lg-8 col-md-7 col-sm-12"><div class="row">
<div class="item col-lg-3 col-md-3 col-sm-4 col-xs-6">
  <div categoryRec="true" class="product"  id="prod2290197" pesable="false" cantBulto="10">
    <div class="image"><a href="/super/producto/arroz-dos-hermanos-carnaroli-estuche-x-500-gr/_/A-2290197-2290197-s"><img src="//statics.dinoonline.com.ar/x.jpg" alt="ARROZ"/></a></div>
    <div class="precio-unidad"><span>
      $3,699.00
    </span> x un. <br> Precio s/Imp.Nac.: $3,057.02</div>
    <div class="description limitRow tooltipHere" title="ARROZ DOS HERMANOS CARNAROLI ESTUCHE X 500 GR."  data-toggle="tooltip">
      ARROZ DOS HERMANOS CARNAROLI ESTUCHE X 500 GR.
    </div>
    <div class="precio-referencia">$ 7398.0 x Kilogramo1</div>
  </div>
</div>
<div class="item col-lg-3 col-md-3 col-sm-4 col-xs-6">
  <div categoryRec="true" class="product"  id="prod2290320" pesable="false" cantBulto="10">
    <div class="image"><a href="/super/producto/arroz-dos-hermanos-doble-carolina-x-1-kg/_/A-2290320-2290320-s"></a></div>
    <div class="precio-unidad"><span>
      $2,599.00
    </span> x un.</div>
    <div class="description limitRow" title="ARROZ DOS HERMANOS DOBLE CAROLINA X 1 KG.">ARROZ DOS HERMANOS DOBLE CAROLINA X 1 KG.</div>
  </div>
</div></div></div>`;

// Dino: tarjetas de producto reales
const { _test } = require('./stores');
const d = _test.parsearDino(DINO_HTML, new URL('https://www.dinoonline.com.ar/super/categoria?Ntt=arroz'));
assert.strictEqual(d.out.length, 2);
assert.strictEqual(d.out[0].nombre, 'ARROZ DOS HERMANOS CARNAROLI ESTUCHE X 500 GR.');
assert.strictEqual(d.out[0].precio, 3699);
assert.strictEqual(d.out[1].precio, 2599);
assert.strictEqual(d.out[1].url, 'https://www.dinoonline.com.ar/super/producto/arroz-dos-hermanos-doble-carolina-x-1-kg/_/A-2290320-2290320-s');
assert.strictEqual(d.valida, true);
// y el matching elige el producto del tamaño pedido
const mm = elegir('arroz dos hermanos doble carolina 1 kg', d.out);
assert.strictEqual(mm.precio, 2599); assert.strictEqual(mm.tipo, 'exacto');
// formatos de número
assert.strictEqual(_test.numero('$3,699.00'), 3699); assert.strictEqual(_test.numero('3.699,50'), 3699.5);
assert.strictEqual(_test.numero('2599.0'), 2599); assert.strictEqual(_test.numero('1.250'), 1250); assert.strictEqual(_test.numero('99,90'), 99.9);
assert.strictEqual(_test.decodificar('CAF&Eacute; &amp; T&#201;'), 'CAFÉ & TÉ');
// La Anónima: etiqueta con ">" dentro de un atributo
const la = _test.parsearLaAnonima(`<div id="productos-container" data-total-productos="786"><a href="/arroz-gallo/art_1/" data-tipo="portadaProduct" data-nombre = "Arroz Gallo x 1 Kg." data-rutacategorias = "Almacén  > Arroz" data-precio = "2450" data-precio_anterior = "2882.35" data-precio_oferta = "2450"></a>`, new URL('https://www.laanonima.com.ar/buscar/arroz'));
assert.strictEqual(la.out.length, 1); assert.strictEqual(la.out[0].precio, 2450); assert.strictEqual(la.valida, true);

// Búsqueda completa de Dino con la red simulada: reintenta con menos palabras
(async () => {
  const pedidas = [];
  global.fetch = async (u) => { pedidas.push(decodeURIComponent(new URL(u).searchParams.get('Ntt'))); return { ok: true, text: async () => (pedidas.length < 2 ? '<div class="col-lg-8"></div>' : DINO_HTML) }; };
  const dinoStore = require('./stores').STORES.find((x) => x.id === 'dino');
  const r = await dinoStore.buscar('arroz marca inexistente 1 kg');
  assert.deepStrictEqual(pedidas, ['arroz marca inexistente 1 kg', 'arroz marca inexistente 1']);
  assert.strictEqual(r.length, 2);
  console.log('OK tiendas');
})();
console.log('OK');

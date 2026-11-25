// Análisis de compra: funciona en Node y en el navegador.
(function (root) {
  // results: [{ nombre, qty, precios: { storeId: precio|null } }]
  // opts: { stores:[ids], costoViaje:$ por super extra, tolerancia:% }
  function analizar(results, opts) {
    const stores = opts.stores;
    const costoViaje = opts.costoViaje || 0;
    const tolerancia = (opts.tolerancia ?? 3) / 100;
    const total = (sub) => {
      let suma = 0, faltan = 0;
      const asign = results.map((r) => {
        let best = null;
        for (const s of sub) {
          const p = r.precios[s];
          if (p != null && (best === null || p < best.precio)) best = { store: s, precio: p };
        }
        if (!best) { faltan++; return null; }
        suma += best.precio * (r.qty || 1);
        return best;
      });
      return { suma, faltan, asign };
    };
    const subsets = [];
    for (let m = 1; m < 1 << stores.length; m++)
      subsets.push(stores.filter((_, i) => m & (1 << i)));
    const evals = subsets.map((sub) => {
      const t = total(sub);
      // los faltantes se penalizan fuerte para preferir cobertura completa
      const costo = t.suma + costoViaje * (sub.length - 1);
      return { stores: sub, ...t, costo };
    });
    const minFaltan = Math.min(...evals.map((e) => e.faltan));
    const validos = evals.filter((e) => e.faltan === minFaltan);
    validos.sort((a, b) => a.costo - b.costo || a.stores.length - b.stores.length);
    let mejor = validos[0];
    // Si hay un plan con menos paradas casi igual de barato (dentro de la tolerancia), se prefiere.
    const casi = validos
      .filter((e) => e.stores.length < mejor.stores.length && e.costo <= mejor.costo * (1 + tolerancia))
      .sort((a, b) => a.stores.length - b.stores.length || a.costo - b.costo)[0];
    const elegido = casi || mejor;
    const unaSola = validos.filter((e) => e.stores.length === 1).sort((a, b) => a.costo - b.costo)[0];
    const ideal = total(stores); // comprar cada ítem en el más barato, sin importar el recorrido
    const notas = [];
    if (minFaltan > 0) notas.push(`${minFaltan} producto(s) no se encontraron en ningún súper elegido.`);
    if (casi) notas.push(`Un plan con ${mejor.stores.length} súper ahorraría solo $${(casi.costo - mejor.costo).toFixed(0)} más que el de ${casi.stores.length}: no vale la pena el recorrido extra (tolerancia ${(tolerancia*100).toFixed(0)}%).`);
    if (unaSola && elegido.stores.length > 1) {
      const ahorro = unaSola.costo - elegido.costo;
      notas.push(`Dividir la compra en ${elegido.stores.length} súper ahorra $${ahorro.toFixed(0)} frente a comprar todo en ${unaSola.stores[0]} (ya descontado el costo de recorrido).`);
    }
    // Aporte de cada super del plan: cuánto subiría el total si se lo saca
    const aportes = elegido.stores.length > 1 ? elegido.stores.map((s) => {
      const sin = elegido.stores.filter((x) => x !== s);
      const t = total(sin);
      return { store: s, extra: t.suma - elegido.suma, faltanSin: t.faltan };
    }) : [];
    for (const a of aportes)
      if (a.extra < costoViaje && a.faltanSin === elegido.faltan)
        notas.push(`${a.store} aporta solo $${a.extra.toFixed(0)} de ahorro, menos que el costo del viaje ($${costoViaje}).`);
    return { elegido, unaSola, ideal: { suma: ideal.suma }, notas, aportes };
  }

  // Color por fila: 'barato' (mínimo), 'cerca' (≤ tol sobre mínimo), 'caro' (máximo), '' resto
  function colorFila(precios, stores, tol) {
    const vals = stores.map((s) => precios[s]).filter((v) => v != null);
    const out = {};
    if (!vals.length) return out;
    const min = Math.min(...vals), max = Math.max(...vals);
    for (const s of stores) {
      const p = precios[s];
      if (p == null) continue;
      out[s] = p === min ? 'barato' : p <= min * (1 + tol / 100) ? 'cerca' : p === max && max > min ? 'caro' : '';
    }
    return out;
  }
  const api = { analizar, colorFila };
  if (typeof module !== 'undefined') module.exports = api; else root.Analisis = api;
})(typeof self !== 'undefined' ? self : this);

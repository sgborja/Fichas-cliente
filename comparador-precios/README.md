# Comparador de precios de supermercados (Córdoba)

Planilla de productos → consulta el precio en cada súper → pinta el más barato → recomienda dónde comprar.

```bash
cd comparador-precios
MOCK=1 node server.js   # precios simulados, para probar la interfaz
node server.js          # precios reales (requiere internet hacia los súper)
node test.js            # pruebas de la lógica de análisis y de matching
```
Abrir http://localhost:3000. Sin dependencias (Node 18+).

## Cómo decide
- **Colores**: verde = más barato de la fila, amarillo = dentro de la tolerancia, rojo = el más caro.
- **Producto similar**: si no hay coincidencia total del texto, se toma el mejor candidato con ≥50 % de coincidencia y se marca `similar`.
- **Recomendación**: prueba todas las combinaciones de súper; cada ítem se compra en el más barato dentro de la combinación y se suma el *costo por súper adicional*. Si un plan con menos paradas queda dentro de la tolerancia %, se prefiere. Avisa cuando un súper aporta menos ahorro que lo que cuesta ir.

## Estado de los súper (importante)
Carrefour, Disco, Vea y Chango Más usan la API pública de catálogo de VTEX (`/api/catalog_system/pub/products/search`) **según lo que se sabe de esas plataformas, pero NO se pudo probar contra los sitios reales** (el entorno de desarrollo no tenía salida a internet). La Anónima y Tadicor están marcados "sin configurar": hay que mirar en el navegador (pestaña Red/Network) cómo consulta cada web y escribir su adaptador en `stores.js`.

Los precios y el stock pueden variar por sucursal de Córdoba; en VTEX se ajusta con el parámetro `sc` (canal de venta) en `stores.js`. Además, algunos sitios limitan consultas automáticas: revisar sus términos y mantener el caché (30 min) y volúmenes bajos.

## Limitaciones actuales
No normaliza precio por unidad (ej. $/litro) al comparar productos "similares" de distinto tamaño; conviene escribir el tamaño en la búsqueda (`aceite girasol 900ml`).

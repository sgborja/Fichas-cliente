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

## Novedades
- **Zona (código postal):** el campo "Código postal" (por defecto 5000, Córdoba capital) se traduce a la región de cada súper VTEX y se usa para pedir precios de esa zona. Si no se puede resolver, la app lo avisa debajo del análisis. *Sin verificar contra los sitios reales.*
- **Precio por litro/kilo:** se lee el tamaño del nombre (`1 Lt.`, `900 ml`, `500 gr`, `6 x 330ml`). Si pedís `aceite 900ml` y el súper trae uno de 1,5 l, se compara a precio equivalente (se indica en la celda).
- **Sin instalar nada:** abrir `public/index.html` directo en el navegador funciona con datos simulados. En cualquier modo, **doble clic en un precio** permite escribir el real a mano (sirve para súper sin conexión, como La Anónima).

## Estado de los súper (importante)
Carrefour, Disco, Vea y Chango Más (`masonline.com.ar`) usan la API pública de catálogo de VTEX (`/api/catalog_system/pub/products/search`) **según lo que se sabe de esas plataformas, pero NO se pudo probar contra los sitios reales** (el entorno de desarrollo no tenía salida a internet). Makro y Tadicor se descartaron (solo catálogo/revista) y Supermami está en pausa (sitio en reforma). La Anónima se lee directo del HTML de su búsqueda (`laAnonima` en `stores.js`, etiquetas `data-nombre` / `data-precio`); probado solo con un ejemplo real pegado, no en vivo. Su zona se define con cookies: el programa manda `codigoPostal` (el campo de la pantalla). Para fijar también la zona de precios y la sucursal, definí la variable `LAANONIMA_COOKIES` antes de arrancar (valores que ves en las cookies de tu navegador para laanonima.com.ar: `idZonaPrecio` y `Id-Sucursal-Super`), por ejemplo en Windows: `set LAANONIMA_COOKIES=idZonaPrecio=8; Id-Sucursal-Super=177` y después `node server.js`. No guardes cookies personales ni de sesión en el repositorio.

Los precios y el stock pueden variar por sucursal de Córdoba; en VTEX se ajusta con el parámetro `sc` (canal de venta) en `stores.js`. Además, algunos sitios limitan consultas automáticas: revisar sus términos y mantener el caché (30 min) y volúmenes bajos.

## Limitaciones actuales
El ajuste por tamaño solo aplica cuando escribís el tamaño en la búsqueda y la unidad coincide (litros con litros, kilos con kilos).

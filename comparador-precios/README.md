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

## Funciones
- **Otras opciones:** en cada celda, "otras opciones" muestra los resultados que trajo ese súper (otras marcas/tamaños) para elegir cuál usar; el análisis se recalcula.
- **Ahorro por súper:** cuando la compra se reparte en varios súper, el análisis elige un *súper principal* (el que concentra más productos) y muestra, para cada otro súper, cuánto se ahorra comprando ahí esos productos en vez de en el principal (por producto y en total), sin contar el costo del recorrido; al final, el ahorro neto descontando ese costo. Los números también salen en el CSV exportado.
- **Ordenar e imprimir:** **Ordenar A-Z** ordena la planilla de productos (la recomendación sale siempre en orden alfabético). **Imprimir lista de compras** saca una hoja A4 vertical con qué comprar en cada súper, con casillas para tildar y el total a pagar por súper; **Imprimir comparación** saca la planilla con todos los precios y colores en una hoja horizontal. También se puede guardar como PDF desde el diálogo de impresión.
- **Busca solo lo nuevo:** la app recuerda el resultado de cada producto y de cada súper (por zona). El botón dice **Buscar precios** la primera vez y después **Buscar lo nuevo (N)**: solo consulta productos nuevos o cuyo nombre cambió, súper recién tildados y consultas que dieron error. Cambiar la cantidad no consulta nada. **↻ Actualizar todo** vuelve a consultar todo (pisa los precios cargados a mano).
- **Editar un producto:** clic sobre su nombre en la planilla (Enter = buscar lo nuevo). En cada celda, clic en el nombre del producto encontrado (o en "cambiar producto") para elegir otra opción o **buscar otro texto solo en ese súper**.
- **Listas:** varias listas con nombre (semanal, mensual...) que se guardan en el navegador junto con los últimos precios consultados.
- **Exportar:** "Exportar a Excel (CSV)" baja la comparación y la recomendación; "Imprimir" imprime la tabla.
- **Historial de precios:** el servidor guarda el precio de cada producto por día (`data/historial.json`, o `DATA_DIR`; en Vercel, con Upstash Redis). Si cambió desde un día anterior aparece ▲/▼ con el porcentaje (clic para ver el detalle) y la etiqueta *oferta* cuando el súper informa precio anterior mayor.
- **Límites:** hasta 60 productos por búsqueda y 6 consultas simultáneas a los súper, para no sobrecargarlos.

## Publicarla en Vercel (con tu propio dominio)
Vercel no mantiene un servidor encendido: corre las funciones de `api/` en cada consulta (`vercel.json` las deja en São Paulo, hasta 60 s). La pantalla busca de a un producto por pedido para que cada consulta sea corta.
1. En Vercel: **Add New → Project**, importá el repositorio y creá un proyecto **nuevo** (no toques el del sitio principal).
2. **Root Directory:** `comparador-precios`. **Framework Preset:** *Other*. Sin comando de build.
3. **Rama:** el código está en `claude/dreamy-meitner-op361f`. Para publicarla como producción, en *Settings → Git → Production Branch* elegí esa rama (o fusioná a `main`).
4. **Environment Variables:**
   - `APP_PASSWORD`: la contraseña de acceso (el navegador la pide al entrar y la recuerda).
   - `LAANONIMA_COOKIES` (opcional): `idZonaPrecio=8; Id-Sucursal-Super=177`.
5. **Deploy.** Probá primero con la dirección `*.vercel.app` que te da Vercel.
6. **Dominio:** *Settings → Domains → Add* `precios.tudominio.com.ar`. Si el dominio ya está en tu cuenta de Vercel se configura solo; si no, Vercel te indica el registro DNS (un `CNAME`) para crear donde administrás los DNS.
7. **Historial de precios (opcional):** en Vercel no hay disco, así que el historial queda desactivado. Para activarlo, en la pestaña *Storage* del proyecto agregá una base **Upstash Redis** (plan gratis): Vercel carga solas las variables y el programa la usa. Para el volumen de uso personal alcanza de sobra.

**Advertencia:** los súper pueden bloquear consultas de servidores fuera de Argentina; no hay forma de saberlo sin probar. Si desde Vercel dan "error" y desde tu computadora no, conviene correr el programa en una PC de tu casa con un túnel (por ejemplo Cloudflare Tunnel) o en un hosting argentino.

## Publicarla en otros servicios (Render, Docker)
1. Subí el repositorio a GitHub (ya está) y creá una cuenta en [Render](https://render.com).
2. *New → Blueprint*, elegí el repositorio y la rama; usa `comparador-precios/render.yaml` (o un *Web Service* con Docker y *Root Directory* `comparador-precios`).
3. Definí la variable **`APP_PASSWORD`**: sin contraseña, cualquiera con la dirección podría usar tu servidor para consultar los súper. Al entrar, el navegador pide usuario (cualquiera) y esa contraseña.
4. El disco (`/data`) conserva el historial; sin disco se pierde cada vez que el servicio se reinicia.

**Advertencia:** algunos supermercados bloquean o limitan consultas que vienen de servidores en la nube (a veces solo aceptan IPs de Argentina). No se puede saber hasta probarlo. Si falla online pero anda en tu computadora, la alternativa es dejar el servidor en una PC de tu casa, o elegir un proveedor con servidores en Argentina/Sudamérica.

## Fijar la zona de un súper a mano (variables de entorno)
Si un súper no reconoce el código postal (el aviso debajo del análisis lo indica), se puede fijar su zona con estas variables, usando el id del súper en mayúsculas (`CARREFOUR`, `DISCO`, `VEA`, `CHANGOMAS`):
- `SC_<SUPER>`: canal de venta. Disco y Vea definen la zona así: el valor está en la cookie `vtex_segment` del navegador (campo `channel`, que se ve con `atob(...)` o decodificándola en base64). Disco viene con `33` y Vea con `34` (Córdoba).
- `REGION_<SUPER>`: el identificador de región que usa el sitio (el valor `regionId` que aparece en las consultas de búsqueda del navegador al elegir tu sucursal), por ejemplo `REGION_DISCO`.
- `COOKIES_<SUPER>`: cookies extra para ese súper (por ejemplo `vtex_segment=...`). No pegues cookies de sesión ni de cuenta.
La pantalla de detalle (**ⓘ detalle**) de cada celda muestra qué zona se usó y por qué.

## Estado de los súper (importante)
Carrefour, Disco, Vea y Chango Más (`masonline.com.ar`) usan la API pública de catálogo de VTEX (`/api/catalog_system/pub/products/search`) **según lo que se sabe de esas plataformas, pero NO se pudo probar contra los sitios reales** (el entorno de desarrollo no tenía salida a internet). Makro y Tadicor se descartaron (solo catálogo/revista) y Supermami está en pausa (sitio en reforma). La Anónima se lee directo del HTML de su búsqueda (`laAnonima` en `stores.js`, etiquetas `data-nombre` / `data-precio`); probado solo con un ejemplo real pegado, no en vivo. Su zona se define con cookies: el programa manda `codigoPostal` (el campo de la pantalla). Para fijar también la zona de precios y la sucursal, definí la variable `LAANONIMA_COOKIES` antes de arrancar (valores que ves en las cookies de tu navegador para laanonima.com.ar: `idZonaPrecio` y `Id-Sucursal-Super`), por ejemplo en Windows: `set LAANONIMA_COOKIES=idZonaPrecio=8; Id-Sucursal-Super=177` y después `node server.js`. No guardes cookies personales ni de sesión en el repositorio.

Los precios y el stock pueden variar por sucursal de Córdoba; en VTEX se ajusta con el parámetro `sc` (canal de venta) en `stores.js`. Además, algunos sitios limitan consultas automáticas: revisar sus términos y mantener el caché (30 min) y volúmenes bajos.

## Limitaciones actuales
El ajuste por tamaño solo aplica cuando escribís el tamaño en la búsqueda y la unidad coincide (litros con litros, kilos con kilos).

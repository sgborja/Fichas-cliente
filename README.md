# Lua Azul · Fichas de Clientes

Aplicación web para llevar las fichas de clientes de terapias florales (Flores de Bach y/o California), con identidad visual de Lua Azul.

## Cómo usarla

Es una app 100% en el navegador, sin instalación ni backend. Los datos se guardan en el `localStorage` del navegador.

```bash
# Desde la carpeta del proyecto
python3 -m http.server 8000
# Abrir http://localhost:8000
```

O simplemente abrir `index.html` directamente en el navegador.

## Instalarla como app (PWA)

La app se puede "instalar" en la PC o en el celular, con ícono propio y funcionando sin conexión, porque incluye un manifest (`manifest.json`) y un service worker (`service-worker.js`).

Para que el botón de instalar aparezca, el navegador exige que la página se sirva por **HTTPS** (o `localhost`) — no alcanza con abrir el archivo directamente desde la carpeta. Opciones simples para conseguir esa URL:

- **GitHub Pages** (gratis): en el repo, ir a *Settings → Pages*, elegir la rama y la carpeta raíz, y GitHub genera una URL `https://usuario.github.io/Fichas-cliente/`.
- Cualquier otro hosting estático (Netlify, Vercel, etc.).

Una vez abierta esa URL:

- **En la PC** (Chrome/Edge): aparece un ícono de instalar en la barra de direcciones, o en el menú ⋮ → "Instalar Lua Azul". Queda como un programa aparte, con su propio ícono.
- **En el celular** (Android/Chrome): menú ⋮ → "Agregar a pantalla de inicio" / "Instalar app".
- **En iPhone** (Safari): botón compartir → "Agregar a pantalla de inicio".

Los datos de cada instalación quedan guardados en el `localStorage` de ese navegador/dispositivo — no se sincronizan automáticamente entre PC y celular.

## Funcionalidad

- **Ficha de cliente**: nombre, email, teléfono, fecha de nacimiento y observaciones generales.
- **Historial de atenciones** por cliente: fecha de la sesión, notas de lo hablado, flores indicadas y fecha de la próxima visita.
- **Buscador de flores** con autocompletado (Flores de Bach y Esencias de California) para indicar en cada atención.
- **Recomendador de síntomas**: elegís síntomas/estados emocionales de una lista agrupada por categoría y la app sugiere las flores más adecuadas según coincidencias. Disponible tanto en una vista independiente como dentro del formulario de cada atención.
- Interfaz clara, luminosa y visual en tonos lila, rosa y celeste, con el logo y tipografías de Lua Azul (Poppins + Great Vibes).

## Estructura

```
index.html          Página principal
manifest.json        Configuración de la app instalable (PWA)
service-worker.js     Cacheo para funcionamiento offline
css/styles.css       Estilos (paleta e identidad Lua Azul)
js/data-flores.js     Base de datos de flores (Bach + California) y motor de recomendación
js/db.js              Persistencia en localStorage
js/app.js             Lógica de la interfaz
assets/               Logo, ícono de la app y fuentes de Lua Azul
```

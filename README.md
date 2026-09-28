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

## Funcionalidad

- **Ficha de cliente**: nombre, email, teléfono, fecha de nacimiento y observaciones generales.
- **Historial de atenciones** por cliente: fecha de la sesión, notas de lo hablado, flores indicadas y fecha de la próxima visita.
- **Buscador de flores** con autocompletado (Flores de Bach y Esencias de California) para indicar en cada atención.
- **Recomendador de síntomas**: elegís síntomas/estados emocionales de una lista agrupada por categoría y la app sugiere las flores más adecuadas según coincidencias. Disponible tanto en una vista independiente como dentro del formulario de cada atención.
- Interfaz clara, luminosa y visual en tonos lila, rosa y celeste, con el logo y tipografías de Lua Azul (Poppins + Great Vibes).

## Estructura

```
index.html          Página principal
css/styles.css       Estilos (paleta e identidad Lua Azul)
js/data-flores.js     Base de datos de flores (Bach + California) y motor de recomendación
js/db.js              Persistencia en localStorage
js/app.js             Lógica de la interfaz
assets/               Logo y fuentes de Lua Azul
```

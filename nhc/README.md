# NeoHumanCode · Informes

Sitio donde la persona elige 3 de 4 informes, paga con Mercado Pago y luego carga sus datos de nacimiento. No hay registro de clientes.

```
nhc/            sitio estático (index, gracias, datos, admin, terminos)
supabase/       base de datos (migrations) y funciones del servidor (functions)
```

## Flujo

1. `index.html`: elige 3 informes, deja nombre y mail → función `create-checkout` crea el pedido y la preferencia de Mercado Pago.
2. Mercado Pago cobra y avisa a `mp-webhook`, que verifica el pago contra la API, marca el pedido como pagado y manda mail al cliente con el enlace a `datos.html`.
3. `datos.html?t=<token>` solo funciona con el pago confirmado. `submit-datos` guarda los datos y manda un mail a `ADMIN_EMAIL` ("Nuevo informe en espera").
4. `admin.html`: login, edición de nombre, descripción, orden, visibilidad de cada informe y precio.

## Puesta en marcha

1. **Supabase**: ejecutar `supabase/migrations/001_init.sql`. En *Authentication* crear el usuario admin, desactivar *Allow new users to sign up* y correr `insert into admins (email) values ('tu@mail.com');`.
2. **Secrets de las funciones** (`supabase secrets set ...`):
   - `MP_ACCESS_TOKEN`: Access Token de Mercado Pago (usar el de prueba primero).
   - `RESEND_API_KEY` y `MAIL_FROM` (ej. `NeoHumanCode <hola@tudominio.com>`, dominio verificado en Resend).
   - `ADMIN_EMAIL`: mail que recibe los avisos.
   - `SITE_URL`: URL pública de la carpeta `nhc` (https, sin barra final).
3. Desplegar: `supabase functions deploy create-checkout mp-webhook pedido submit-datos`.
4. Completar `nhc/js/config.js` con la URL y la anon key del proyecto.
5. Subir `imagotipo.png` a `nhc/assets/` (si falta se muestra el nombre en texto).
6. Publicar la carpeta `nhc` (Vercel, Netlify o GitHub Pages) y probar un pago con usuarios de prueba de Mercado Pago.

Pendientes: términos y condiciones (`terminos.html`), versión negativa del logo, aviso por WhatsApp/Telegram.

import { emailOk, json, preflight, SITE_URL, sb } from "../_shared/util.ts";

// Dos tipos de compra, mismo precio fijo (pagás 3, recibís todos los informes activos):
//  - compra propia:  { nombre, email }
//  - gift card:      { tipo: "gift", nombre, email, destinatario_email, destinatario_nombre?, mensaje? }
Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  try {
    const b = await req.json();
    const nombre = String(b.nombre ?? "").trim();
    const email = String(b.email ?? "").trim().toLowerCase();
    if (!nombre || nombre.length > 120) return json({ error: "Falta el nombre." }, 400);
    if (!emailOk(email)) return json({ error: "Mail inválido." }, 400);

    const { data: cfg } = await sb.from("config").select("precio,moneda").eq("id", 1).single();
    if (!cfg || Number(cfg.precio) <= 0) return json({ error: "Precio no configurado." }, 500);

    let titulo: string, referencia: string, volver: string;

    if (b.tipo === "gift") {
      const dest = String(b.destinatario_email ?? "").trim().toLowerCase();
      const destNombre = String(b.destinatario_nombre ?? "").trim().slice(0, 120);
      const mensaje = String(b.mensaje ?? "").trim();
      if (!emailOk(dest)) return json({ error: "El mail de quien recibe el regalo es inválido." }, 400);
      if (mensaje.length > 500) return json({ error: "El mensaje es demasiado largo." }, 400);

      const { data: g, error } = await sb.from("giftcards").insert({
        comprador_nombre: nombre,
        comprador_email: email,
        destinatario_nombre: destNombre || null,
        destinatario_email: dest,
        mensaje: mensaje || null,
        monto: cfg.precio,
        moneda: cfg.moneda,
      }).select("id,token").single();
      if (error) throw error;
      titulo = "NeoHumanCode · Gift card";
      referencia = `gift:${g.id}`;
      volver = `${SITE_URL}/gracias.html?g=${g.token}`;
    } else {
      const { data: infs } = await sb.from("informes").select("id,nombre").eq("activo", true).order("orden");
      if (!infs?.length) return json({ error: "No hay informes disponibles." }, 500);

      const { data: pedido, error } = await sb.from("pedidos").insert({
        nombre, email, informes: infs, monto: cfg.precio, moneda: cfg.moneda,
      }).select("id,token").single();
      if (error) throw error;
      titulo = "NeoHumanCode · Informes";
      referencia = pedido.id;
      volver = `${SITE_URL}/gracias.html?t=${pedido.token}`;
    }

    const mp = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("MP_ACCESS_TOKEN")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ title: titulo, quantity: 1, unit_price: Number(cfg.precio), currency_id: cfg.moneda }],
        payer: { email, name: nombre },
        external_reference: referencia,
        back_urls: { success: volver, pending: volver, failure: volver },
        auto_return: "approved",
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook`,
        statement_descriptor: "NEOHUMANCODE",
      }),
    });
    if (!mp.ok) throw new Error(`MercadoPago ${mp.status}: ${await mp.text()}`);
    const pref = await mp.json();
    return json({ url: pref.init_point });
  } catch (e) {
    console.error(e);
    return json({ error: "No pudimos iniciar el pago. Probá de nuevo." }, 500);
  }
});

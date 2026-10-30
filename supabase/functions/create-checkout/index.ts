import { json, preflight, SITE_URL, sb } from "../_shared/util.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  try {
    const { informes, email, nombre } = await req.json();
    const ids = Array.isArray(informes) ? [...new Set(informes)] : [];
    if (ids.length !== 3) return json({ error: "Elegí exactamente 3 informes." }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? ""))) return json({ error: "Mail inválido." }, 400);
    if (!String(nombre ?? "").trim()) return json({ error: "Falta el nombre." }, 400);

    const { data: infs } = await sb.from("informes").select("id,nombre").in("id", ids).eq("activo", true);
    if (infs?.length !== 3) return json({ error: "Algún informe ya no está disponible." }, 400);

    const { data: cfg } = await sb.from("config").select("precio,moneda").eq("id", 1).single();
    if (!cfg || Number(cfg.precio) <= 0) return json({ error: "Precio no configurado." }, 500);

    const { data: pedido, error } = await sb.from("pedidos").insert({
      nombre: String(nombre).trim(),
      email: String(email).trim().toLowerCase(),
      informes: infs,
      monto: cfg.precio,
      moneda: cfg.moneda,
    }).select("id,token").single();
    if (error) throw error;

    const volver = `${SITE_URL}/gracias.html?t=${pedido.token}`;
    const mp = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("MP_ACCESS_TOKEN")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{
          title: "NeoHumanCode · 3 informes",
          quantity: 1,
          unit_price: Number(cfg.precio),
          currency_id: cfg.moneda,
        }],
        payer: { email: String(email).trim(), name: String(nombre).trim() },
        external_reference: pedido.id,
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

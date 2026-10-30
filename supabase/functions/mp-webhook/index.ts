import { emailLayout, esc, sb, SITE_URL, sendMail } from "../_shared/util.ts";

// Mercado Pago avisa acá. No confiamos en el aviso: consultamos el pago a la API con nuestro token.
Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    let body: any = {};
    try { body = await req.json(); } catch { /* algunos avisos vienen sin cuerpo */ }

    const tipo = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body.type ?? body.topic;
    const paymentId = url.searchParams.get("data.id") ?? body?.data?.id ?? url.searchParams.get("id");
    if (tipo !== "payment" || !paymentId) return new Response("ignorado", { status: 200 });

    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${Deno.env.get("MP_ACCESS_TOKEN")}` },
    });
    if (!res.ok) return new Response("pago no encontrado", { status: 500 });
    const pago = await res.json();
    if (pago.status !== "approved") return new Response("no aprobado", { status: 200 });

    const { data: pedido } = await sb.from("pedidos").select("*").eq("id", pago.external_reference).maybeSingle();
    if (!pedido) return new Response("pedido inexistente", { status: 200 });
    if (Number(pago.transaction_amount) < Number(pedido.monto)) {
      console.error("monto menor al esperado", pedido.id);
      return new Response("monto inválido", { status: 200 });
    }

    // Solo el primer aviso pasa de pendiente a pagado (idempotente)
    const { data: act } = await sb.from("pedidos")
      .update({ estado: "pagado", mp_payment_id: String(paymentId), pagado_en: new Date().toISOString() })
      .eq("id", pedido.id).eq("estado", "pendiente").select("id");
    if (!act?.length) return new Response("ya procesado", { status: 200 });

    const lista = (pedido.informes as { nombre: string }[]).map((i) => `<li>${esc(i.nombre)}</li>`).join("");
    await sendMail(
      pedido.email,
      "Recibimos tu pago · NeoHumanCode",
      emailLayout(
        "¡Pago confirmado!",
        `<p>Hola ${esc(pedido.nombre)}, recibimos tu pago. Tus informes:</p><ul>${lista}</ul>
         <p>Falta un último paso: ingresá tus datos de nacimiento para que podamos preparar tu lectura.</p>`,
        { texto: "Ingresar mis datos", url: `${SITE_URL}/datos.html?t=${pedido.token}` },
      ),
    );
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 }); // Mercado Pago reintenta
  }
});

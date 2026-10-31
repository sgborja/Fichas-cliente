import { emailLayout, esc, fechaLarga, generarCodigo, sb, SITE_URL, sendMail, venceGift } from "../_shared/util.ts";

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

    const ref = String(pago.external_reference ?? "");
    return ref.startsWith("gift:") ? await pagarGift(ref.slice(5), pago, paymentId) : await pagarPedido(ref, pago, paymentId);
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 }); // Mercado Pago reintenta
  }
});

async function pagarPedido(id: string, pago: any, paymentId: string) {
  const { data: pedido } = await sb.from("pedidos").select("*").eq("id", id).maybeSingle();
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
}

async function pagarGift(id: string, pago: any, paymentId: string) {
  const { data: g } = await sb.from("giftcards").select("*").eq("id", id).maybeSingle();
  if (!g) return new Response("gift inexistente", { status: 200 });
  if (Number(pago.transaction_amount) < Number(g.monto)) {
    console.error("monto menor al esperado (gift)", g.id);
    return new Response("monto inválido", { status: 200 });
  }

  // Genera el código al confirmar el pago; solo el primer aviso lo logra (idempotente)
  let gift: any = null;
  for (let i = 0; i < 5 && !gift; i++) {
    const { data, error } = await sb.from("giftcards")
      .update({ estado: "pagada", codigo: generarCodigo(), mp_payment_id: String(paymentId), pagado_en: new Date().toISOString() })
      .eq("id", g.id).eq("estado", "pendiente").select("*");
    if (error && error.code !== "23505") throw error; // 23505: código repetido, reintenta con otro
    if (!error) { if (!data?.length) return new Response("ya procesado", { status: 200 }); gift = data[0]; }
  }
  if (!gift) throw new Error("no se pudo generar el código");

  const vence = fechaLarga(venceGift(gift.pagado_en));
  const de = esc(gift.comprador_nombre);
  const para = gift.destinatario_nombre ? esc(gift.destinatario_nombre) : "";
  const msg = gift.mensaje ? `<p style="background:#FFF8F0;border-radius:12px;padding:12px 16px"><i>«${esc(gift.mensaje)}»</i><br>— ${de}</p>` : "";
  const codigoHtml = `<p style="text-align:center;font-size:26px;letter-spacing:3px;font-weight:600;margin:18px 0">${esc(gift.codigo)}</p>`;

  // Los mails no deben hacer fallar el aviso: el comprador también ve el código en la página de gracias
  const envios = await Promise.allSettled([
    sendMail(
      gift.destinatario_email,
      `${gift.comprador_nombre} te regaló NeoHumanCode`,
      emailLayout(
        "¡Tenés un regalo!",
        `<p style="text-align:center;margin:0 0 16px"><img src="${SITE_URL}/assets/giftcard.jpg" alt="Gift card NeoHumanCode: 4 informes personalizados" width="480" style="max-width:100%;height:auto;border-radius:12px"></p>
         <p>${para ? `Hola ${para}, ` : "Hola, "}${de} te regaló tus informes de autoconocimiento NeoHumanCode.</p>${msg}
         <p>Tu código de regalo:</p>${codigoHtml}
         <p>Ingresalo en el sitio, cargá tus datos de nacimiento y listo. <b>Podés canjearlo hasta el ${vence}.</b></p>`,
        { texto: "Canjear mi regalo", url: `${SITE_URL}/canjear.html?c=${encodeURIComponent(gift.codigo)}` },
      ),
      gift.comprador_email,
    ),
    sendMail(
      gift.comprador_email,
      "Tu gift card está lista · NeoHumanCode",
      emailLayout(
        "¡Gift card confirmada!",
        `<p>Hola ${de}, recibimos tu pago. Le enviamos el regalo a <b>${esc(gift.destinatario_email)}</b>.</p>
         <p>Este es el código, por si querés compartirlo vos (vence el ${vence}):</p>${codigoHtml}`,
      ),
    ),
  ]);
  envios.forEach((r) => r.status === "rejected" && console.error(r.reason));
  return new Response("ok", { status: 200 });
}

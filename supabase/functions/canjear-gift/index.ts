import { emailLayout, emailOk, esc, json, normalizarCodigo, preflight, sb, SITE_URL, sendMail } from "../_shared/util.ts";

// Canje de una gift card: { codigo, nombre, email }. Crea un pedido ya pagado (monto 0) y devuelve su token
// para continuar directo en datos.html.
Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  try {
    const b = await req.json();
    const codigo = normalizarCodigo(b.codigo);
    const nombre = String(b.nombre ?? "").trim();
    const email = String(b.email ?? "").trim().toLowerCase();
    if (!codigo) return json({ error: "El código no es válido." }, 400);
    if (!nombre || nombre.length > 120) return json({ error: "Falta tu nombre." }, 400);
    if (!emailOk(email)) return json({ error: "Mail inválido." }, 400);

    const { data: g } = await sb.from("giftcards").select("*").eq("codigo", codigo).maybeSingle();
    if (!g || g.estado === "pendiente") return json({ error: "No encontramos ese código." }, 404);
    if (g.estado === "canjeada") return json({ error: "Ese código ya fue canjeado." }, 409);

    // Reserva el canje: solo una solicitud puede pasar de pagada a canjeada
    const { data: res } = await sb.from("giftcards")
      .update({ estado: "canjeada", canjeado_en: new Date().toISOString() })
      .eq("id", g.id).eq("estado", "pagada").select("id");
    if (!res?.length) return json({ error: "Ese código ya fue canjeado." }, 409);

    const { data: infs } = await sb.from("informes").select("id,nombre").eq("activo", true).order("orden");
    const { data: pedido, error } = await sb.from("pedidos").insert({
      nombre, email, informes: infs ?? [], monto: 0, moneda: g.moneda,
      estado: "pagado", pagado_en: new Date().toISOString(), giftcard_id: g.id,
    }).select("id,token").single();
    if (error || !pedido) {
      await sb.from("giftcards").update({ estado: "pagada", canjeado_en: null }).eq("id", g.id); // devuelve el código
      throw error ?? new Error("no se pudo crear el pedido");
    }

    const lista = (infs ?? []).map((i) => `<li>${esc(i.nombre)}</li>`).join("");
    sendMail(
      email,
      "Tu regalo está activado · NeoHumanCode",
      emailLayout(
        "¡Regalo activado!",
        `<p>Hola ${esc(nombre)}, canjeaste tu gift card. Tus informes:</p><ul>${lista}</ul>
         <p>Falta un último paso: ingresá tus datos de nacimiento para que podamos preparar tu lectura.</p>`,
        { texto: "Ingresar mis datos", url: `${SITE_URL}/datos.html?t=${pedido.token}` },
      ),
    ).catch(console.error);

    return json({ token: pedido.token });
  } catch (e) {
    console.error(e);
    return json({ error: "No pudimos canjear el código. Probá de nuevo." }, 500);
  }
});

import { emailLayout, esc, json, preflight, sb, sendMail } from "../_shared/util.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  try {
    const b = await req.json();
    const lugar = String(b.lugar ?? "").trim();
    const email = String(b.email ?? "").trim().toLowerCase();
    const telefono = String(b.telefono ?? "").trim();
    const hora = String(b.hora ?? "").trim();
    const fecha = String(b.fecha ?? "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || isNaN(Date.parse(fecha))) return json({ error: "Fecha inválida." }, 400);
    if (!/^\d{2}:\d{2}$/.test(hora) && hora !== "desconocida") return json({ error: "Hora inválida." }, 400);
    if (!lugar || lugar.length > 200) return json({ error: "Falta el lugar de nacimiento." }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Mail inválido." }, 400);
    if (telefono.length > 40) return json({ error: "Teléfono inválido." }, 400);

    const { data: p } = await sb.from("pedidos").select("*").eq("token", String(b.token ?? "")).maybeSingle();
    if (!p) return json({ error: "Enlace inválido." }, 404);
    if (p.estado !== "pagado") return json({ error: "El pago todavía no está confirmado." }, 402);

    const { error } = await sb.from("datos_nacimiento").insert({
      pedido_id: p.id,
      fecha_nacimiento: fecha,
      hora_nacimiento: hora,
      lugar_nacimiento: lugar,
      email,
      telefono: telefono || null,
    });
    if (error) {
      if (error.code === "23505") return json({ error: "Ya recibimos tus datos." }, 409);
      throw error;
    }

    const lista = (p.informes as { nombre: string }[]).map((i) => `<li>${esc(i.nombre)}</li>`).join("");
    // Aviso a la administradora: nuevo informe en espera
    await sendMail(
      Deno.env.get("ADMIN_EMAIL")!,
      `Nuevo informe en espera · ${p.nombre}`,
      emailLayout(
        "Nuevo informe en espera",
        `<p><b>Nombre:</b> ${esc(p.nombre)}<br>
         <b>Fecha de nacimiento:</b> ${esc(fecha)}<br>
         <b>Hora:</b> ${esc(hora)}<br>
         <b>Lugar:</b> ${esc(lugar)}<br>
         <b>Mail:</b> ${esc(email)}<br>
         <b>Teléfono:</b> ${esc(telefono || "—")}</p>
         <p><b>Informes pagados:</b></p><ul>${lista}</ul>`,
      ),
      email,
    );
    // Confirmación al cliente (si falla, los datos ya están guardados)
    sendMail(
      email,
      "Recibimos tus datos · NeoHumanCode",
      emailLayout(
        "¡Listo, ya tenemos tus datos!",
        `<p>Hola ${esc(p.nombre)}, estamos preparando tus informes. Te los enviamos a este mail.</p>`,
      ),
    ).catch(console.error);

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: "No pudimos guardar tus datos. Probá de nuevo." }, 500);
  }
});

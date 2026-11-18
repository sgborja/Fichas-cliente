import { emailLayout, emailOk, esc, fechaLarga, generarCodigo, json, preflight, sb, SITE_URL, sendMail, venceGift } from "../_shared/util.ts";

// Gift cards de cortesía emitidas por la administración (sin pago).
// Solo para administradores con sesión: { lista: [{ nombre, email }], mensaje?, enviar? (por defecto true) }
// Crea una gift card pagada por cada persona y le manda el mail a su nombre. Repetir la llamada no duplica:
// si la persona ya tiene un regalo sin canjear, reutiliza ese código y solo reintenta el mail si no salió.
const DE = "NeoHumanCode";
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  try {
    // Autenticación: usuario logueado y presente en la tabla admins
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await sb.auth.getUser(jwt);
    const mail = u?.user?.email?.toLowerCase();
    if (!mail) return json({ error: "Iniciá sesión en el panel." }, 401);
    const { data: adm } = await sb.from("admins").select("email").ilike("email", mail.replace(/[%_\\]/g, "\\$&")).maybeSingle();
    if (!adm) return json({ error: "Esta cuenta no es administradora." }, 403);

    const b = await req.json();
    const enviar = b.enviar !== false;
    const mensaje = String(b.mensaje ?? "").trim();
    const lista = Array.isArray(b.lista) ? b.lista : [];
    if (!lista.length) return json({ error: "La lista está vacía." }, 400);
    if (lista.length > 50) return json({ error: "Máximo 50 regalos por vez." }, 400);
    if (mensaje.length > 500) return json({ error: "El mensaje es demasiado largo." }, 400);

    if (enviar) {
      const falta = ["RESEND_API_KEY", "MAIL_FROM", "SITE_URL"].filter((k) => !Deno.env.get(k));
      if (falta.length) return json({ error: `Faltan configurar en Supabase (Edge Functions → Secrets): ${falta.join(", ")}.` }, 500);
    }

    const { data: cfg } = await sb.from("config").select("moneda").eq("id", 1).single();
    const resultados: Record<string, unknown>[] = [];
    const vistos = new Set<string>();

    for (const item of lista) {
      const nombre = String(item?.nombre ?? "").trim().slice(0, 120);
      const email = String(item?.email ?? "").trim().toLowerCase();
      const r: Record<string, unknown> = { nombre, email };
      resultados.push(r);
      if (!nombre || !emailOk(email)) { r.estado = "error"; r.error = "Nombre o mail inválido."; continue; }
      if (vistos.has(email)) { r.estado = "error"; r.error = "Mail repetido en la lista."; continue; }
      vistos.add(email);

      try {
        // Reutiliza un regalo de cortesía ya emitido para este mail y todavía sin canjear
        let { data: g } = await sb.from("giftcards").select("*")
          .eq("comprador_nombre", DE).eq("destinatario_email", email).eq("estado", "pagada")
          .order("creado", { ascending: false }).limit(1).maybeSingle();

        if (!g) {
          for (let i = 0; i < 5 && !g; i++) {
            const { data, error } = await sb.from("giftcards").insert({
              comprador_nombre: DE, comprador_email: mail,
              destinatario_nombre: nombre, destinatario_email: email,
              mensaje: mensaje || null, monto: 0, moneda: cfg?.moneda ?? "ARS",
              estado: "pagada", codigo: generarCodigo(), pagado_en: new Date().toISOString(),
            }).select("*").single();
            if (error && error.code !== "23505") throw error; // 23505: código repetido, reintenta
            if (!error) g = data;
          }
          if (!g) throw new Error("no se pudo generar el código");
        }
        r.codigo = g.codigo;

        if (!enviar) { r.estado = "creada"; continue; }
        if (g.enviado_en) { r.estado = "ya_enviada"; continue; }

        const vence = fechaLarga(venceGift(g.pagado_en));
        const msg = g.mensaje ? `<p style="background:#FFF8F0;border-radius:12px;padding:12px 16px"><i>«${esc(g.mensaje)}»</i><br>— ${DE}</p>` : "";
        const enlace = `${SITE_URL}/canjear.html?c=${encodeURIComponent(g.codigo)}&n=${encodeURIComponent(nombre)}&e=${encodeURIComponent(email)}`;
        await sendMail(
          email,
          `${nombre}, NeoHumanCode te regala tus informes`,
          emailLayout(
            `¡Tenés un regalo, ${nombre}!`,
            `<p style="text-align:center;margin:0 0 16px"><img src="${SITE_URL}/assets/giftcard.jpg" alt="Gift card NeoHumanCode: 4 informes personalizados" width="480" style="max-width:100%;height:auto;border-radius:12px"></p>
             <p>Hola ${esc(nombre)}, ${DE} te regala tus informes de autoconocimiento.</p>${msg}
             <p>Tu código de regalo:</p>
             <p style="text-align:center;font-size:26px;letter-spacing:3px;font-weight:600;margin:18px 0">${esc(g.codigo)}</p>
             <p>Entrá al sitio, cargá tus datos de nacimiento y listo: el pago ya está resuelto. <b>Podés canjearlo hasta el ${vence}.</b></p>`,
            { texto: "Canjear mi regalo", url: enlace },
          ),
          Deno.env.get("ADMIN_EMAIL") || undefined,
        );
        await sb.from("giftcards").update({ enviado_en: new Date().toISOString() }).eq("id", g.id);
        r.estado = "enviada";
        await pausa(600); // el plan gratuito de Resend admite 2 envíos por segundo
      } catch (e) {
        console.error(e);
        r.estado = "error";
        r.error = String((e as Error).message ?? e).slice(0, 300);
      }
    }
    return json({ resultados });
  } catch (e) {
    console.error(e);
    return json({ error: "No pudimos crear los regalos. Probá de nuevo." }, 500);
  }
});

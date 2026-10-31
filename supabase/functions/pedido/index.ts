import { json, preflight, sb } from "../_shared/util.ts";

// Estado de un pedido (?t=) o de una gift card comprada (?g=) para la página "gracias", y de un pedido para "datos".
// Se consulta con el token privado.
Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const q = new URL(req.url).searchParams;
  const tokenOk = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

  const g = q.get("g");
  if (g !== null) {
    if (!tokenOk(g)) return json({ error: "enlace inválido" }, 400);
    const { data } = await sb.from("giftcards")
      .select("estado,comprador_nombre,destinatario_email,codigo").eq("token", g).maybeSingle();
    if (!data) return json({ error: "enlace inválido" }, 404);
    return json({
      tipo: "gift",
      estado: data.estado === "pendiente" ? "pendiente" : "pagado",
      nombre: data.comprador_nombre,
      destinatario_email: data.destinatario_email,
      codigo: data.estado === "pendiente" ? null : data.codigo,
    });
  }

  const t = q.get("t") ?? "";
  if (!tokenOk(t)) return json({ error: "enlace inválido" }, 400);

  const { data: p } = await sb.from("pedidos").select("id,nombre,email,estado,informes").eq("token", t).maybeSingle();
  if (!p) return json({ error: "enlace inválido" }, 404);

  const { data: d } = await sb.from("datos_nacimiento").select("pedido_id").eq("pedido_id", p.id).maybeSingle();
  return json({
    estado: p.estado,
    nombre: p.nombre,
    email: p.email,
    informes: (p.informes as { nombre: string }[]).map((i) => i.nombre),
    datos_enviados: !!d,
  });
});

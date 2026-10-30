import { json, preflight, sb } from "../_shared/util.ts";

// Estado de un pedido para las páginas "gracias" y "datos". Se consulta con el token privado.
Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const t = new URL(req.url).searchParams.get("t") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(t)) return json({ error: "enlace inválido" }, 400);

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

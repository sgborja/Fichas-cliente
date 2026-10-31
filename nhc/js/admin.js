const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);

async function mostrar(sesion) {
  $("login").classList.toggle("hidden", !!sesion);
  $("app").classList.toggle("hidden", !sesion);
  $("salir").classList.toggle("hidden", !sesion);
  if (sesion) await Promise.all([cargar(), cargarPedidos(), cargarGifts()]);
}

const fecha = (s) => s ? new Date(s).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "—";
const badge = (txt, ok) => el("span", { class: "badge" + (ok ? " ok" : "") }, txt);
const fila = (k, v) => el("div", { class: "kv" }, el("span", {}, k), el("b", {}, v ?? "—"));

async function cargarPedidos() {
  const { data, error } = await db.from("pedidos").select("*, datos_nacimiento(*)").order("creado", { ascending: false });
  if (error) { $("listaPedidos").textContent = "No se pudieron cargar los pedidos."; return; }
  const pagados = data.filter((p) => p.estado === "pagado");
  const sinDatos = pagados.filter((p) => !p.datos_nacimiento);
  $("resPedidos").replaceChildren(
    el("div", {}, el("b", {}, String(data.length)), " pedidos"),
    el("div", {}, el("b", {}, String(pagados.length)), " pagados"),
    el("div", {}, el("b", {}, String(sinDatos.length)), " esperando datos de nacimiento"));
  $("listaPedidos").replaceChildren(...(data.length ? data.map((p) => {
    const d = p.datos_nacimiento;
    const gift = !!p.giftcard_id;
    return el("div", { class: "admin-card" },
      el("div", { class: "head" },
        el("h3", {}, p.nombre),
        el("span", {},
          badge(gift ? "Gift card" : "Compra", false),
          badge(p.estado === "pagado" ? "Pagado" : "Pendiente de pago", p.estado === "pagado"),
          p.estado === "pagado" ? badge(d ? "Datos recibidos" : "Faltan datos", !!d) : "")),
      fila("Mail", p.email),
      fila("Pedido", fecha(p.creado) + (gift ? "" : ` · ${money(p.monto, p.moneda)}`)),
      fila("Informes", (p.informes || []).map((i) => i.nombre).join(", ")),
      d ? el("div", { class: "datos" },
        fila("Nacimiento", `${d.fecha_nacimiento} · ${d.hora_nacimiento}`),
        fila("Lugar", d.lugar_nacimiento),
        fila("Mail de contacto", d.email),
        fila("Teléfono", d.telefono)) : "");
  }) : [el("p", { class: "msg" }, "Todavía no hay pedidos.")]));
}

async function cargarGifts() {
  const { data, error } = await db.from("giftcards").select("*").order("creado", { ascending: false });
  if (error) { $("listaGifts").textContent = "No se pudieron cargar las gift cards."; return; }
  const cuenta = (e) => data.filter((g) => g.estado === e).length;
  $("resGifts").replaceChildren(
    el("div", {}, el("b", {}, String(data.length)), " gift cards"),
    el("div", {}, el("b", {}, String(cuenta("pagada"))), " sin canjear"),
    el("div", {}, el("b", {}, String(cuenta("canjeada"))), " canjeadas"));
  const rot = { pendiente: "Pendiente de pago", pagada: "Pagada, sin canjear", canjeada: "Canjeada" };
  $("listaGifts").replaceChildren(...(data.length ? data.map((g) =>
    el("div", { class: "admin-card" },
      el("div", { class: "head" },
        el("h3", {}, g.codigo || "(sin código: pago pendiente)"),
        badge(rot[g.estado], g.estado !== "pendiente")),
      fila("Compró", `${g.comprador_nombre} · ${g.comprador_email}`),
      fila("Para", `${g.destinatario_nombre ? g.destinatario_nombre + " · " : ""}${g.destinatario_email}`),
      g.mensaje ? fila("Mensaje", g.mensaje) : "",
      fila("Creada", fecha(g.creado) + ` · ${money(g.monto, g.moneda)}`),
      g.pagado_en ? fila("Pagada", fecha(g.pagado_en)) : "",
      g.pagado_en ? fila("Vence", (() => { const v = new Date(g.pagado_en); v.setFullYear(v.getFullYear() + 1); return v.toLocaleDateString("es-AR") + (g.estado === "pagada" && v < new Date() ? " (vencida)" : ""); })()) : "",
      g.canjeado_en ? fila("Canjeada", fecha(g.canjeado_en)) : "")
  ) : [el("p", { class: "msg" }, "Todavía no hay gift cards.")]));
}

document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === b));
  ["pedidos", "gifts", "config"].forEach((t) => $("t-" + t).classList.toggle("hidden", t !== b.dataset.tab));
}));

async function cargar() {
  const [{ data: cfg }, { data: lista, error }] = await Promise.all([
    db.from("config").select("precio,moneda").eq("id", 1).single(),
    db.from("informes").select("*").order("orden"),
  ]);
  if (error) { $("lista").textContent = "Esta cuenta no tiene permiso de administración."; return; }
  if (cfg) { $("precio").value = cfg.precio; $("moneda").value = cfg.moneda; }
  $("lista").replaceChildren(...lista.map(tarjeta));
}

function tarjeta(inf) {
  const nombre = el("input", { value: inf.nombre, maxlength: 80 });
  const desc = el("textarea", { maxlength: 600 }); desc.value = inf.descripcion;
  const icono = el("input", { value: inf.icono, maxlength: 4 });
  const orden = el("input", { type: "number", value: inf.orden });
  const activo = el("input", { type: "checkbox" }); activo.checked = inf.activo;
  const msg = el("span", { class: "msg" });

  const guardar = async () => {
    msg.textContent = "Guardando…";
    const { error } = await db.from("informes").update({
      nombre: nombre.value.trim(), descripcion: desc.value.trim(),
      icono: icono.value.trim() || "✨", orden: Number(orden.value) || 0, activo: activo.checked,
    }).eq("id", inf.id);
    msg.textContent = error ? "No se pudo guardar." : "Guardado ✓";
  };
  const borrar = async () => {
    if (!confirm(`¿Eliminar "${inf.nombre}"? Los pedidos ya hechos conservan su nombre.`)) return;
    const { error } = await db.from("informes").delete().eq("id", inf.id);
    if (error) msg.textContent = "No se pudo eliminar."; else cargar();
  };

  return el("div", { class: "admin-card" },
    el("label", {}, "Nombre"), nombre,
    el("label", {}, "Descripción"), desc,
    el("div", { class: "row" },
      el("div", {}, el("label", {}, "Ícono (un emoji)"), icono),
      el("div", {}, el("label", {}, "Orden"), orden),
      el("label", { class: "toggle" }, activo, "Visible en la web")),
    el("div", { class: "actions" },
      el("button", { class: "btn", onclick: guardar }, "Guardar"),
      el("button", { class: "btn ghost", onclick: borrar }, "Eliminar"), msg));
}

$("login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const { error } = await db.auth.signInWithPassword({ email: $("u").value.trim(), password: $("p").value });
  if (error) $("lmsg").textContent = "Mail o contraseña incorrectos.";
  else mostrar(true);
});
$("salir").addEventListener("click", async () => { await db.auth.signOut(); mostrar(false); });

$("gPrecio").addEventListener("click", async () => {
  const { error } = await db.from("config").update({ precio: Number($("precio").value), moneda: $("moneda").value.trim().toUpperCase() }).eq("id", 1);
  $("mPrecio").textContent = error ? "No se pudo guardar." : "Guardado ✓";
});

$("nuevo").addEventListener("click", async () => {
  const { error } = await db.from("informes").insert({ nombre: "Nuevo informe", descripcion: "", icono: "✨", orden: 99, activo: false });
  if (!error) cargar();
});

db.auth.getSession().then(({ data }) => mostrar(!!data.session));

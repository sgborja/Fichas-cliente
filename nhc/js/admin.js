const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);

async function mostrar(sesion) {
  $("login").classList.toggle("hidden", !!sesion);
  $("app").classList.toggle("hidden", !sesion);
  $("salir").classList.toggle("hidden", !sesion);
  if (sesion) await cargar();
}

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

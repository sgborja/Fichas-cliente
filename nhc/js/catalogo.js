const MAX = 3;
const DEMO = {
  config: { precio: 24900, moneda: "ARS" },
  informes: [
    { id: "1", icono: "🌱", nombre: "Bereshit", descripcion: "Tu identidad, tus vínculos, tu propósito y la etapa vital que atravesás. Un recorrido para entender quién sos, de dónde venís y hacia dónde querés ir." },
    { id: "2", icono: "🧭", nombre: "Talento y Puesto", descripcion: "Tus fortalezas, capacidades y motivaciones, y cómo decidís y trabajás en equipo. Una guía para orientar tu desarrollo profesional." },
    { id: "3", icono: "🤝", nombre: "Jacinta", descripcion: "Cómo te vinculás con los demás y cómo influís en ellos: emociones, motivaciones, armonía y liderazgo, en doce dimensiones." },
    { id: "4", icono: "🌳", nombre: "Árbol de la Vida", descripcion: "Una lectura desde la Cábala y las Sefirot: patrones simbólicos de tu identidad y prácticas para profundizar tu dimensión espiritual." },
  ],
};
const elegidos = new Map(); // id -> nombre
let informes = [];

const $ = (id) => document.getElementById(id);

function pintar() {
  const lleno = elegidos.size >= MAX;
  $("contador").textContent = `${elegidos.size} de ${MAX} elegidos`;
  $("seguir").disabled = elegidos.size !== MAX;
  document.querySelectorAll(".card").forEach((c) => {
    const on = elegidos.has(c.dataset.id);
    c.setAttribute("aria-pressed", on);
    c.classList.toggle("disabled", lleno && !on);
  });
}

function toggle(inf) {
  if (elegidos.has(inf.id)) elegidos.delete(inf.id);
  else if (elegidos.size < MAX) elegidos.set(inf.id, inf.nombre);
  pintar();
}

async function init() {
  try {
    const demo = SUPABASE_URL.includes("TU-PROYECTO"); // vista previa sin backend
    const [lista, cfg] = demo ? [DEMO.informes, [DEMO.config]] : await Promise.all([
      rest("informes?activo=eq.true&order=orden.asc&select=id,nombre,descripcion,icono"),
      rest("config?id=eq.1&select=precio,moneda"),
    ]);
    informes = lista;
    const c = cfg[0];
    $("precio").textContent = c ? money(c.precio, c.moneda) : "";
    lista.forEach((inf) => {
      $("grid").append(
        el("button", { class: "card", type: "button", "data-id": inf.id, "aria-pressed": "false", onclick: () => toggle(inf) },
          el("span", { class: "check", "aria-hidden": "true" }, "✓"),
          el("span", { class: "ico", "aria-hidden": "true" }, inf.icono || "✨"),
          el("h3", {}, inf.nombre),
          el("p", {}, inf.descripcion)),
      );
    });
    pintar();
  } catch (e) {
    $("catMsg").textContent = e.message;
  }
}

$("seguir").addEventListener("click", () => {
  const ul = $("resumen");
  ul.replaceChildren(...[...elegidos.values()].map((n) => el("li", {}, n)));
  $("catalogo").classList.add("hidden");
  $("bar").classList.add("hidden");
  $("checkout").classList.remove("hidden");
  scrollTo({ top: 0, behavior: "smooth" });
});

$("volver").addEventListener("click", () => {
  $("checkout").classList.add("hidden");
  $("catalogo").classList.remove("hidden");
  $("bar").classList.remove("hidden");
});

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("msg");
  msg.textContent = "";
  const nombre = $("nombre").value.trim();
  const email = $("email").value.trim();
  if (!nombre || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = "Revisá tu nombre y tu mail."; return; }
  if (!$("ok").checked) { msg.textContent = "Tenés que aceptar los términos para continuar."; return; }
  $("pagar").disabled = true;
  $("pagar").textContent = "Abriendo Mercado Pago…";
  try {
    const { url } = await fn("create-checkout", { method: "POST", body: { informes: [...elegidos.keys()], nombre, email } });
    location.href = url;
  } catch (err) {
    msg.textContent = err.message;
    $("pagar").disabled = false;
    $("pagar").textContent = "Pagar con Mercado Pago";
  }
});

init();

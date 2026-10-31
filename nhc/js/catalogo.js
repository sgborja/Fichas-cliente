const DEMO = {
  config: { precio: 49000, moneda: "ARS" },
  informes: [
    { id: "1", icono: "🌱", nombre: "Bereshit", descripcion: "Tu identidad, tus vínculos, tu propósito y la etapa vital que atravesás. Un recorrido para entender quién sos, de dónde venís y hacia dónde querés ir." },
    { id: "2", icono: "🧭", nombre: "Talento y Puesto", descripcion: "Tus fortalezas, capacidades y motivaciones, y cómo decidís y trabajás en equipo. Una guía para orientar tu desarrollo profesional." },
    { id: "3", icono: "🤝", nombre: "Jacinta", descripcion: "Cómo te vinculás con los demás y cómo influís en ellos: emociones, motivaciones, armonía y liderazgo, en doce dimensiones." },
    { id: "4", icono: "🌳", nombre: "Árbol de la Vida", descripcion: "Una lectura desde la Cábala y las Sefirot: patrones simbólicos de tu identidad y prácticas para profundizar tu dimensión espiritual." },
  ],
};
let informes = [];
let modo = "compra"; // "compra" | "gift"

const $ = (id) => document.getElementById(id);

async function init() {
  try {
    const demo = SUPABASE_URL.includes("TU-PROYECTO"); // vista previa sin backend
    const [lista, cfg] = demo ? [DEMO.informes, [DEMO.config]] : await Promise.all([
      rest("informes?activo=eq.true&order=orden.asc&select=id,nombre,descripcion,icono"),
      rest("config?id=eq.1&select=precio,moneda"),
    ]);
    informes = lista;
    const c = cfg[0];
    $("precio").textContent = c && Number(c.precio) > 0 ? money(c.precio, c.moneda) : "";
    lista.forEach((inf) => {
      $("grid").append(
        el("article", { class: "card static" },
          el("span", { class: "ico", "aria-hidden": "true" }, inf.icono || "✨"),
          el("h3", {}, inf.nombre),
          el("p", {}, inf.descripcion)),
      );
    });
  } catch (e) {
    $("catMsg").textContent = e.message;
  }
}

function abrir(m) {
  modo = m;
  const gift = m === "gift";
  $("giftCampos").classList.toggle("hidden", !gift);
  if ($("giftImg")) $("giftImg").classList.toggle("hidden", !gift);
  $("formTitulo").textContent = gift ? "Tu gift card" : "Último paso antes de pagar";
  $("formLead").textContent = gift
    ? "Después del pago, enviamos el código por mail a quien recibe el regalo y también a vos."
    : "Con estos datos te avisamos cuando se confirme el pago.";
  $("resumenTitulo").textContent = gift ? "El regalo incluye" : "Tu compra incluye";
  $("lNombre").textContent = gift ? "Tu nombre" : "Nombre";
  $("lEmail").textContent = gift ? "Tu mail" : "Mail";
  $("resumen").replaceChildren(...informes.map((i) => el("li", {}, i.nombre)));
  $("catalogo").classList.add("hidden");
  $("checkout").classList.remove("hidden");
  scrollTo({ top: 0, behavior: "smooth" });
}

$("comprar").addEventListener("click", () => abrir("compra"));
$("regalar").addEventListener("click", () => abrir("gift"));

$("volver").addEventListener("click", () => {
  $("checkout").classList.add("hidden");
  $("catalogo").classList.remove("hidden");
});

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("msg");
  msg.textContent = "";
  const mailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const nombre = $("nombre").value.trim();
  const email = $("email").value.trim();
  if (!nombre || !mailOk(email)) { msg.textContent = "Revisá tu nombre y tu mail."; return; }
  const body = { nombre, email };
  if (modo === "gift") {
    const destEmail = $("destEmail").value.trim();
    if (!mailOk(destEmail)) { msg.textContent = "Revisá el mail de quien recibe el regalo."; return; }
    Object.assign(body, {
      tipo: "gift",
      destinatario_email: destEmail,
      destinatario_nombre: $("destNombre").value.trim(),
      mensaje: $("mensaje").value.trim(),
    });
  }
  if (!$("ok").checked) { msg.textContent = "Tenés que aceptar los términos para continuar."; return; }
  $("pagar").disabled = true;
  $("pagar").textContent = "Abriendo Mercado Pago…";
  try {
    const { url } = await fn("create-checkout", { method: "POST", body });
    location.href = url;
  } catch (err) {
    msg.textContent = err.message;
    $("pagar").disabled = false;
    $("pagar").textContent = "Pagar con Mercado Pago";
  }
});

init();

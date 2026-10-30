const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.NHC;
const H = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };

async function rest(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error("No se pudo cargar la información.");
  return r.json();
}

async function fn(name, { method = "GET", query = "", body } = {}) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}${query}`, {
    method,
    headers: { ...H, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || "Algo salió mal."), { status: r.status });
  return data;
}

const money = (n, cur) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: cur || "ARS", maximumFractionDigits: 0 }).format(n);

// Crea nodos sin innerHTML para que el texto cargado desde el panel nunca se interprete como HTML
function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  n.append(...kids);
  return n;
}

function logo() {
  const img = el("img", { class: "logo", src: "assets/imagotipo.png", alt: "NeoHumanCode" });
  img.onerror = () => img.replaceWith(el("span", { class: "logo-text" }, "NeoHuman", el("b", {}, "Code")));
  return img;
}
document.querySelectorAll("[data-logo]").forEach((n) => n.append(logo()));

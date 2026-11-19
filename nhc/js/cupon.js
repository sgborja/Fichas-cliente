// Cupón de gift card personalizado: la imagen de la gift card + una franja con el nombre, el código y el vencimiento.
// Se dibuja en el navegador, sin enviar nada a ningún servidor.
async function cuponPNG({ nombre, codigo, vence }) {
  await Promise.all([
    document.fonts.load('700 64px "Playfair Display"'),
    document.fonts.load('600 52px "Outfit"'),
    document.fonts.load('400 28px "Outfit"'),
  ]).catch(() => {});
  const img = await new Promise((ok, no) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => no(new Error("No se pudo cargar la imagen de la gift card."));
    i.src = "assets/giftcard.jpg";
  });
  const W = img.naturalWidth, H = img.naturalHeight, PIE = 400;
  const c = document.createElement("canvas");
  c.width = W; c.height = H + PIE;
  const x = c.getContext("2d");

  const fondo = x.createLinearGradient(0, H, 0, H + PIE);
  fondo.addColorStop(0, "#FDEBD8"); fondo.addColorStop(1, "#FBE3CD");
  x.fillStyle = fondo; x.fillRect(0, H, W, PIE);
  x.drawImage(img, 0, 0);

  x.textAlign = "center"; x.textBaseline = "alphabetic";
  const cx = W / 2;

  x.fillStyle = "#8A6F5C"; x.font = '400 28px "Outfit", Arial, sans-serif'; x.letterSpacing = "1.5px";
  x.fillText("UN REGALO PARA", cx, H + 72);

  x.fillStyle = "#442418"; x.font = '700 64px "Playfair Display", Georgia, serif'; x.letterSpacing = "0px";
  let n = nombre, tam = 64;
  while (x.measureText(n).width > W - 160 && tam > 30) { tam -= 4; x.font = `700 ${tam}px "Playfair Display", Georgia, serif`; }
  x.fillText(n, cx, H + 150);

  const bw = 660, bh = 100, bx = cx - bw / 2, by = H + 188;
  x.beginPath(); x.roundRect(bx, by, bw, bh, 18);
  x.fillStyle = "#FFFFFF"; x.fill();
  x.setLineDash([9, 7]); x.lineWidth = 2.5; x.strokeStyle = "#F97815"; x.stroke(); x.setLineDash([]);
  x.fillStyle = "#442418"; x.font = '600 52px "Outfit", Arial, sans-serif'; x.letterSpacing = "7px";
  x.fillText(codigo, cx + 3, by + 67);

  x.fillStyle = "#8A6F5C"; x.font = '400 24px "Outfit", Arial, sans-serif'; x.letterSpacing = "0px";
  x.fillText(`Canjealo hasta el ${vence}`, cx, H + 346);

  return new Promise((ok) => c.toBlob(ok, "image/png"));
}

const venceDe = (pagadoEn) => {
  const v = new Date(pagadoEn);
  v.setFullYear(v.getFullYear() + 1);
  return v.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });
};

async function descargarCupon(g) {
  const blob = await cuponPNG({ nombre: g.destinatario_nombre || "vos", codigo: g.codigo, vence: venceDe(g.pagado_en) });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `GiftCard_${(g.destinatario_nombre || g.codigo).replace(/[^\w\-]+/g, "_")}.png`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// Enlace de canje con el código, el nombre y el mail ya cargados
const enlaceCanje = (g) =>
  `${location.origin}/canjear.html?c=${encodeURIComponent(g.codigo)}` +
  (g.destinatario_nombre ? `&n=${encodeURIComponent(g.destinatario_nombre)}` : "") +
  `&e=${encodeURIComponent(g.destinatario_email)}`;

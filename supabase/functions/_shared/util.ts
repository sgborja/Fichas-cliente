import { createClient } from "npm:@supabase/supabase-js@2";

export const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

export const SITE_URL = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export function preflight(req: Request) {
  return req.method === "OPTIONS" ? new Response("ok", { headers: cors }) : null;
}

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );

// Mail con el estilo NHC (tema naranja): cabecera con logo, un solo botón principal
export function emailLayout(titulo: string, cuerpoHtml: string, boton?: { texto: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#FFF8F0;font-family:Outfit,Arial,sans-serif;color:#442418">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
  <div style="text-align:center;padding-bottom:20px">
    <img src="${SITE_URL}/assets/imagotipo.png" alt="NeoHumanCode" width="200" style="max-width:200px;height:auto">
  </div>
  <div style="background:#fff;border:1px solid #EDE0D4;border-radius:16px;padding:28px">
    <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:26px;margin:0 0 14px">${esc(titulo)}</h1>
    <div style="font-size:16px;line-height:1.5">${cuerpoHtml}</div>
    ${boton ? `<p style="text-align:center;margin:28px 0 6px"><a href="${boton.url}" style="background:#F97815;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:500;display:inline-block">${esc(boton.texto)}</a></p>` : ""}
  </div>
  <p style="font-size:12px;color:#8A6F5C;text-align:center;margin-top:18px">NeoHumanCode</p>
</div></body></html>`;
}

export async function sendMail(to: string, subject: string, html: string, replyTo?: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: Deno.env.get("MAIL_FROM"),
      to,
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

// Códigos de gift card: NHC-XXXX-XXXX, sin caracteres ambiguos (0/O, 1/I)
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 símbolos
export function generarCodigo() {
  const s = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => ALFABETO[b % 32]).join("");
  return `NHC-${s.slice(0, 4)}-${s.slice(4)}`;
}
export function normalizarCodigo(c: unknown) {
  let s = String(c ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.startsWith("NHC")) s = s.slice(3);
  return s.length === 8 ? `NHC-${s.slice(0, 4)}-${s.slice(4)}` : "";
}

export const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

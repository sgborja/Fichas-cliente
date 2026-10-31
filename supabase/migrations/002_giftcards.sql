-- Gift cards: una persona paga y regala los informes; quien recibe canjea el código en el sitio.

create table public.giftcards (
  id                 uuid primary key default gen_random_uuid(),
  token              uuid not null unique default gen_random_uuid(), -- para la página "gracias" del comprador
  codigo             text unique,                                     -- se genera al confirmarse el pago
  comprador_nombre   text not null,
  comprador_email    text not null,
  destinatario_nombre text,
  destinatario_email text not null,
  mensaje            text,
  monto              numeric(12,2) not null,
  moneda             text not null,
  estado             text not null default 'pendiente' check (estado in ('pendiente','pagada','canjeada')),
  mp_payment_id      text,
  creado             timestamptz not null default now(),
  pagado_en          timestamptz,
  canjeado_en        timestamptz
);

alter table public.giftcards enable row level security;
-- sin políticas: solo accesible con la service role (funciones)
grant all on public.giftcards to service_role;

alter table public.pedidos add column giftcard_id uuid references public.giftcards(id);

-- Precio fijo: pagás 3, recibís los 4 informes
update public.config set precio = 49000, moneda = 'ARS' where id = 1;

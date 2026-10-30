-- NeoHumanCode · informes: esquema inicial

create table public.informes (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  descripcion text not null default '',
  icono       text not null default '✨',
  activo      boolean not null default true,
  orden       int not null default 0
);

-- Fila única con el precio fijo por los 3 informes
create table public.config (
  id     int primary key default 1 check (id = 1),
  precio numeric(12,2) not null default 0,
  moneda text not null default 'ARS'
);

create table public.admins (email text primary key);

create table public.pedidos (
  id           uuid primary key default gen_random_uuid(),
  token        uuid not null unique default gen_random_uuid(),
  nombre       text not null,
  email        text not null,
  informes     jsonb not null,
  monto        numeric(12,2) not null,
  moneda       text not null,
  estado       text not null default 'pendiente' check (estado in ('pendiente','pagado')),
  mp_payment_id text,
  creado       timestamptz not null default now(),
  pagado_en    timestamptz
);

create table public.datos_nacimiento (
  pedido_id        uuid primary key references public.pedidos(id) on delete cascade,
  fecha_nacimiento date not null,
  hora_nacimiento  text not null,
  lugar_nacimiento text not null,
  email            text not null,
  telefono         text,
  creado           timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.admins where email = auth.jwt() ->> 'email');
$$;

alter table public.informes enable row level security;
alter table public.config enable row level security;
alter table public.admins enable row level security;
alter table public.pedidos enable row level security;
alter table public.datos_nacimiento enable row level security;

-- Público: puede leer informes activos y el precio
create policy informes_lectura on public.informes for select using (activo or public.is_admin());
create policy informes_admin on public.informes for all using (public.is_admin()) with check (public.is_admin());
create policy config_lectura on public.config for select using (true);
create policy config_admin on public.config for update using (public.is_admin()) with check (public.is_admin());
-- pedidos, datos_nacimiento y admins: sin políticas = solo accesibles con la service role (funciones)

insert into public.config (id, precio, moneda) values (1, 0, 'ARS');

-- Informes de ejemplo: se editan desde /admin.html
insert into public.informes (nombre, descripcion, icono, orden) values
  ('Informe 1', 'Descripción del informe 1.', '🔢', 1),
  ('Informe 2', 'Descripción del informe 2.', '🌞', 2),
  ('Informe 3', 'Descripción del informe 3.', '🌙', 3),
  ('Informe 4', 'Descripción del informe 4.', '🌳', 4);

-- Después de crear tu usuario admin en Supabase Auth, ejecutá:
-- insert into public.admins (email) values ('tu@mail.com');

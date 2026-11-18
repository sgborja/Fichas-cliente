-- Gift cards de cortesía: las emite la administración, sin pago. Se distinguen por comprador_nombre = 'NeoHumanCode' y monto 0.
-- enviado_en: cuándo salió el mail con el código (permite reintentar solo los que fallaron).
alter table public.giftcards add column if not exists enviado_en timestamptz;

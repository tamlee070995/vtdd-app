create table if not exists public.checkin_customers (
  id bigserial primary key,
  stt integer,
  sdt text,
  ten_kh text,
  ma_so text,
  checked_in boolean not null default false,
  checkin_time text,
  checkin_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists checkin_customers_sdt_idx on public.checkin_customers (sdt);
create index if not exists checkin_customers_ma_so_idx on public.checkin_customers (ma_so);
create index if not exists checkin_customers_checked_in_idx on public.checkin_customers (checked_in, checkin_at);

notify pgrst, 'reload schema';

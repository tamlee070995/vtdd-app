-- VTDD restore compatibility migration.
-- Run this after restoring an older Supabase backup.
-- It is additive only: no DROP/TRUNCATE, safe to run multiple times.

create table if not exists public.staff (
  ma_nv text primary key
);

alter table public.staff add column if not exists staff_name text;
alter table public.staff add column if not exists ma_st text;
alter table public.staff add column if not exists store_name text;
alter table public.staff add column if not exists department text;
alter table public.staff add column if not exists password_hash text;
alter table public.staff add column if not exists security_question text;
alter table public.staff add column if not exists security_answer text;
alter table public.staff add column if not exists gmail text;
alter table public.staff add column if not exists status text;
alter table public.staff add column if not exists reset_otp_hash text;
alter table public.staff add column if not exists reset_otp_expires text;
alter table public.staff add column if not exists reset_otp_day text;
alter table public.staff add column if not exists reset_otp_count text;
alter table public.staff add column if not exists need_setup text;
alter table public.staff add column if not exists permission text;
alter table public.staff add column if not exists module_permissions text;
alter table public.staff add column if not exists source_row text;
alter table public.staff add column if not exists imported_at timestamptz not null default now();

create table if not exists public.stores (
  ma_st text primary key
);

alter table public.stores add column if not exists store_name text;
alter table public.stores add column if not exists departments text;
alter table public.stores add column if not exists staff_count text;
alter table public.stores add column if not exists imported_at timestamptz not null default now();

create table if not exists public.products_new (
  id bigserial primary key
);

alter table public.products_new add column if not exists brand text;
alter table public.products_new add column if not exists product_name text;
alter table public.products_new add column if not exists subsidy_ratio text;
alter table public.products_new add column if not exists subsidy_ratio_apple text;
alter table public.products_new add column if not exists subsidy_amount text;
alter table public.products_new add column if not exists category text;
alter table public.products_new add column if not exists min_subsidy_amount text;
alter table public.products_new add column if not exists min_subsidy_amount_apple text;
alter table public.products_new add column if not exists source_row text;
alter table public.products_new add column if not exists imported_at timestamptz not null default now();

create table if not exists public.products_old (
  id bigserial primary key
);

alter table public.products_old add column if not exists source_sheet text;
alter table public.products_old add column if not exists brand text;
alter table public.products_old add column if not exists product_name text;
alter table public.products_old add column if not exists storage text;
alter table public.products_old add column if not exists price_type_1 text;
alter table public.products_old add column if not exists price_type_2 text;
alter table public.products_old add column if not exists price_type_3 text;
alter table public.products_old add column if not exists price_type_4 text;
alter table public.products_old add column if not exists price_type_5 text;
alter table public.products_old add column if not exists price_type_5_plus text;
alter table public.products_old add column if not exists category text;
alter table public.products_old add column if not exists mwg_type_1 text;
alter table public.products_old add column if not exists mwg_type_2 text;
alter table public.products_old add column if not exists source_row text;
alter table public.products_old add column if not exists imported_at timestamptz not null default now();

create table if not exists public.pmh_codes (
  pincode text primary key
);

alter table public.pmh_codes add column if not exists status text;
alter table public.pmh_codes add column if not exists menh_gia text;
alter table public.pmh_codes add column if not exists request_id text;
alter table public.pmh_codes add column if not exists used_at text;
alter table public.pmh_codes add column if not exists used_by text;
alter table public.pmh_codes add column if not exists source_row text;
alter table public.pmh_codes add column if not exists imported_at timestamptz not null default now();

create table if not exists public.pincode_requests (
  request_id text primary key
);

alter table public.pincode_requests add column if not exists created_at_text text;
alter table public.pincode_requests add column if not exists ma_st text;
alter table public.pincode_requests add column if not exists ma_nv text;
alter table public.pincode_requests add column if not exists imei text;
alter table public.pincode_requests add column if not exists image_link_1 text;
alter table public.pincode_requests add column if not exists image_link_2 text;
alter table public.pincode_requests add column if not exists image_link_3 text;
alter table public.pincode_requests add column if not exists image_link_4 text;
alter table public.pincode_requests add column if not exists image_link_5 text;
alter table public.pincode_requests add column if not exists image_link_6 text;
alter table public.pincode_requests add column if not exists status text;
alter table public.pincode_requests add column if not exists pincode text;
alter table public.pincode_requests add column if not exists reject_reason text;
alter table public.pincode_requests add column if not exists admin_reviewer text;
alter table public.pincode_requests add column if not exists completion_status text;
alter table public.pincode_requests add column if not exists menh_gia text;
alter table public.pincode_requests add column if not exists old_model text;
alter table public.pincode_requests add column if not exists new_model text;
alter table public.pincode_requests add column if not exists support_type text;
alter table public.pincode_requests add column if not exists source_row text;
alter table public.pincode_requests add column if not exists imported_at timestamptz not null default now();

create table if not exists public.system_settings (
  key text primary key
);

alter table public.system_settings add column if not exists value text;
alter table public.system_settings add column if not exists type text;
alter table public.system_settings add column if not exists updated_at_text text;
alter table public.system_settings add column if not exists updated_by text;
alter table public.system_settings add column if not exists imported_at timestamptz not null default now();

create table if not exists public.admin_audit (
  id bigserial primary key
);

alter table public.admin_audit add column if not exists time_text text;
alter table public.admin_audit add column if not exists admin text;
alter table public.admin_audit add column if not exists action text;
alter table public.admin_audit add column if not exists target text;
alter table public.admin_audit add column if not exists old_value text;
alter table public.admin_audit add column if not exists new_value text;
alter table public.admin_audit add column if not exists ip text;
alter table public.admin_audit add column if not exists note text;
alter table public.admin_audit add column if not exists source_row text;
alter table public.admin_audit add column if not exists imported_at timestamptz not null default now();

create table if not exists public.quote_logs (
  id bigserial primary key
);

alter table public.quote_logs add column if not exists time_text text;
alter table public.quote_logs add column if not exists action text;
alter table public.quote_logs add column if not exists ma_nv text;
alter table public.quote_logs add column if not exists ma_st text;
alter table public.quote_logs add column if not exists staff_name text;
alter table public.quote_logs add column if not exists flow text;
alter table public.quote_logs add column if not exists product_new text;
alter table public.quote_logs add column if not exists product_old text;
alter table public.quote_logs add column if not exists storage text;
alter table public.quote_logs add column if not exists device_type text;
alter table public.quote_logs add column if not exists old_price text;
alter table public.quote_logs add column if not exists subsidy_brand text;
alter table public.quote_logs add column if not exists subsidy_mwg text;
alter table public.quote_logs add column if not exists customer_total text;
alter table public.quote_logs add column if not exists customer_need_pay text;
alter table public.quote_logs add column if not exists ip text;
alter table public.quote_logs add column if not exists user_agent text;
alter table public.quote_logs add column if not exists source_row text;
alter table public.quote_logs add column if not exists imported_at timestamptz not null default now();

create table if not exists public.checkin_customers (
  id bigserial primary key
);

alter table public.checkin_customers add column if not exists stt integer;
alter table public.checkin_customers add column if not exists sdt text;
alter table public.checkin_customers add column if not exists ten_kh text;
alter table public.checkin_customers add column if not exists ma_so text;
alter table public.checkin_customers add column if not exists checked_in boolean not null default false;
alter table public.checkin_customers add column if not exists checkin_time text;
alter table public.checkin_customers add column if not exists checkin_at timestamptz;
alter table public.checkin_customers add column if not exists created_at timestamptz not null default now();
alter table public.checkin_customers add column if not exists updated_at timestamptz not null default now();

create index if not exists staff_ma_st_idx on public.staff(ma_st);
create index if not exists staff_status_idx on public.staff(status);
create index if not exists products_new_category_idx on public.products_new(category);
create index if not exists products_old_name_idx on public.products_old(product_name);
create index if not exists products_old_category_idx on public.products_old(category);
create index if not exists pmh_codes_status_idx on public.pmh_codes(status);
create index if not exists pmh_codes_menh_gia_idx on public.pmh_codes(menh_gia);
create index if not exists pincode_requests_staff_idx on public.pincode_requests(ma_st, ma_nv);
create index if not exists pincode_requests_status_idx on public.pincode_requests(status);
create index if not exists quote_logs_staff_idx on public.quote_logs(ma_nv);
create index if not exists quote_logs_store_idx on public.quote_logs(ma_st);
create index if not exists checkin_customers_sdt_idx on public.checkin_customers(sdt);
create index if not exists checkin_customers_ma_so_idx on public.checkin_customers(ma_so);
create index if not exists checkin_customers_checked_in_idx on public.checkin_customers(checked_in, checkin_at);

do $$
declare
  seq_name text;
begin
  select pg_get_serial_sequence('public.products_new', 'id') into seq_name;
  if seq_name is not null then
    execute format('select setval(%L, coalesce((select max(id) from public.products_new), 1), (select max(id) is not null from public.products_new))', seq_name);
  end if;

  select pg_get_serial_sequence('public.products_old', 'id') into seq_name;
  if seq_name is not null then
    execute format('select setval(%L, coalesce((select max(id) from public.products_old), 1), (select max(id) is not null from public.products_old))', seq_name);
  end if;

  select pg_get_serial_sequence('public.admin_audit', 'id') into seq_name;
  if seq_name is not null then
    execute format('select setval(%L, coalesce((select max(id) from public.admin_audit), 1), (select max(id) is not null from public.admin_audit))', seq_name);
  end if;

  select pg_get_serial_sequence('public.quote_logs', 'id') into seq_name;
  if seq_name is not null then
    execute format('select setval(%L, coalesce((select max(id) from public.quote_logs), 1), (select max(id) is not null from public.quote_logs))', seq_name);
  end if;

  select pg_get_serial_sequence('public.checkin_customers', 'id') into seq_name;
  if seq_name is not null then
    execute format('select setval(%L, coalesce((select max(id) from public.checkin_customers), 1), (select max(id) is not null from public.checkin_customers))', seq_name);
  end if;
end $$;

notify pgrst, 'reload schema';

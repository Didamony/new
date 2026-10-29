-- Zakerly accounts, free trial, lifetime purchase and owner-controlled pricing.

-- Global settings the owner edits from the in-app owner page (single row).
create table public.app_settings (
  id int primary key default 1 check (id = 1),
  price_egp int not null default 100 check (price_egp >= 0),
  trial_days int not null default 3 check (trial_days >= 0),
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (1);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  trial_ends_at timestamptz not null,
  is_lifetime boolean not null default false,
  paid_at timestamptz,
  is_admin boolean not null default false
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_egp int not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'manual')),
  paymob_order_id text,
  paymob_transaction_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index payments_user_idx on public.payments (user_id);
create index payments_order_idx on public.payments (paymob_order_id);

-- Every new sign-up gets a profile with the trial length that is current at sign-up time.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email, trial_ends_at)
  values (new.id, new.email, now() + make_interval(days => (select trial_days from public.app_settings where id = 1)));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where user_id = auth.uid()), false);
$$;

-- Owner actions --------------------------------------------------------------

-- Unlock (or revoke) lifetime access by hand, e.g. after a cash/InstaPay payment.
create function public.admin_set_lifetime(target uuid, value boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  update public.profiles set is_lifetime = value, paid_at = case when value then coalesce(paid_at, now()) else null end
  where user_id = target;
  if value then
    insert into public.payments (user_id, amount_egp, status, paid_at)
    values (target, (select price_egp from public.app_settings where id = 1), 'manual', now());
  end if;
end;
$$;

create function public.admin_stats() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return json_build_object(
    'users', (select count(*) from public.profiles),
    'in_trial', (select count(*) from public.profiles where not is_lifetime and trial_ends_at > now()),
    'paid', (select count(*) from public.profiles where is_lifetime),
    'revenue_egp', (select coalesce(sum(amount_egp), 0) from public.payments where status in ('paid', 'manual'))
  );
end;
$$;

-- Row level security ---------------------------------------------------------

alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.payments enable row level security;

create policy "settings readable by everyone" on public.app_settings for select using (true);
create policy "settings editable by owner" on public.app_settings for update using (public.is_admin()) with check (public.is_admin());

-- Students can read their own profile but never change it (no self-unlock).
create policy "own profile" on public.profiles for select using (user_id = auth.uid() or public.is_admin());

create policy "own payments" on public.payments for select using (user_id = auth.uid() or public.is_admin());
-- Payments are written only by the edge functions (service role bypasses RLS).

-- Everything the app needs to decide access, using the server clock
-- (so changing the device date can't extend the trial).
create function public.my_access() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'now', now(),
    'trial_ends_at', p.trial_ends_at,
    'is_lifetime', p.is_lifetime,
    'is_admin', p.is_admin,
    'price_egp', s.price_egp,
    'trial_days', s.trial_days
  )
  from public.profiles p, public.app_settings s
  where p.user_id = auth.uid() and s.id = 1;
$$;

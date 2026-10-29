-- Zakerly accounts, free trial, monthly subscription, owner-controlled pricing
-- and the built-in free AI (Gemini on the owner's key) with a daily limit per student.

-- Global settings the owner edits from the in-app owner page (single row).
create table public.app_settings (
  id int primary key default 1 check (id = 1),
  price_egp int not null default 20 check (price_egp >= 0),
  trial_days int not null default 3 check (trial_days >= 0),
  period_days int not null default 30 check (period_days > 0),
  -- built-in free AI: requests per student per day (Cairo time), and the Gemini
  -- model to use ('' = pick the best available "flash" model automatically)
  free_daily_limit int not null default 25 check (free_daily_limit >= 0),
  free_model text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (1);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  trial_ends_at timestamptz not null,
  paid_until timestamptz,
  is_admin boolean not null default false
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_egp int not null,
  period_days int not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'manual')),
  paymob_order_id text,
  paymob_transaction_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
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

-- Adds `days` to the subscription. Paying early stacks on top of the remaining
-- paid time or free trial, so the student never loses days they already had.
create function public.extend_subscription(target uuid, days int) returns timestamptz
language sql security definer set search_path = public as $$
  update public.profiles
  set paid_until = greatest(coalesce(paid_until, now()), trial_ends_at, now()) + make_interval(days => days)
  where user_id = target
  returning paid_until;
$$;
-- Only the payment webhook (service role) may call it directly.
revoke execute on function public.extend_subscription(uuid, int) from public, anon, authenticated;

-- Built-in free AI quota --------------------------------------------------------

create function public.cairo_today() returns date
language sql stable as $$ select (now() at time zone 'Africa/Cairo')::date $$;

-- Uses one request from today's allowance. Returns what is left, or -1 when the
-- allowance is used up (the counter never goes past the limit).
create function public.consume_ai_quota(target uuid) returns int
language plpgsql security definer set search_path = public as $$
declare lim int; used int;
begin
  select free_daily_limit into lim from public.app_settings where id = 1;
  if lim <= 0 then return -1; end if;
  insert into public.ai_usage as u (user_id, day, count) values (target, public.cairo_today(), 1)
  on conflict (user_id, day) do update set count = u.count + 1 where u.count < lim
  returning count into used;
  if used is null then return -1; end if;
  return lim - used;
end;
$$;

-- Gives a request back when the AI call itself failed.
create function public.refund_ai_quota(target uuid) returns void
language sql security definer set search_path = public as $$
  update public.ai_usage set count = greatest(count - 1, 0) where user_id = target and day = public.cairo_today();
$$;

-- Only the ai-proxy function (service role) may spend or refund quota.
revoke execute on function public.consume_ai_quota(uuid) from public, anon, authenticated;
revoke execute on function public.refund_ai_quota(uuid) from public, anon, authenticated;

-- Owner actions --------------------------------------------------------------

-- Add one period by hand, e.g. after a cash/InstaPay payment.
create function public.admin_grant_period(target uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s public.app_settings;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select * into s from public.app_settings where id = 1;
  perform public.extend_subscription(target, s.period_days);
  insert into public.payments (user_id, amount_egp, period_days, status, paid_at)
  values (target, s.price_egp, s.period_days, 'manual', now());
end;
$$;

create function public.admin_cancel_subscription(target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  update public.profiles set paid_until = null where user_id = target;
end;
$$;

create function public.admin_stats() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return json_build_object(
    'users', (select count(*) from public.profiles),
    'in_trial', (select count(*) from public.profiles where coalesce(paid_until, '-infinity') <= now() and trial_ends_at > now()),
    'active', (select count(*) from public.profiles where paid_until > now()),
    'revenue_month_egp', (select coalesce(sum(amount_egp), 0) from public.payments
                          where status in ('paid', 'manual') and paid_at >= date_trunc('month', now())),
    'revenue_egp', (select coalesce(sum(amount_egp), 0) from public.payments where status in ('paid', 'manual')),
    'ai_requests_today', (select coalesce(sum(count), 0) from public.ai_usage where day = public.cairo_today()),
    'ai_users_today', (select count(*) from public.ai_usage where day = public.cairo_today() and count > 0)
  );
end;
$$;

-- Everything the app needs to decide access, using the server clock
-- (so changing the device date can't extend the trial or the subscription).
create function public.my_access() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'now', now(),
    'trial_ends_at', p.trial_ends_at,
    'paid_until', p.paid_until,
    'is_admin', p.is_admin,
    'price_egp', s.price_egp,
    'trial_days', s.trial_days,
    'period_days', s.period_days,
    'free_daily_limit', s.free_daily_limit,
    'free_used_today', coalesce((select count from public.ai_usage where user_id = p.user_id and day = public.cairo_today()), 0)
  )
  from public.profiles p, public.app_settings s
  where p.user_id = auth.uid() and s.id = 1;
$$;

-- Row level security ---------------------------------------------------------

alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.payments enable row level security;
alter table public.ai_usage enable row level security;

create policy "settings readable by everyone" on public.app_settings for select using (true);
create policy "settings editable by owner" on public.app_settings for update using (public.is_admin()) with check (public.is_admin());

-- Students can read their own profile but never change it (no self-unlock).
create policy "own profile" on public.profiles for select using (user_id = auth.uid() or public.is_admin());

create policy "own ai usage" on public.ai_usage for select using (user_id = auth.uid() or public.is_admin());

create policy "own payments" on public.payments for select using (user_id = auth.uid() or public.is_admin());
-- Payments are written only by the edge functions (service role bypasses RLS).

import { createClient, type Session } from "@supabase/supabase-js";
import { useEffect, useSyncExternalStore } from "react";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Without a Supabase project configured the app runs fully free (handy for local development). */
export const billingEnabled = !!url && !!anonKey;

export const supabase = billingEnabled ? createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

export interface Access {
  now: string;
  trial_ends_at: string;
  paid_until: string | null;
  is_admin: boolean;
  price_egp: number;
  trial_days: number;
  period_days: number;
  free_daily_limit: number;
  free_used_today: number;
}

export type Status =
  | { kind: "loading" }
  | { kind: "free" } // billing not configured
  | { kind: "anon" }
  | { kind: "trial"; daysLeft: number; hoursLeft: number }
  | { kind: "active"; daysLeft: number; until: number }
  | { kind: "expired"; wasSubscribed: boolean }
  | { kind: "admin" }
  | { kind: "error" };

interface State {
  session: Session | null;
  access: Access | null;
  status: Status;
}

const CACHE_KEY = "zakerly.access";
let state: State = { session: null, access: null, status: billingEnabled ? { kind: "loading" } : { kind: "free" } };
const subs = new Set<() => void>();

function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
}

function statusFrom(access: Access, skewMs: number): Status {
  if (access.is_admin) return { kind: "admin" };
  // server time now ≈ local time + skew measured when the access was fetched
  const now = Date.now() + skewMs;
  const until = access.paid_until ? new Date(access.paid_until).getTime() : 0;
  if (until > now) return { kind: "active", daysLeft: Math.ceil((until - now) / 86400000), until };
  const left = new Date(access.trial_ends_at).getTime() - now;
  if (left <= 0) return { kind: "expired", wasSubscribed: until > 0 };
  return { kind: "trial", daysLeft: Math.ceil(left / 86400000), hoursLeft: Math.ceil(left / 3600000) };
}

let skew = 0;
let retries = 0;

export async function refreshAccess() {
  if (!supabase) return;
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) {
    setState({ session: null, access: null, status: { kind: "anon" } });
    return;
  }
  const { data, error } = await supabase.rpc("my_access");
  if (error || !data) {
    // offline: fall back to the last known access so paid users keep working
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as { access: Access; skew: number } | null;
      if (cached) return setState({ session: sess.session, access: cached.access, status: statusFrom(cached.access, cached.skew) });
    } catch {
      /* storage unavailable */
    }
    // profile row may not exist yet right after sign-up: retry a few times
    if (retries++ < 4) {
      setState({ session: sess.session, status: { kind: "loading" } });
      setTimeout(refreshAccess, 1500);
    } else {
      retries = 0;
      setState({ session: sess.session, status: { kind: "error" } });
    }
    return;
  }
  retries = 0;
  const access = data as Access;
  skew = new Date(access.now).getTime() - Date.now();
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ access, skew }));
  } catch {
    /* storage unavailable */
  }
  setState({ session: sess.session, access, status: statusFrom(access, skew) });
}

if (supabase) {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      try {
        localStorage.removeItem(CACHE_KEY);
      } catch {
        /* storage unavailable */
      }
      setState({ session: null, access: null, status: { kind: "anon" } });
    } else if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
      refreshAccess();
    }
  });
  // re-check when the student comes back to the app (e.g. after paying)
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && refreshAccess());
  // the trial can run out while the app is open
  setInterval(() => state.access && setState({ status: statusFrom(state.access, skew) }), 60_000);
}

export function useAccount() {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => state,
  );
}

/** Re-fetch on mount (used by the post-payment page). */
export function useRefreshOnMount() {
  useEffect(() => {
    refreshAccess();
  }, []);
}

/* ---------------- auth (email + 6-digit code, no passwords to forget) ---------------- */

export async function sendCode(email: string) {
  const { error } = await supabase!.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyCode(email: string, token: string) {
  const { error } = await supabase!.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw error;
  await refreshAccess();
}

export async function signOut() {
  await supabase?.auth.signOut();
}

/* ---------------- payment ---------------- */

const BEFORE_KEY = "zakerly.paidUntilBefore";

/** The plan's end date when checkout started, so the return page can tell when the payment landed. */
export function paidUntilBeforeCheckout() {
  try {
    return localStorage.getItem(BEFORE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function startCheckout() {
  try {
    localStorage.setItem(BEFORE_KEY, state.access?.paid_until ?? "");
  } catch {
    /* storage unavailable */
  }
  const { data, error } = await supabase!.functions.invoke<{ url?: string }>("create-payment", { body: {} });
  if (error) throw error;
  if (data?.url) location.href = data.url;
  else throw new Error("checkout");
}

/* ---------------- owner ---------------- */

export interface AdminStats {
  users: number;
  in_trial: number;
  active: number;
  revenue_month_egp: number;
  revenue_egp: number;
  ai_requests_today: number;
  ai_users_today: number;
}

export interface UserRow {
  user_id: string;
  email: string | null;
  created_at: string;
  trial_ends_at: string;
  paid_until: string | null;
  is_admin: boolean;
}

export async function adminStats() {
  const { data, error } = await supabase!.rpc("admin_stats");
  if (error) throw error;
  return data as AdminStats;
}

export async function adminUsers(search: string) {
  let q = supabase!.from("profiles").select("user_id,email,created_at,trial_ends_at,paid_until,is_admin").order("created_at", { ascending: false }).limit(100);
  if (search.trim()) q = q.ilike("email", `%${search.trim()}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data as UserRow[];
}

/** Adds one subscription period by hand (e.g. paid in cash or by InstaPay). */
export async function adminGrantPeriod(userId: string) {
  const { error } = await supabase!.rpc("admin_grant_period", { target: userId });
  if (error) throw error;
}

export async function adminCancel(userId: string) {
  const { error } = await supabase!.rpc("admin_cancel_subscription", { target: userId });
  if (error) throw error;
}

export interface AppSettingsPatch {
  price_egp: number;
  trial_days: number;
  free_daily_limit: number;
  free_model: string;
}

export async function adminSaveSettings(patch: AppSettingsPatch) {
  const { error } = await supabase!.from("app_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) throw error;
  await refreshAccess();
}

export async function adminGetSettings() {
  const { data, error } = await supabase!.from("app_settings").select("price_egp,trial_days,free_daily_limit,free_model").eq("id", 1).single();
  if (error) throw error;
  return data as AppSettingsPatch;
}

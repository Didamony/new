// Paymob "transaction processed" callback. Verifies the HMAC, then unlocks lifetime access.
import { adminClient, env, json } from "../_shared.ts";

// Field order is fixed by Paymob's HMAC spec for transaction callbacks.
const HMAC_FIELDS = [
  "amount_cents",
  "created_at",
  "currency",
  "error_occured",
  "has_parent_transaction",
  "id",
  "integration_id",
  "is_3d_secure",
  "is_auth",
  "is_capture",
  "is_refunded",
  "is_standalone_payment",
  "is_voided",
  "order.id",
  "owner",
  "pending",
  "source_data.pan",
  "source_data.sub_type",
  "source_data.type",
  "success",
];

function pick(obj: Record<string, unknown>, path: string): string {
  const v = path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | null)?.[k], obj);
  return v == null ? "" : String(v);
}

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: true });

  const body = await req.json().catch(() => null);
  const obj = body?.obj as Record<string, unknown> | undefined;
  const received = (new URL(req.url).searchParams.get("hmac") ?? (body?.hmac as string) ?? "").toLowerCase();
  if (!obj || !received) return json({ error: "bad request" }, 400);

  const expected = await hmacHex(env("PAYMOB_HMAC_SECRET"), HMAC_FIELDS.map((f) => pick(obj, f)).join(""));
  if (!safeEqual(expected, received)) return json({ error: "bad hmac" }, 401);

  const ok =
    pick(obj, "success") === "true" &&
    pick(obj, "pending") === "false" &&
    pick(obj, "is_voided") === "false" &&
    pick(obj, "is_refunded") === "false" &&
    pick(obj, "currency") === "EGP";
  if (!ok) return json({ ok: true, ignored: true });

  const db = adminClient();
  const reference = pick(obj, "order.merchant_order_id");
  const orderId = pick(obj, "order.id");

  // Match by our own reference first, then by Paymob's order id saved at checkout.
  let { data: payment } = await db.from("payments").select("*").eq("id", reference).maybeSingle();
  if (!payment && orderId) ({ data: payment } = await db.from("payments").select("*").eq("paymob_order_id", orderId).maybeSingle());
  if (!payment) {
    console.error("payment not found", { reference, orderId });
    return json({ ok: true, ignored: true });
  }
  if (payment.status === "paid") return json({ ok: true });
  if (Number(pick(obj, "amount_cents")) < payment.amount_egp * 100) {
    console.error("amount too low", payment.id);
    return json({ ok: true, ignored: true });
  }

  const now = new Date().toISOString();
  await db
    .from("payments")
    .update({ status: "paid", paid_at: now, paymob_order_id: orderId, paymob_transaction_id: pick(obj, "id") })
    .eq("id", payment.id);
  await db.from("profiles").update({ is_lifetime: true, paid_at: now }).eq("user_id", payment.user_id);
  return json({ ok: true });
});

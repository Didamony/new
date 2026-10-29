// Starts a Paymob Unified Checkout for one subscription period and returns the checkout URL.
// The price always comes from the database, never from the client.
import { adminClient, cors, env, json, paymobBase, userFromRequest } from "../_shared.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  try {
    const user = await userFromRequest(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    const db = adminClient();
    const { data: settings, error: sErr } = await db.from("app_settings").select("price_egp,period_days").eq("id", 1).single();
    if (sErr || !settings) throw sErr ?? new Error("settings missing");
    const price: number = settings.price_egp;

    // Price and period are fixed on the payment row now, so a later price change can't affect it.
    const { data: payment, error: pErr } = await db
      .from("payments")
      .insert({ user_id: user.id, amount_egp: price, period_days: settings.period_days, status: "pending" })
      .select("id")
      .single();
    if (pErr || !payment) throw pErr ?? new Error("payment insert failed");

    const appUrl = env("APP_URL").replace(/\/+$/, "");
    const cents = price * 100;
    const email = user.email ?? "student@zakerly.app";
    const name = email.split("@")[0].slice(0, 30) || "Student";

    const res = await fetch(`${paymobBase()}/v1/intention/`, {
      method: "POST",
      headers: { Authorization: `Token ${env("PAYMOB_SECRET_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: cents,
        currency: "EGP",
        payment_methods: env("PAYMOB_INTEGRATION_IDS")
          .split(",")
          .map((s) => Number(s.trim()))
          .filter(Boolean),
        items: [{ name: "Zakerly monthly", amount: cents, description: `Zakerly subscription (${settings.period_days} days)`, quantity: 1 }],
        billing_data: {
          first_name: name,
          last_name: "Zakerly",
          email,
          phone_number: "NA",
          street: "NA",
          building: "NA",
          floor: "NA",
          apartment: "NA",
          city: "NA",
          country: "EG",
        },
        special_reference: payment.id,
        notification_url: `${env("SUPABASE_URL")}/functions/v1/paymob-webhook`,
        redirection_url: `${appUrl}/#/paid`,
      }),
    });
    const intention = await res.json();
    if (!res.ok || !intention.client_secret) {
      console.error("paymob intention failed", res.status, intention);
      await db.from("payments").update({ status: "failed" }).eq("id", payment.id);
      return json({ error: "paymob" }, 502);
    }

    await db
      .from("payments")
      .update({ paymob_order_id: intention.intention_order_id != null ? String(intention.intention_order_id) : null })
      .eq("id", payment.id);

    const url = `${paymobBase()}/unifiedcheckout/?publicKey=${encodeURIComponent(env("PAYMOB_PUBLIC_KEY"))}&clientSecret=${encodeURIComponent(intention.client_secret)}`;
    return json({ url });
  } catch (e) {
    console.error(e);
    return json({ error: "server" }, 500);
  }
});

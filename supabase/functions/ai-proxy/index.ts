// Built-in free AI: forwards a student's request to Gemini with the owner's key,
// after checking they have access and spending one request of today's allowance.
import { adminClient, cors, env, json, userFromRequest } from "../_shared.ts";

const GEMINI = "https://generativelanguage.googleapis.com/v1beta";
const MAX_BODY_BYTES = 12 * 1024 * 1024; // 20 page photos fit comfortably

let autoModel: { id: string; at: number } | null = null;

/** Best available "flash" model for the owner's key, re-checked every 6 hours. */
async function pickModel(configured: string, key: string) {
  if (configured) return configured;
  if (autoModel && Date.now() - autoModel.at < 6 * 3600_000) return autoModel.id;
  const res = await fetch(`${GEMINI}/models?pageSize=200`, { headers: { "x-goog-api-key": key } });
  const data = await res.json();
  const ids: string[] = (data.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m: { name: string }) => m.name.replace(/^models\//, ""))
    .filter((id: string) => /^gemini-[\d.]+-flash$/.test(id));
  const version = (id: string) => parseFloat(id.match(/gemini-([\d.]+)/)?.[1] ?? "0");
  ids.sort((a, b) => version(b) - version(a));
  const id = ids[0] ?? "gemini-2.5-flash";
  autoModel = { id, at: Date.now() };
  return id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json({ error: "too-large" }, 413);

  const user = await userFromRequest(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const db = adminClient();
  const [{ data: profile }, { data: settings }] = await Promise.all([
    db.from("profiles").select("trial_ends_at,paid_until,is_admin").eq("user_id", user.id).single(),
    db.from("app_settings").select("free_model,free_daily_limit").eq("id", 1).single(),
  ]);
  const now = Date.now();
  const hasAccess =
    profile &&
    (profile.is_admin || new Date(profile.trial_ends_at).getTime() > now || (profile.paid_until && new Date(profile.paid_until).getTime() > now));
  if (!hasAccess) return json({ error: "no-access" }, 403);

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.contents) || typeof body.system !== "string") return json({ error: "bad request" }, 400);

  const { data: remaining, error: qErr } = await db.rpc("consume_ai_quota", { target: user.id });
  if (qErr) {
    console.error(qErr);
    return json({ error: "server" }, 500);
  }
  if (remaining < 0) return json({ error: "quota", limit: settings?.free_daily_limit ?? 0 }, 429);

  const key = env("GEMINI_API_KEY");
  const model = await pickModel(settings?.free_model ?? "", key);
  const stream = body.mode !== "json";
  const upstream = await fetch(`${GEMINI}/models/${model}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: body.contents,
      systemInstruction: { parts: [{ text: body.system }] },
      ...(stream ? {} : { generationConfig: { responseMimeType: "application/json", responseJsonSchema: body.schema } }),
    }),
  });

  if (!upstream.ok || !upstream.body) {
    // the student shouldn't pay for our failure
    await db.rpc("refund_ai_quota", { target: user.id });
    const detail = await upstream.text().catch(() => "");
    console.error("gemini error", upstream.status, detail.slice(0, 500));
    return json({ error: upstream.status === 429 ? "busy" : "upstream" }, upstream.status === 429 ? 503 : 502);
  }

  return new Response(upstream.body, {
    headers: {
      ...cors,
      "Access-Control-Expose-Headers": "x-quota-remaining, x-quota-limit",
      "Content-Type": stream ? "text/event-stream" : "application/json",
      "x-quota-remaining": String(remaining),
      "x-quota-limit": String(settings?.free_daily_limit ?? 0),
    },
  });
});

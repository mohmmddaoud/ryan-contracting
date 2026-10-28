import { clean, clientHash, json, readJson, readQuote, requireDb } from "./shared.js";

// Public endpoint: the quote form on the customer site posts here.
export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body) return json({ ok: false, error: "Invalid request." }, 400);
  if (clean(body.website, 200)) return json({ ok: true }); // honeypot: bots fill the hidden field
  const { q, error } = readQuote(body);
  if (error) return json({ ok: false, error }, 400);
  const db = await requireDb(env);
  const ipHash = await clientHash(request);
  const hourAgo = new Date(Date.now() - 3600e3).toISOString();
  const recent = await db.prepare("SELECT COUNT(*) AS n FROM quotes WHERE ip_hash = ? AND created_at > ?").bind(ipHash, hourAgo).first();
  if ((recent?.n ?? 0) >= 5) return json({ ok: false, error: "You've sent several requests already. Please call or text (281) 282-7982." }, 429);
  await db
    .prepare("INSERT INTO quotes (id, created_at, name, phone, email, location, service, timeline, contact_pref, details, source, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Website', ?)")
    .bind(crypto.randomUUID(), new Date().toISOString(), q.name, q.phone, q.email, q.location, q.service, q.timeline, q.contact_pref, q.details, ipHash)
    .run();
  return json({ ok: true });
}

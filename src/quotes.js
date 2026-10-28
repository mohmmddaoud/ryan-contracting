import { STATUSES, clean, isAdmin, json, readJson, readQuote, requireDb } from "./shared.js";

const FIELDS = "id, created_at, updated_at, name, phone, email, location, service, timeline, contact_pref, details, source, status, price, visit, starred, note";

export async function onRequestGet({ request, env }) {
  const db = await requireDb(env);
  if (!(await isAdmin(request, db))) return json({ ok: false, error: "Sign in required." }, 401);
  const { results } = await db.prepare(`SELECT ${FIELDS} FROM quotes ORDER BY created_at DESC LIMIT 2000`).all();
  return json({ ok: true, quotes: results.map((r) => ({ ...r, starred: !!r.starred })) });
}

export async function onRequestPost({ request, env }) {
  const db = await requireDb(env);
  if (!(await isAdmin(request, db))) return json({ ok: false, error: "Sign in required." }, 401);
  const body = await readJson(request);
  if (!body) return json({ ok: false, error: "Invalid request." }, 400);
  const now = new Date().toISOString();

  if (body.action === "add") {
    const { q, error } = readQuote(body.data || {});
    if (error) return json({ ok: false, error }, 400);
    const d = body.data || {};
    const price = d.price === "" || d.price == null ? null : Math.max(0, Math.round(Number(d.price))) || null;
    const visit = clean(d.visit, 20);
    const source = clean(d.source, 30) || "Phone call";
    await db
      .prepare("INSERT INTO quotes (id, created_at, updated_at, name, phone, email, location, service, timeline, contact_pref, details, source, status, price, visit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', 'Call', ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), now, now, q.name, q.phone, q.email, q.location, q.service, q.details, source, visit ? "scheduled" : "contacted", price, visit)
      .run();
    return json({ ok: true });
  }

  const id = clean(body.id, 64);
  if (!id) return json({ ok: false, error: "Missing request id." }, 400);

  if (body.action === "delete") {
    await db.prepare("DELETE FROM quotes WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  if (body.action === "update") {
    const f = body.fields || {};
    const sets = [];
    const vals = [];
    if ("status" in f) {
      if (!STATUSES.includes(String(f.status))) return json({ ok: false, error: "Unknown status." }, 400);
      sets.push("status = ?"); vals.push(String(f.status));
    }
    if ("price" in f) {
      const p = f.price === "" || f.price == null ? null : Math.max(0, Math.round(Number(f.price)));
      sets.push("price = ?"); vals.push(Number.isFinite(p) ? p : null);
    }
    if ("visit" in f) { sets.push("visit = ?"); vals.push(clean(f.visit, 20)); }
    if ("note" in f) { sets.push("note = ?"); vals.push(clean(f.note, 2000)); }
    if ("starred" in f) { sets.push("starred = ?"); vals.push(f.starred ? 1 : 0); }
    if (!sets.length) return json({ ok: false, error: "Nothing to update." }, 400);
    sets.push("updated_at = ?"); vals.push(now);
    await db.prepare(`UPDATE quotes SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, id).run();
    return json({ ok: true });
  }
  return json({ ok: false, error: "Unknown action." }, 400);
}

import { checkLogin, clientHash, createSession, json, readJson, requireDb, sessionCookie } from "./shared.js";

export async function onRequestPost({ request, env }) {
  const db = await requireDb(env);
  const ipHash = await clientHash(request);
  const since = Date.now() - 15 * 60e3;
  const tries = await db.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE ip_hash = ? AND at > ?").bind(ipHash, since).first();
  if ((tries?.n ?? 0) >= 8) return json({ ok: false, error: "Too many attempts. Wait 15 minutes and try again." }, 429);
  const body = await readJson(request);
  const email = typeof body?.email === "string" ? body.email.slice(0, 200) : "";
  const pw = typeof body?.password === "string" ? body.password.slice(0, 200) : "";
  if (!email || !pw || !(await checkLogin(env, email, pw))) {
    await db.prepare("INSERT INTO login_attempts (ip_hash, at) VALUES (?, ?)").bind(ipHash, Date.now()).run();
    await db.prepare("DELETE FROM login_attempts WHERE at < ?").bind(since).run();
    await new Promise((r) => setTimeout(r, 600));
    return json({ ok: false, error: "That email or password is not right." }, 401);
  }
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(await createSession(db)) });
}

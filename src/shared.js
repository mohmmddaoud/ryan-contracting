// Shared helpers for the Pages Functions. Bindings: DB (D1), ADMIN_PASSWORD (secret).
export const STATUSES = ["new", "contacted", "scheduled", "won", "closed"];
export const SERVICES = ["Painting", "Flooring", "Kitchen Installation", "Bathroom Renovations", "Door & Windows", "Home Assembly Services", "Something else"];
const COOKIE = "rc_admin";
const SESSION_DAYS = 30;

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}
export function clean(v, max) {
  return typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max) : "";
}
export async function sha256Hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
export async function clientHash(request) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  return (await sha256Hex("rc-salt:" + ip)).slice(0, 32);
}
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS quotes (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT, name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '', service TEXT NOT NULL, timeline TEXT NOT NULL DEFAULT '', contact_pref TEXT NOT NULL DEFAULT 'Call', details TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'Website', status TEXT NOT NULL DEFAULT 'new', price INTEGER, visit TEXT NOT NULL DEFAULT '', starred INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', ip_hash TEXT NOT NULL DEFAULT '')",
  "CREATE INDEX IF NOT EXISTS quotes_created ON quotes(created_at)",
  "CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS login_attempts (ip_hash TEXT NOT NULL, at INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS login_attempts_ip ON login_attempts(ip_hash, at)",
];
// The database sets itself up on first use, so there is no manual SQL step.
let schemaReady = null;
export async function requireDb(env) {
  if (!env.DB) throw new Error("The DB database binding is missing.");
  if (!schemaReady) schemaReady = env.DB.batch(SCHEMA.map((q) => env.DB.prepare(q))).catch((e) => { schemaReady = null; throw e; });
  await schemaReady;
  return env.DB;
}
// sha256 of the starting admin password (the plain password is not stored here).
// Setting an ADMIN_PASSWORD secret in Cloudflare replaces it.
const DEFAULT_PASSWORD_SHA256 = "d654bca3810aba4a80adc9037052bcb2d0a204c1c7480c73f2786b50f42c5908";
export async function checkPassword(env, pw) {
  const hashed = await sha256Hex(pw);
  if (env.ADMIN_PASSWORD) return safeEqual(hashed, await sha256Hex(env.ADMIN_PASSWORD));
  return safeEqual(hashed, DEFAULT_PASSWORD_SHA256);
}
function readCookie(request, name) {
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}
export async function createSession(db) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  await db.prepare("DELETE FROM admin_sessions WHERE expires_at < ?").bind(Date.now()).run();
  await db.prepare("INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)").bind(await sha256Hex(token), Date.now() + SESSION_DAYS * 864e5).run();
  return token;
}
export function sessionCookie(token, maxAge = SESSION_DAYS * 86400) {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}
export async function isAdmin(request, db) {
  const token = readCookie(request, COOKIE);
  if (!token || token.length > 200) return false;
  const row = await db.prepare("SELECT expires_at FROM admin_sessions WHERE token_hash = ?").bind(await sha256Hex(token)).first();
  return !!row && row.expires_at > Date.now();
}
export async function endSession(request, db) {
  const token = readCookie(request, COOKIE);
  if (token) await db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
}
// Validates a quote body from the public form or the admin "Add request" form.
export function readQuote(body) {
  const q = {
    name: clean(body.name, 80),
    phone: clean(body.phone, 30),
    email: clean(body.email, 120),
    location: clean(body.location, 80),
    service: clean(body.service, 60),
    timeline: clean(body.timeline, 40),
    contact_pref: ["Call", "Text", "Email"].includes(String(body.contact_pref)) ? String(body.contact_pref) : "Call",
    details: clean(body.details, 2000),
  };
  if (!q.name) return { error: "Please add a name." };
  if (q.phone.replace(/\D/g, "").length < 7) return { error: "Please add a phone number." };
  if (q.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q.email)) return { error: "That email address doesn't look right." };
  if (!SERVICES.includes(q.service)) return { error: "Please choose a service." };
  if (q.details.length < 5) return { error: "Please add a few project details." };
  return { q };
}
export async function readJson(request) {
  try {
    const b = await request.json();
    return b && typeof b === "object" ? b : null;
  } catch {
    return null;
  }
}

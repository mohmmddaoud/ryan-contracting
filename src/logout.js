import { endSession, json, requireDb, sessionCookie } from "./shared.js";

export async function onRequestPost({ request, env }) {
  await endSession(request, await requireDb(env));
  return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
}

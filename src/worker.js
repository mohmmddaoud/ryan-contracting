// Cloudflare Worker entry. Static files come from /public; /api/* runs here.
import * as quote from "./quote.js";
import * as login from "./login.js";
import * as logout from "./logout.js";
import * as quotes from "./quotes.js";
import { json } from "./shared.js";

const ROUTES = {
  "/api/quote": quote,
  "/api/admin/login": login,
  "/api/admin/logout": logout,
  "/api/admin/quotes": quotes,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const mod = ROUTES[url.pathname];
    if (mod) {
      const handler = mod["onRequest" + request.method[0] + request.method.slice(1).toLowerCase()];
      if (!handler) return json({ ok: false, error: "Method not allowed." }, 405);
      try {
        return await handler({ request, env, ctx });
      } catch (e) {
        console.error(e);
        return json({ ok: false, error: "Something went wrong on our side. Please call or text (281) 282-7982." }, 500);
      }
    }
    if (url.pathname.startsWith("/api/")) return json({ ok: false, error: "Not found." }, 404);
    return env.ASSETS.fetch(request);
  },
};

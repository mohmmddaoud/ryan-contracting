# Ryan Contracting website

Customer website with a 3D walk-through and a quote request form, plus a private admin panel for managing requests.

- Customer site: `https://rayyancontracting.com`
- Admin panel: `https://rayyancontracting.com/admin` (password protected)

Runs as one **Cloudflare Worker** (free plan). Pages and photos are in `public/`, the server code is in `src/`, and quote requests are stored in a **Cloudflare D1** database that sets itself up on first use.

## Put it online (works from a phone)

1. **Deploy**
   Tap the button below, sign in to Cloudflare (or create a free account), and confirm.
   Cloudflare copies this project to your GitHub, creates the database, and publishes the site.

   [![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/mohmmddaoud/ryan-contracting)

2. **Connect the domain (GoDaddy)**
   - Cloudflare dashboard → *Add a domain* → `rayyancontracting.com` → Free plan. Cloudflare shows two **nameservers**.
   - GoDaddy → My Products → `rayyancontracting.com` → DNS → **Nameservers** → Change → *I'll use my own nameservers* → paste the two Cloudflare nameservers → Save.
   - Wait until Cloudflare says the domain is **Active** (usually under an hour, sometimes up to a day).
   - Workers & Pages → `rayyan-contracting` → Settings → **Domains & Routes** → Add → Custom domain → `rayyancontracting.com`. Repeat for `www.rayyancontracting.com`.

3. **Admin password**
   The admin panel starts with the password you were given privately. To change it:
   Workers & Pages → `rayyan-contracting` → Settings → **Variables and Secrets** → Add → type *Secret* → name `ADMIN_PASSWORD` → your new password → Deploy.

## Day to day

- New requests from the website show up at `/admin` (it refreshes every 30 seconds).
- In the admin: set status, quoted price and site visit, write notes, star important jobs, log phone calls with *Add request*, and download everything with *Export CSV*.
- Any change pushed to this GitHub repository redeploys the site automatically.

## Notes

- Stage photos in `public/photos/` are free-to-use photos from Unsplash. Replace them with photos of Ryan's own work when available (keep the same file names).
- Spam protection: a hidden form field plus a limit of 5 requests per hour per visitor. The admin login locks for 15 minutes after 8 wrong passwords.

# Mounting hscf-sms at tamilschoolfl.org/tamizhi

This proxies `tamilschoolfl.org/tamizhi/*` (plus `/api/*` and `/_next/*`,
which the app itself references as root-relative paths) to the hscf-sms
app hosted on Vercel, while everything else on the domain keeps being
served by IONOS exactly as today. See the comment block at the top of
`worker.js` for why it works this way.

## 1. Deploy hscf-sms to Vercel -- DONE

Deployed via the Vercel CLI directly from the local working directory
(not via GitHub -- see note below about the repo's git history). Live at
`https://hscf-sms.vercel.app`, env vars (Clerk + Supabase keys) already
set as Production variables in the `hscf-sms` Vercel project. Do **not**
add a custom domain to this Vercel project; it stays on its default
`*.vercel.app` URL, since the Cloudflare Worker is what makes it
reachable at tamilschoolfl.org.

**Note:** most of this app's code (everything except the original
Next.js scaffold files) was never committed to git before this deploy --
worth doing a proper `git add`/`git commit`/`git push` soon so there's an
actual backup and future deploys can go through normal git-based CI
instead of ad-hoc CLI deploys.

## 2. Move DNS to Cloudflare (needed to run a Worker)

1. Create a free Cloudflare account, **Add a Site**, enter
   `tamilschoolfl.org`.
2. Cloudflare scans and imports your existing DNS records from IONOS
   automatically. **Before continuing, open the imported record list and
   verify every MX record (email) is present and correct** -- compare
   against IONOS's control panel (Domains & SSL -> tamilschoolfl.org ->
   DNS) if you're not sure email is even configured there. Missing an MX
   record here is the one mistake that actually breaks something (email
   stops arriving) -- everything else in this migration is easy to undo.
3. Cloudflare gives you two nameservers (e.g. `xxx.ns.cloudflare.com`).
   Go to IONOS's domain settings (not the hosting/DNS settings -- the
   domain registration itself) and replace the current nameservers with
   Cloudflare's two. This can take a few hours to propagate.
4. Once Cloudflare shows the zone as "Active", the site should still work
   exactly as before (Cloudflare is now just passing everything through
   to IONOS) -- confirm tamilschoolfl.org still loads normally before
   moving on.

## 3. Deploy the Worker

1. In `worker.js`, replace `YOUR-VERCEL-DEPLOYMENT.vercel.app` with the
   actual Vercel URL from step 1.
2. Easiest path: Cloudflare dashboard -> **Workers & Pages** -> **Create**
   -> **Create Worker**. Paste the contents of `worker.js` into the editor,
   deploy it, name it something like `tamizhi-proxy`.
   (Alternatively, install `wrangler` and run `wrangler deploy` from this
   folder -- ask me if you want a `wrangler.toml` set up for that instead.)
3. Go to the zone's **Workers Routes** (under the domain in the
   Cloudflare dashboard, not the Worker's own settings) and add three
   routes, all pointing at the `tamizhi-proxy` Worker:
   - `tamilschoolfl.org/tamizhi*`
   - `tamilschoolfl.org/api*`
   - `tamilschoolfl.org/_next*`

   Do **not** add a catch-all route for the whole zone -- only these
   three patterns should hit the Worker; everything else should keep
   using the zone's normal DNS resolution to IONOS.

## 4. Configure Clerk for production

1. In the Clerk Dashboard, switch the hscf-sms application from
   Development to a **Production** instance.
2. When it asks for the domain, enter `tamilschoolfl.org` (the root
   domain -- Clerk's own subdomains like `clerk.tamilschoolfl.org` get
   created underneath it automatically). Path-based mounting means Clerk
   doesn't need to know about `/tamizhi` at all -- it only cares about the
   domain, not the path.
3. Clerk gives you a list of DNS records (CNAME/TXT) to add for its own
   infrastructure (`clerk.`, `accounts.`, `clkmail.`, `clk._domainkey.`,
   etc.). Add these in Cloudflare's DNS tab, same as any other DNS
   record -- set them to "DNS only" (grey cloud, not proxied through
   Cloudflare) if Clerk's setup screen says so.
4. Re-apply the session token customization (Configure -> Sessions ->
   Customize session token -> `{"role": "authenticated"}`) on the new
   Production instance -- this does NOT carry over from Development
   automatically.
5. Get the Production instance's `CLERK_SECRET_KEY` and
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and update them in the Vercel
   project's environment variables (replacing the dev keys), then
   redeploy.

## 5. Verify

- `tamilschoolfl.org/tamizhi/login` loads the sign-in page.
- `tamilschoolfl.org/about` (or any existing marketing page) still loads
  from IONOS, unaffected.
- Sign in, confirm you land on `tamilschoolfl.org/tamizhi/<role>` (not a
  raw `*.vercel.app` URL) -- this confirms the Worker's redirect
  rewriting is working.
- Open browser devtools Network tab on any dashboard page and confirm
  `/api/...` and `/_next/static/...` requests return 200, not 404.

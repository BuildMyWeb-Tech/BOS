# BOS — Deployment Guide

This guide walks through deploying BOS to production: Neon Postgres + Vercel.

---

## ⚠️ Before you start: rotate exposed credentials

If a Neon database password has ever been shared outside a secure channel
(pasted in chat, committed to git, etc.), **rotate it now** in the Neon
console before doing anything else: `Project → Settings → Reset password`.
A leaked password should be treated as compromised even if you don't see
evidence of misuse.

---

## 1. Create the Neon project

1. Go to [console.neon.tech](https://console.neon.tech) and create a new project.
2. Choose a region close to where your users (and your Vercel deployment)
   will be. AWS `us-east-1` (N. Virginia) pairs with Vercel's `iad1` region —
   this repo's `vercel.json` defaults to `iad1`. **If you pick a different
   Neon region, update `vercel.json`'s `regions` field to match** (see the
   [Vercel regions list](https://vercel.com/docs/edge-network/regions) for
   the closest equivalent).
3. From **Project → Connection Details**, copy two connection strings:
   - **Pooled** connection (hostname contains `-pooler`) → this is `DATABASE_URL`
   - **Direct** connection (hostname has no `-pooler`) → this is `DIRECT_URL`

   Both are needed — see the comments in `.env.example` for why.

---

## 2. Configure environment variables

### Local development

```bash
cp .env.example .env.local
```

Fill in at minimum:
- `DATABASE_URL` / `DIRECT_URL` (from step 1)
- `JWT_SECRET` — generate with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` / `SUPER_ADMIN_NAME` (seed-only)

Everything else (ImageKit, Razorpay, Inngest) is optional until those
integrations are wired up — leave blank for now.

### Production (Vercel)

Do **not** upload `.env.local` to Vercel. Instead, add each variable
individually:

1. Vercel Dashboard → your project → **Settings → Environment Variables**
2. Add every variable from `.env.example`, scoped to **Production**
   (and **Preview** if you want preview deployments to hit the same DB,
   or a separate Neon branch — see step 6).
3. Use a **different** `JWT_SECRET` than your local one. Generate a fresh
   one with the same command above.
4. Set `NEXT_PUBLIC_APP_URL` to your real production URL once you know it
   (you can update this after the first deploy).

---

## 3. Link the Vercel project

```bash
npm install -g vercel   # if not already installed
vercel login
vercel link
```

Follow the prompts to connect this local repo to a new (or existing)
Vercel project.

---

## 4. First deploy

```bash
vercel --prod
```

This runs the `buildCommand` from `vercel.json`:
```
prisma generate && next build
```

`prisma generate` regenerates the Prisma Client against your schema —
required on every build since generated client code isn't committed to git.

If the build fails on a Prisma-related error, double-check that
`DATABASE_URL` and `DIRECT_URL` are both set correctly in Vercel's
environment variables — `next build` doesn't connect to the DB, but
`prisma generate` reads the schema's `datasource` block which references
both env vars.

---

## 5. Run migrations against production

From your local machine, with `.env.local` pointing at the **production**
`DIRECT_URL** (temporarily, or via `vercel env pull`):

```bash
vercel env pull .env.production.local
npx prisma migrate deploy
```

`migrate deploy` (not `migrate dev`) is the production-safe command — it
applies pending migrations without prompting or generating new ones.

---

## 6. Seed the production database

**Run this once**, immediately after the first successful migration:

```bash
npm run db:seed
```

This creates:
- The 24 canonical permissions
- The 4 system roles (SUPER_ADMIN, VENDOR_OWNER, STAFF, CUSTOMER) with
  their permission sets
- The Super Admin user, using `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`
  / `SUPER_ADMIN_NAME` from your environment

**Immediately after seeding**, log in as the Super Admin and change the
password through the app — the seed-time password should be treated as
temporary.

---

## 7. Verify the deployment

- [ ] Visit your production URL → should redirect to `/login`
- [ ] `GET /api/health` returns `{"status":"ok"}`
- [ ] Log in as Super Admin with the seeded credentials
- [ ] `/manifest.json` loads with `Content-Type: application/manifest+json`
      (check via browser devtools → Network tab)
- [ ] `/sw.js` registers without errors (devtools → Application → Service Workers)
- [ ] On a mobile browser or Chrome desktop, the install prompt (Phase 9)
      appears after a few seconds of browsing

---

## 8. PWA icon assets — action required

`public/manifest.json` references four icon files that are **not included**
in this repo and must be added before the PWA install experience looks
correct:

```
public/icons/icon-192.png            (192×192, standard)
public/icons/icon-512.png            (512×512, standard)
public/icons/icon-maskable-192.png   (192×192, with safe-zone padding for maskable icons)
public/icons/icon-maskable-512.png   (512×512, with safe-zone padding for maskable icons)
```

Until these exist, the manifest will still validate, but installed PWA
icons will show as broken/blank on phone home screens. A quick way to
generate all four from a single source image: use a tool like
[realfavicongenerator.net](https://realfavicongenerator.net) or
[maskable.app](https://maskable.app/editor) for the maskable variants
specifically (maskable icons need extra padding so they aren't clipped
by OS icon masks).

---

## 9. Custom domains for tenants (multi-tenant routing in production)

Per `.env.example`'s multi-tenant routing notes: in production,
`middleware.ts` resolves tenants via `Tenant.customDomain`, not subdomain.

To onboard a vendor's custom domain:
1. Vendor sets their domain's DNS to point at Vercel (CNAME or A record
   per Vercel's instructions).
2. Add the domain in **Vercel → Project → Settings → Domains**.
3. Update that tenant's `customDomain` field in the database (via the
   Super Admin panel, once built, or directly via Prisma Studio /
   `db:studio` in the interim).

---

## 10. Ongoing deploys

Every `git push` to your linked branch triggers an automatic Vercel
deployment (if you've connected the Vercel project to a GitHub/GitLab
repo via the dashboard, rather than only deploying via CLI). Preview
deployments are created for non-production branches/PRs automatically.

**Migrations are not automatic.** After any schema change:
```bash
npx prisma migrate dev --name describe_the_change   # locally, creates the migration file
git push                                              # deploys the code
npx prisma migrate deploy                             # applied to prod DB
```
Run the `migrate deploy` step against production *before or immediately
after* the code deploy that depends on the new schema — never leave a
schema-dependent deploy live against an un-migrated database.

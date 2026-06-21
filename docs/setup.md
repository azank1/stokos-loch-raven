# Setup and deployment

## Stack

| Layer | Technology |
|-------|------------|
| App | Next.js (App Router), TypeScript |
| Database | MongoDB Atlas |
| Payments | Stripe Checkout; optional Stripe Connect Express |
| Admin auth | Clerk (`ADMIN_EMAILS` allowlist via `proxy.ts`) |
| Hosting | Vercel (Git integration on `main`) |

## Branches

| Branch | Use |
|--------|-----|
| `main` | Production code path; Vercel auto-deploy |
| `stokos-app-ops` | Integration branch; engineering docs live here |

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Environment variables

Set in Vercel → Project → Settings → Environment Variables. Never commit secrets.

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | Atlas connection string |
| `MONGODB_DB` | Yes | Database name (`stokos`) |
| `STRIPE_SECRET_KEY` | Yes | Platform secret key (`sk_test_` or `sk_live_`) |
| `STRIPE_WEBHOOK_SECRET` | Yes | Signing secret from Stripe webhook (`whsec_...`) |
| `STRIPE_CONNECT_ACCOUNT_ID` | No | Express connected account (`acct_...`). Omit for direct platform checkout in test. |
| `STRIPE_PLATFORM_FEE_PERCENT` | No | Application fee percent when Connect is enabled (e.g. `1.5`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key |
| `ADMIN_EMAILS` | Yes | Comma-separated emails allowed into `/admin` |
| `NEXT_PUBLIC_BASE_URL` | Yes | Public site URL, no trailing slash |

Preview environments should use test keys and a non-production database.

## MongoDB

1. Provision an Atlas cluster (M10+ recommended for production).
2. Allow Vercel egress IPs or use Atlas IP allowlist `0.0.0.0/0` with strong credentials.
3. Import menu data via `/admin/menu` or:

   ```bash
   node --env-file=.env.local scripts/import-menu-csv.js path/to/menu.csv
   ```

4. Ensure indexes:

   ```bash
   node --env-file=.env.local scripts/mongodb-indexes.js
   ```

5. Rebuild per-store menus from an admin session: `POST /api/admin/menu/storemenus/rebuild`.

Store slugs in use: `towson`, `york`, `liberty`.

## Clerk (admin)

1. Create a production Clerk application with live keys.
2. Ensure session tokens expose an `email` claim (required by `proxy.ts`).
3. Disable public sign-up; provision staff users in the Clerk dashboard.
4. Add production and preview URLs to allowed origins.
5. Set `ADMIN_EMAILS` to match staff who need dashboard access.

Admin sign-in: `/admin/sign-in`. Customer routes remain public.

## Stripe

### Checkout

Checkout creates an order in MongoDB, then redirects to Stripe Checkout. Payment confirmation uses the webhook with a success-page fallback.

### Webhook

Create a Stripe webhook pointing to:

```
https://<your-production-domain>/api/webhooks/stripe
```

Subscribe to: `checkout.session.completed`.

**Vercel Deployment Protection must be disabled for Production** (or webhooks receive 401).

Copy the signing secret to `STRIPE_WEBHOOK_SECRET` and redeploy.

### Connect (optional)

1. Enable Express connected accounts on the platform Stripe account.
2. Create a connected account (MCC `5812` for restaurants).
3. Complete Express onboarding for the merchant.
4. Set `STRIPE_CONNECT_ACCOUNT_ID` and `STRIPE_PLATFORM_FEE_PERCENT` in Vercel.

Test card: `4242 4242 4242 4242`.

## Vercel checklist

- [ ] Git repo connected; `main` triggers production deploy
- [ ] Deployment Protection **off** for Production (required for public site and webhooks)
- [ ] All variables above set for Production (and Preview if used)
- [ ] `NEXT_PUBLIC_BASE_URL` matches the public URL
- [ ] Redeploy after any env change

Quick health checks after deploy:

- `GET /track` → 200
- `GET /admin/sign-in` → 200
- `GET /api/store/towson/menu` → JSON with products

## Key routes

| Path | Role |
|------|------|
| `/store/[slug]` | Customer menu and cart |
| `/track` | Guest order lookup |
| `/admin/*` | Staff dashboard (Clerk + allowlist) |
| `POST /api/checkout` | Create order + Stripe session |
| `POST /api/webhooks/stripe` | Payment confirmation |
| `GET /api/admin/orders` | Order queue |
| `GET /api/account/*` | Signed-in customer account (optional) |

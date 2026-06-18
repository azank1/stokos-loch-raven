# Go-Live Checklist (Phase A)

Complete these before handing the site to Stokos customers.

## Vercel (Azan)

- [ ] Project on **Bayent Labs** team, Git repo `azank1/stokos-loch-raven`
- [ ] **Deployment Protection → OFF** for Production (Settings → Deployment Protection)
- [ ] `NEXT_PUBLIC_BASE_URL` = production URL (e.g. `https://stokos-loch-raven-git-main-bayentlabs.vercel.app`)
- [ ] All vars from [vercel-env-checklist.md](./vercel-env-checklist.md) set for **Production**
- [ ] Redeploy after env changes

## Clerk (Azan)

- [ ] Production instance with live keys (`pk_live_` / `sk_live_`)
- [ ] Session token includes `email` claim
- [ ] Staff users created in Clerk Dashboard (no self-service sign-up)
- [ ] `ADMIN_EMAILS` lists all manager emails
- [ ] Allowed origins include production URL

## MongoDB (Abassi)

- [ ] Production Atlas cluster (M10+)
- [ ] Data migrated / menu populated
- [ ] Run `node --env-file=.env.local scripts/mongodb-indexes.js`
- [ ] `MONGODB_URI` + `MONGODB_DB=stokos` in Vercel

## Stripe Connect (Abassi)

- [ ] Stokos Express account onboarded
- [ ] Live webhook → `https://[your-domain]/api/webhooks/stripe` (`checkout.session.completed`)
- [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_ACCOUNT_ID`, `STRIPE_PLATFORM_FEE_PERCENT` in Vercel

## Menu content

- [ ] Full menu entered via `/admin/menu` **or** bulk import:
  ```bash
  node --env-file=.env.local scripts/import-menu-csv.js path/to/menu.csv
  ```
- [ ] Rebuild store menus: POST `/api/admin/menu/storemenus/rebuild` (from admin session)

## QA

- [ ] Run automated smoke: `npm run smoke:test`
- [ ] Complete [qa-checklist.md](./qa-checklist.md) manually
- [ ] Live $1 test order + refund after live Stripe keys

## Sign-off

| Role | Name | Date | Signed |
|------|------|------|--------|
| Engineering | | | |
| Operations (Stripe/Mongo) | | | |
| Client (Stokos) | | | |

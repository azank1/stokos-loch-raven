# Go-Live Handoff — External Tasks

Track production launch tasks that require Vercel dashboard, Abassi, or Stokos.  
**Launch URL:** `https://stokos-loch-raven-git-main-bayentlabs.vercel.app`  
**Git:** `azank1/stokos-loch-raven` → `main`

---

## Azan — Vercel (do immediately after push)

1. [ ] **Deployment Protection OFF**  
   Vercel → Bayent Labs project → Settings → Deployment Protection → disable for **Production**

2. [ ] **Environment variables (Production)** — see [vercel-env-checklist.md](./vercel-env-checklist.md)

   | Variable | Phase 2 (TEST QA) |
   |----------|-------------------|
   | `NEXT_PUBLIC_BASE_URL` | `https://stokos-loch-raven-git-main-bayentlabs.vercel.app` |
   | `MONGODB_URI` | From Abassi (prod) |
   | `MONGODB_DB` | `stokos` |
   | `STRIPE_SECRET_KEY` | `sk_test_...` from Abassi |
   | `STRIPE_WEBHOOK_SECRET` | Test webhook `whsec_...` |
   | `STRIPE_CONNECT_ACCOUNT_ID` | **Leave empty for TEST QA** |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk key |
   | `CLERK_SECRET_KEY` | Clerk secret |
   | `ADMIN_EMAILS` | Manager emails, comma-separated |

3. [ ] Redeploy Production after env changes

4. [ ] Verify: `SMOKE_BASE_URL=https://stokos-loch-raven-git-main-bayentlabs.vercel.app npm run smoke:test`

---

## Azan — Clerk

See [azan-clerk-vercel-checklist.md](./azan-clerk-vercel-checklist.md)

1. [ ] Production (or test) Clerk app with session token: `{ "email": "{{user.primary_email_address}}" }`
2. [ ] Create staff users for Towson, York, Liberty managers
3. [ ] Set `ADMIN_EMAILS` in Vercel to match those emails

---

## Abassi — MongoDB prod

See [abassi-mongodb-checklist.md](./abassi-mongodb-checklist.md)

1. [ ] M10+ Atlas cluster for production
2. [ ] Migrate menu + store data from dev cluster
3. [ ] Run: `node --env-file=.env.local scripts/mongodb-indexes.js` (against prod URI)
4. [ ] Send `MONGODB_URI` to Azan for Vercel Production

---

## Abassi — Stripe TEST (before Stokos bank link)

See [abassi-stripe-checklist.md](./abassi-stripe-checklist.md)

1. [ ] Create test webhook: `https://stokos-loch-raven-git-main-bayentlabs.vercel.app/api/webhooks/stripe`  
   Event: `checkout.session.completed`
2. [ ] Send `STRIPE_SECRET_KEY` (test) + `STRIPE_WEBHOOK_SECRET` to Azan
3. [ ] Create Express connected account + onboarding link for Stokos (parallel — not needed for TEST QA)

---

## Stokos client — one-time (~10 min)

See [client-onboarding.md](./client-onboarding.md)

1. [ ] Open Stripe Express onboarding link from Abassi
2. [ ] Add bank account + complete verification
3. [ ] Send manager emails to Azan for admin accounts

---

## Abassi — Flip to LIVE (after QA + Stokos bank)

1. [ ] Confirm connected account `charges_enabled` + `payouts_enabled`
2. [ ] Update Vercel Production:
   - `STRIPE_SECRET_KEY` → `sk_live_...`
   - `STRIPE_WEBHOOK_SECRET` → live webhook secret
   - `STRIPE_CONNECT_ACCOUNT_ID` → Stokos `acct_...`
   - `STRIPE_PLATFORM_FEE_PERCENT` → e.g. `1.5`
3. [ ] Redeploy
4. [ ] Live $1 test order + refund

---

## Menu import (when prod MongoDB URI is available)

```bash
# Full menu CSV (all stores)
node --env-file=.env.local scripts/import-menu-csv.js path/to/full-menu.csv

# Rebuild snapshots (requires MONGODB_URI pointing at target cluster)
node --env-file=.env.local scripts/rebuild-store-menus.js

# Optional test promos
npm run seed:promos
```

Then verify `/store/towson`, `/store/york`, `/store/liberty` on production URL.

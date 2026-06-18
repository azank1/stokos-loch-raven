# Abassi — Stripe Connect Express Checklist

**Owner:** Abassi (agency platform account)  
**Handoff to:** Azan (Vercel Stripe env vars)  
**Stokos client action:** One onboarding link (~10 min) to connect bank

Code supports Connect when `STRIPE_CONNECT_ACCOUNT_ID` is set ([`app/api/checkout/route.ts`](../app/api/checkout/route.ts)).

---

## 1. Platform account

- [ ] Stripe Dashboard → **Connect** → enable **Express** connected accounts
- [ ] Complete platform profile (support email, branding)
- [ ] Save platform **test** and **live** secret keys

---

## 2. Create Stokos connected account (test first)

- [ ] Dashboard → Connect → Create account → **Express**
- [ ] Prefill: Stokos legal name, email, MCC `5812` (restaurant)
- [ ] Save `acct_...` as `STRIPE_CONNECT_ACCOUNT_ID`

Generate onboarding link:

```bash
stripe account_links create \
  --account acct_xxx \
  --refresh-url https://stokos-loch-raven-git-main-bayentlabs.vercel.app/admin \
  --return-url https://stokos-loch-raven-git-main-bayentlabs.vercel.app/admin \
  --type account_onboarding
```

---

## 3. Test mode validation

Set on Vercel **Preview** (or local `.env.local`):

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_CONNECT_ACCOUNT_ID=acct_test_...
STRIPE_PLATFORM_FEE_PERCENT=1.5
STRIPE_WEBHOOK_SECRET=whsec_...   # from test webhook
```

- [ ] Complete test Express onboarding (test data)
- [ ] Place test order with card `4242 4242 4242 4242`
- [ ] Admin shows order **Confirmed / Paid**
- [ ] Stripe Dashboard → Connect → verify transfer + application fee

---

## 4. Webhook

**Test:**

- URL: `https://[staging-domain]/api/webhooks/stripe`
- Event: `checkout.session.completed`

**Production:**

- URL: `https://[production-domain]/api/webhooks/stripe`
- Event: `checkout.session.completed`

- [ ] Webhook signing secret copied to Azan for Vercel

---

## 5. Stokos client onboarding (live)

- [ ] Create **live** connected account (or activate test → live per Stripe flow)
- [ ] Send Account Link to Stokos owner
- [ ] Confirm: `charges_enabled` + `payouts_enabled`
- [ ] Hand live keys to Azan:

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_ACCOUNT_ID=acct_...
STRIPE_PLATFORM_FEE_PERCENT=1.5
```

---

## 6. Go-live test

- [ ] One **$1 live order** on production
- [ ] Refund in Stripe Dashboard
- [ ] Sign-off with Azan

---

## Monthly maintenance

- Monitor webhook delivery failures (Stripe → Developers → Webhooks)
- Watch connected account `requirements.currently_due` — re-send Account Link if needed
- Process refunds manually in Stripe until admin refund route is built (P1)

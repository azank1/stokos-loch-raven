# Azan — Clerk + Vercel Production Checklist

**Owner:** Azan  
**Dependencies:** Abassi provides MongoDB + Stripe env vars first (or in parallel for staging)

---

## Vercel project

- [ ] Confirm Vercel project is on **Bayent Labs** team, connected to `azank1/stokos-loch-raven`
- [ ] Set `NEXT_PUBLIC_BASE_URL` to your production URL (e.g. `https://stokos-loch-raven-git-main-bayentlabs.vercel.app`)
- [ ] Production branch = `main`
- [ ] Latest deploy commit matches GitHub `main`
- [ ] Smoke: `/track` and `/admin/sign-in` return 200

See [vercel-env-checklist.md](./vercel-env-checklist.md) for all variables.

---

## Clerk production

- [ ] Create **production** Clerk application (when domain available)
- [ ] Configure production domain DNS (Clerk provides records)
- [ ] **Sessions → Customize session token** → add:
  ```json
  { "email": "{{user.primary_email_address}}" }
  ```
  Required for [`proxy.ts`](../proxy.ts) admin allowlist.
- [ ] Copy `pk_live_...` and `sk_live_...` to Vercel
- [ ] **Do not** use self-service sign-up for admins — create users in Clerk Dashboard
- [ ] Set `ADMIN_EMAILS` in Vercel (comma-separated manager emails from Stokos)

---

## Staff accounts

Create one Clerk user per branch manager (email + password or invite):

- [ ] Towson manager
- [ ] York manager
- [ ] Liberty manager
- [ ] Any owner/supervisor emails

---

## Domain (when client provides)

- [ ] Add domain in Vercel → Domains
- [ ] Update `NEXT_PUBLIC_BASE_URL`
- [ ] Update Clerk allowed origins / production domain
- [ ] Redeploy

---

## Redeploy

- [ ] All env vars set for Production
- [ ] Trigger redeploy
- [ ] Run [qa-checklist.md](./qa-checklist.md)

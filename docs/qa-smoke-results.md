# QA Smoke Results — Automated

**Date:** 2026-06-18  
**Commit:** (see git log after push)

## Local (localhost:3000)

Run: `npm run smoke:test` (requires dev server)

| Check | Status |
|-------|--------|
| `/` | automated |
| `/store/towson` | automated |
| `/track` | automated |
| `/admin/sign-in` | automated |
| `/api/store/towson/menu` | automated |

## Bayent Labs production

See [go-live-checklist.md](./go-live-checklist.md) for Vercel Deployment Protection and env setup.

## Manual QA

Complete remaining items in [qa-checklist.md](./qa-checklist.md) after Vercel deploys latest `main`.

## Live $1 test

Pending Abassi live Stripe keys + Connect onboarding (see [abassi-stripe-checklist.md](./abassi-stripe-checklist.md)).

# Vercel Environment Variables Checklist

Set these in **Vercel → Project → Settings → Environment Variables** (Bayent Labs team project, Git repo `azank1/stokos-loch-raven`).

Use a password manager to share secrets with Abassi (Stripe, MongoDB) and never commit real values.

## Production

| Variable | Owner | Notes |
|----------|-------|-------|
| `MONGODB_URI` | Abassi | Production Atlas cluster URI |
| `MONGODB_DB` | Abassi | `stokos` |
| `STRIPE_SECRET_KEY` | Abassi | Platform account `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Abassi | Live webhook `whsec_...` |
| `STRIPE_CONNECT_ACCOUNT_ID` | Abassi | Stokos Express account `acct_...` |
| `STRIPE_PLATFORM_FEE_PERCENT` | Abassi | e.g. `1.5` (percent, no `%` sign) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Azan | Clerk production `pk_live_...` |
| `CLERK_SECRET_KEY` | Azan | Clerk production `sk_live_...` |
| `ADMIN_EMAILS` | Azan | Comma-separated staff emails |
| `NEXT_PUBLIC_BASE_URL` | Azan | e.g. `https://stokos-loch-raven-git-main-bayentlabs.vercel.app` or team production alias / custom domain |

## Preview (optional)

Use staging/test keys and a staging MongoDB URI so preview deploys do not touch production data.

## After any change

Redeploy Production from the Deployments tab (or push to `main` on the connected Git repo).

## Verify

- `/track` → 200
- `/admin/sign-in` → 200
- `/api/store/towson/menu` → returns products

# Requirements Coverage — Implementation Status

Updated after plan implementation (Phases A–C).

## Admin dashboard

| Requirement | Status |
|-------------|--------|
| Clerk admin auth | Done — code + unauthorized alert on sign-in |
| Order status flow | Done |
| Delivery + tax | Done |
| Admin UI polish | Done — dashboard live refresh, sign-in error, branch shell |

## Customer side

| Requirement | Status |
|-------------|--------|
| Full menu | Admin CRUD + `npm run import:menu` CSV import |
| Guest checkout + tracking | Done — track polling + footer links |
| User account (optional) | Done — `/account` dashboard |

## Account features

| Feature | Status |
|---------|--------|
| Order history | `/account/orders` |
| Reorder | API + button repopulates cart |
| Saved addresses | `/account/addresses` |
| Profile | `/account/profile` (Clerk UserProfile) |
| Loyalty / rewards | `/account/rewards` — points on Completed orders |
| Marketing coupons | Promo codes in cart + `npm run seed:promos` |

## Ops / go-live (Phase A)

| Item | Artifact |
|------|----------|
| Go-live checklist | [go-live-checklist.md](./go-live-checklist.md) |
| Smoke tests | `npm run smoke:test` |
| Menu import | `npm run import:menu scripts/menu-import-template.csv` |
| Vercel / Clerk / Stripe prod | Manual — see checklists |

## New API routes

- `POST /api/store/[slug]/upsells` — admin-configured cart upsells
- `POST /api/promo/validate` — promo code validation
- `GET /api/account/orders` — signed-in order history
- `GET /api/account/orders/[id]/reorder` — reorder cart payload
- `GET|POST /api/account/addresses` — saved addresses
- `GET /api/account/loyalty` — rewards balance

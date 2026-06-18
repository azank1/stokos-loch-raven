Here's the full handoff report. You can copy this directly to share with the developer.

---

# Stoko's Web Ordering System — Developer Handoff Report

**Repo:** `github.com/azank1/stokos-loch-raven`
**Stack:** Next.js 16.2.4 (App Router) · React 19 · MongoDB/Mongoose · Stripe · Clerk · Zustand · Tailwind CSS
**Deployment:** Vercel **Bayent Labs** team — auto-deploys from `azank1/stokos-loch-raven` `main`

---

## Part 1 — What Was Built & Fixed (This Session)

### Core System (Pre-existing, built by prior dev)
- Full customer menu browsing (`/store/[slug]`) for 3 branches: Towson, York, Liberty
- Cart with Zustand, modifiers, sizes, toppings, sauces, special notes
- Stripe Checkout integration with delivery fee + tax per store
- Order persistence to MongoDB at checkout (before payment)
- Stripe webhook (`/api/webhooks/stripe`) confirms payment → sets `status: Confirmed`, `paymentStatus: paid`
- Success page fallback (marks order paid if webhook hasn't fired yet)
- Guest order tracking (`/track`) by order number
- Admin dashboard (`/admin`) with menu management, store management, order queue

---

### Session Fixes & Improvements

#### Auth & Security
| Change | File |
|---|---|
| Fixed `ADMIN_EMAILS` allowlist — `sessionClaims.email` is undefined in Clerk v7 by default; added `clerkClient` fallback to fetch email from Clerk API | `proxy.ts` |
| Removed self-service admin sign-up — `/admin/sign-up` now redirects to sign-in; admins provisioned via Clerk Dashboard | `app/admin/sign-up/page.tsx` |
| Fixed sign-in page rendering inside the admin shell (sidebar/header was wrapping the login form) | `app/admin/components/adminshell.tsx` |
| Removed dev origins (`ngrok`, internal IPs) from `next.config.ts` | `next.config.ts` |

#### Admin Dashboard
| Change | File |
|---|---|
| Added shared `BranchContext` — branch selector in sidebar drives both Dashboard stats and Orders queue simultaneously | `app/admin/context/branch.tsx`, `adminshell.tsx`, `adminsidebar.tsx`, `orderdashboard.tsx`, `page.tsx` |
| Branch pills (All · Towson · Baltimore—York · Liberty) replace the static store card in sidebar | `app/admin/components/adminsidebar.tsx` |
| Cancel button changed from `→ Cancelled` to `✕ Cancel Order` — visually distinct from status-advance actions | `app/admin/components/orderdashboard.tsx` |
| Blocking confirm dialog before any cancellation; paid orders show explicit refund warning with amount | `app/admin/components/orderdashboard.tsx` |
| Unpaid/abandoned checkout orders are dimmed with a yellow "Awaiting Payment" badge in the order list | `app/admin/components/orderdashboard.tsx` |
| Payment status chip in order detail is now colour-coded: ✓ Paid (green), ⏳ Awaiting Payment (yellow), ✕ Failed (red) | `app/admin/components/orderdashboard.tsx` |

#### Customer-Facing Site
| Change | File |
|---|---|
| Added subtle "Staff Login" link in the bottom bar of both footers (`mainfooter.tsx`, `footer.tsx`) so stokos staff can reach `/admin/sign-in` from any page | `components/mainwebsite/mainfooter.tsx`, `components/footer.tsx` |

---

## Part 2 — Pending Production Tasks (For Developer)

### P0 — Must complete before client onboarding

#### 1. Clerk Production Instance
**Problem:** App is running on a Clerk **development** instance (`pk_test_`). Dev instances throttle OTP emails, can't use custom sending domains, and aren't suitable for real customers or staff.

**Task:**
- Client needs to purchase a domain (e.g. `stokos.com`)
- Create Clerk **production** instance → add domain → complete DNS setup (Clerk provides MX + TXT records)
- In Clerk Dashboard → Configure → Sessions → Customize session token → add `{ "email": "{{user.primary_email_address}}" }` *(already done on dev instance, must be repeated on prod)*
- Generate `pk_live_` / `sk_live_` keys → update in Vercel env vars
- Create admin user accounts in Clerk Dashboard → Users (do not use sign-up page)
- Update `ADMIN_EMAILS` in Vercel env to comma-separated list of stokos staff emails

#### 2. Stripe Live Mode
**Problem:** Stripe is in test mode (`sk_test_`). No real payments can be taken.

**Task:**
- Client activates their Stripe account (complete business verification)
- Switch to live keys: `sk_live_` / `pk_live_` (Stripe Dashboard → Developers → API Keys)
- Create a new Stripe webhook pointing to the **production** Vercel URL: `https://yourdomain.com/api/webhooks/stripe` → event: `checkout.session.completed`
- Copy the new `STRIPE_WEBHOOK_SECRET` (`whsec_live_...`) into Vercel env vars
- Remove/replace all Stripe test keys in Vercel

#### 3. Stripe Connect Express (Platform Fee)
**Status:** Code implemented in `app/api/checkout/route.ts` — activates when `STRIPE_CONNECT_ACCOUNT_ID` is set. Uses `STRIPE_PLATFORM_FEE_PERCENT` for agency fee. Without Connect env vars, checkout runs in direct mode (local dev only).

**Abassi tasks:** See [abassi-stripe-checklist.md](./abassi-stripe-checklist.md)

**Task:**
- Create a **Stripe Connect Express** platform under the agency Stripe account
- Create Stokos connected account; client completes bank onboarding via Account Link
- Set in Vercel: `STRIPE_CONNECT_ACCOUNT_ID`, `STRIPE_PLATFORM_FEE_PERCENT`, live keys, webhook secret

#### 4. MongoDB Production Database
**Abassi tasks:** See [abassi-mongodb-checklist.md](./abassi-mongodb-checklist.md)

**Task:**
- Confirm `MONGODB_URI` in Vercel points to a **production Atlas cluster** (not a shared/free tier for a live product — use M10 or above)
- Enable Atlas backups
- Add text index on orders for better search performance:
  ```js
  db.orders.createIndex({ orderNumber: "text", customerName: "text", customerEmail: "text" })
  ```

---

### P1 — Important before heavy traffic

#### 5. `ADMIN_EMAILS` Enforcement Audit
Verify the Clerk session token customization is active in the **production** Clerk instance and that the `ADMIN_EMAILS` env var is set correctly. Test that:
- An allowed email reaches `/admin`
- A non-allowed email is redirected to `/admin/sign-in?error=unauthorized`
- A signed-out user is redirected to `/admin/sign-in`

#### 6. Order Notification System
**Problem:** Admin staff currently rely on a 15-second polling interval to see new orders. No push notification or audio alert.

**Options (pick one):**
- **Simple:** Add a browser `Notification` API alert + audio ping when a new order appears in the poll (`useEffect` comparing previous order count)
- **Better:** Add Pusher or Ably for real-time WebSocket push to the admin dashboard
- **Best:** Add email/SMS notification to staff on new confirmed order (use Resend or Twilio in the webhook handler)

#### 7. Order Refund Flow in Admin
**Problem:** Cancelling a paid order shows a warning but does nothing in Stripe — the refund must be done manually.

**Partial:** `stripePaymentIntentId` is now stored on orders via the Stripe webhook (ready for refund route).

**Task:**
- Add a `POST /api/admin/orders/[id]/refund` route that calls `stripe.refunds.create({ payment_intent: order.stripePaymentIntentId })`
- Store `stripePaymentIntentId` on the Order model (retrieve it from the Stripe session in the webhook) — **done**
- In the admin cancel dialog, add a "Cancel + Refund" button that calls the refund route before setting status to Cancelled

#### 8. Admin User Management Page
**Problem:** Adding/removing admin staff currently requires direct access to the Clerk Dashboard. Clients shouldn't need to log into Clerk.

**Task:**
- Add an `/admin/staff` page that lists users from Clerk via `clerkClient.users.getUserList()`
- Allow adding a new admin by email (calls `clerkClient.users.createUser(...)`)
- Allow removing admin access by removing from `ADMIN_EMAILS` or deleting the Clerk user

---

### P2 — Nice to have before client demo

#### 9. Order Export (CSV)
Add a "Export" button to `/admin/orders` that downloads the current filtered order list as a CSV (order number, customer, store, amount, status, date).

#### 10. Date Range Filter on Orders
The orders page currently has no date filter. Add a date range picker so admins can view orders for a specific day/week.

#### 11. Dashboard Revenue Charts
The dashboard shows flat stat cards. Adding a simple 7-day revenue line chart (using Recharts, already available in the stack) would give the client at-a-glance business health.

#### 12. Customer Order History (Optional)
Currently all ordering is guest-only. If the client wants to offer loyalty or repeat-order features, Clerk's customer accounts can be extended to the store side and linked to order history by `customerEmail`.

---

## Part 3 — Client Onboarding Plan (After P0 Tasks Complete)

Once the developer completes P0:

1. **Domain purchase** — client buys `stokos.com` (or similar) and points it to Vercel
2. **Clerk production keys** — developer sets up production Clerk instance on the client's domain
3. **Stripe live activation** — client completes Stripe business verification; developer switches keys
4. **Staff accounts** — developer creates Clerk accounts for each stokos manager (Towson, York, Liberty each get their own login)
5. **Test order** — place one real $1 test order end-to-end, confirm it appears in `/admin/orders` as Confirmed/Paid
6. **Handoff call** — walk client staff through: Staff Login → branch selection → viewing orders → advancing order status → cancellation flow
7. **Monitor** — watch Vercel logs and Stripe webhook delivery for first 48 hours

---

**Repo:** `github.com/azank1/stokos-loch-raven`  
**Vercel:** **Bayent Labs** team (`bayentlabs`), connected to `azank1/stokos-loch-raven` (`main` auto-deploys)  
**Deployment URL:** `https://stokos-loch-raven-git-main-bayentlabs.vercel.app`  
**Team alias:** `https://stokos-loch-raven-bayentlabs.vercel.app` (assign as Production domain in Vercel if preferred)  
**Legacy URL:** `https://stokos-loch-raven.vercel.app` — separate/old project; not the active Bayent Labs deploy
**Staff Login entry point:** Footer of any page → "Staff Login"

**Note:** Bayent Labs deployments currently return **401** to unauthenticated requests (Vercel Deployment Protection). For public QA and Stripe webhooks, either disable protection on **Production** or use a production domain with protection off.

---

## Part 4 — Production Readiness (Roles, Phases, QA)

### Ownership matrix

| Owner | Responsibility |
|-------|----------------|
| **Azan** | Vercel, Clerk prod, `ADMIN_EMAILS`, QA sign-off, client handoff |
| **Abassi** | MongoDB Atlas prod, Stripe Connect Express, webhooks, live payment keys |
| **Stokos** | Stripe bank onboarding link, staff emails, optional domain purchase |

**Deploy repo for Vercel:** `github.com/azank1/stokos-loch-raven` — push to `main` on origin; Vercel auto-deploys from the **azank1** Vercel project (not zaygitup).

### Phase documents

| Phase | Document |
|-------|----------|
| Vercel env vars | [vercel-env-checklist.md](./vercel-env-checklist.md) |
| MongoDB (Abassi) | [abassi-mongodb-checklist.md](./abassi-mongodb-checklist.md) |
| Stripe Connect (Abassi) | [abassi-stripe-checklist.md](./abassi-stripe-checklist.md) |
| Clerk + Vercel (Azan) | [azan-clerk-vercel-checklist.md](./azan-clerk-vercel-checklist.md) |
| System QA | [qa-checklist.md](./qa-checklist.md) |
| Client handoff | [client-onboarding.md](./client-onboarding.md) |

### Suggested timeline

| Week | Focus |
|------|-------|
| 1 | Align team; Abassi staging Atlas; verify Vercel deploy |
| 2 | MongoDB prod migration; Stripe Connect test mode |
| 3 | Clerk prod; full Vercel env; QA on staging |
| 4 | Stokos bank onboarding; live $1 test; go-live |

### Monthly maintenance

| Task | Azan | Abassi |
|------|------|--------|
| Vercel deploys / env | ✓ | |
| Clerk staff accounts | ✓ | |
| App fixes / features | ✓ | |
| Atlas backups / scaling | | ✓ |
| Stripe webhooks / Connect | | ✓ |
| Menu DB issues | support | ✓ |
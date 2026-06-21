# Quality assurance

Run on staging or preview with **test** Stripe keys before promoting configuration to production. Repeat critical paths on production after live keys are configured.

Record pass/fail, tester, date, and environment URL for each release.

## Automated smoke test

```bash
npm run smoke:test
```

Against a deployed URL:

```bash
SMOKE_BASE_URL=https://<your-deploy-url> npm run smoke:test
```

## Customer flow

- [ ] Menu loads: `/store/towson`, `/store/york`, `/store/liberty`
- [ ] Add items with modifiers, size, toppings, and notes
- [ ] Pickup vs delivery; delivery requires address
- [ ] Minimum order enforced when configured on store
- [ ] Tax and delivery fee visible in cart and checkout
- [ ] Stripe Checkout completes (test card `4242 4242 4242 4242`)
- [ ] Success page shows order summary
- [ ] `/track` finds order by order number

## Payments and persistence

- [ ] Webhook marks order **Confirmed / Paid** within ~30 seconds
- [ ] Order appears in `/admin/orders` with correct branch and amounts
- [ ] Abandoned checkout shows **Awaiting Payment** in admin
- [ ] With Connect enabled: Stripe Dashboard shows transfer and application fee

## Admin access

- [ ] Allowlisted email reaches `/admin`
- [ ] Non-allowlisted email sees unauthorized state at `/admin/sign-in`
- [ ] Signed-out user redirects to `/admin/sign-in`
- [ ] Footer staff login link routes to `/admin/sign-in`

## Admin operations

- [ ] Branch filter updates dashboard stats and order queue
- [ ] Status progression: Placed → Confirmed → Preparing → Ready → Completed
- [ ] Cancel unpaid order
- [ ] Cancel paid order surfaces refund warning

## Cross-browser

- [ ] Mobile Chrome and Safari — cart and checkout usable
- [ ] Deployed commit SHA matches intended Git revision

## Production exit criteria

- All staging checks pass with test keys
- Live micro-transaction ($1) and refund verified after live keys are active
- Menu populated for all store locations
- Webhook delivery confirmed in Stripe Dashboard event log

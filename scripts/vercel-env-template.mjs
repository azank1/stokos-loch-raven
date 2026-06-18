#!/usr/bin/env node
/**
 * Print Vercel Production env var template for Phase 2 (TEST QA).
 * Copy values into Vercel → Settings → Environment Variables.
 *
 * Usage: node scripts/vercel-env-template.mjs
 */

const BASE_URL = "https://stokos-loch-raven-git-main-bayentlabs.vercel.app";

console.log(`
# Vercel Production — Phase 2 (Stripe TEST, no Connect yet)
# Paste into Vercel → Project → Settings → Environment Variables

NEXT_PUBLIC_BASE_URL=${BASE_URL}
MONGODB_URI=<from Abassi — prod Atlas URI>
MONGODB_DB=stokos
STRIPE_SECRET_KEY=<from Abassi — sk_test_...>
STRIPE_WEBHOOK_SECRET=<from Abassi — test webhook for ${BASE_URL}/api/webhooks/stripe>
# STRIPE_CONNECT_ACCOUNT_ID=   ← LEAVE UNSET for TEST QA
# STRIPE_PLATFORM_FEE_PERCENT= ← set when Connect goes live
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<Clerk pk_test_ or pk_live_...>
CLERK_SECRET_KEY=<Clerk sk_test_ or sk_live_...>
ADMIN_EMAILS=<manager1@email.com,manager2@email.com>

# Stripe test webhook endpoint:
# ${BASE_URL}/api/webhooks/stripe
# Event: checkout.session.completed

# After setting vars: redeploy Production + disable Deployment Protection
`);

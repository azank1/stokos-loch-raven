#!/usr/bin/env node
/**
 * Session 1 exit check — production must return 200, not 401.
 * Usage: npm run check:session1
 */

const BASE_URL =
  process.env.SMOKE_BASE_URL ||
  "https://stokos-loch-raven-git-main-bayentlabs.vercel.app";

const routes = ["/", "/track", "/admin/sign-in", "/api/store/towson/menu"];

async function check(path) {
  const url = `${BASE_URL.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, { redirect: "manual" });
  const okStatuses =
    path === "/admin/sign-in" ? [200, 307] : [200];
  const ok = okStatuses.includes(res.status);
  return { path, status: res.status, ok };
}

async function main() {
  console.log(`Session 1 check → ${BASE_URL}\n`);

  const results = [];
  for (const path of routes) {
    results.push(await check(path));
  }

  let failed = 0;
  for (const r of results) {
    const mark = r.ok ? "OK" : "FAIL";
    if (!r.ok) failed++;
    console.log(`${mark}  ${r.path} → ${r.status}`);
  }

  if (failed > 0) {
    const all401 = results.every((r) => r.status === 401);
    console.log("");
    if (all401) {
      console.log(
        "All routes return 401 → Vercel Deployment Protection is still ON."
      );
      console.log(
        "Fix: Vercel → Settings → Deployment Protection → disable for Production → redeploy."
      );
    } else {
      console.log("Some routes failed. Check env vars and redeploy.");
    }
    process.exit(1);
  }

  console.log("\nSession 1 PASSED — production is publicly accessible.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

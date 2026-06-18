#!/usr/bin/env node

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";

const routes = [
  { path: "/", expect: [200, 401] },
  { path: "/store/towson", expect: [200, 401] },
  { path: "/store/york", expect: [200, 401] },
  { path: "/store/liberty", expect: [200, 401] },
  { path: "/track", expect: [200, 401] },
  { path: "/admin/sign-in", expect: [200, 307, 401] },
  { path: "/api/store/towson/menu", expect: [200, 401] },
  { path: "/api/store/towson/config", expect: [200, 401] },
];

async function checkRoute({ path, expect }) {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  try {
    const res = await fetch(url, { redirect: "manual" });
    const ok = expect.includes(res.status);
    return { path, status: res.status, ok };
  } catch (error) {
    return { path, status: "ERR", ok: false, error: error.message };
  }
}

async function main() {
  console.log(`Smoke test → ${baseUrl}\n`);

  const results = [];
  for (const route of routes) {
    results.push(await checkRoute(route));
  }

  let failed = 0;
  for (const result of results) {
    const mark = result.ok ? "PASS" : "FAIL";
    if (!result.ok) failed++;
    console.log(`${mark}  ${result.path} → ${result.status}${result.error ? ` (${result.error})` : ""}`);
  }

  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();

import { existsSync } from "node:fs"
import { resolve } from "node:path"

/**
 * Sitewide maintenance mode.
 *
 * ON  when env MAINTENANCE_MODE is "true" / "1" / "on" / "yes"  (needs a restart to change), OR
 *     when the flag file exists (instant, no restart):  <app dir>/MAINTENANCE_ON
 * OFF otherwise.
 *
 * Optional env MAINTENANCE_ETA is shown on the page (e.g. "6:00 PM IST").
 * Everything is read on every request, so no rebuild is ever needed.
 */
const FLAG_FILE = resolve(process.env.MAINTENANCE_FLAG_FILE || "MAINTENANCE_ON")
const ENV_TRUTHY = new Set(["true", "1", "on", "yes"])
const RETRY_AFTER_SECONDS = "600"

export function isMaintenanceMode(): boolean {
  if (ENV_TRUTHY.has((process.env.MAINTENANCE_MODE || "").trim().toLowerCase())) return true
  return existsSync(FLAG_FILE)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function renderPage(eta: string): string {
  const etaBlock = eta
    ? `<p class="eta"><span>Expected back</span><strong>${escapeHtml(eta)}</strong></p>`
    : ""
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Scheduled maintenance | Cargo Care</title>
<style>
  :root { --ink:#0f1b2d; --paper:#f4efe6; --rule:#d9d0bf; --accent:#c2410c; --muted:#5b6475; }
  @media (prefers-color-scheme: dark) {
    :root { --ink:#f1ece2; --paper:#0e1623; --rule:#2a3547; --accent:#fb923c; --muted:#9aa4b5; }
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    background: var(--paper); color: var(--ink);
    font-family: "Inter", ui-sans-serif, system-ui, sans-serif;
    display: grid; place-items: center; padding: 24px;
  }
  main { width: 100%; max-width: 560px; }
  .brand { font-size: 13px; letter-spacing: .18em; text-transform: uppercase; color: var(--muted); }
  .lane { height: 1px; background: var(--rule); margin: 28px 0; position: relative; }
  .lane::after {
    content: ""; position: absolute; left: 0; top: -4px; width: 9px; height: 9px;
    background: var(--accent); border-radius: 50%; animation: sail 5s ease-in-out infinite alternate;
  }
  @keyframes sail { to { transform: translateX(min(520px, 90vw)); } }
  @media (prefers-reduced-motion: reduce) { .lane::after { animation: none; } }
  h1 { font-size: clamp(32px, 7vw, 52px); line-height: 1.05; margin: 0 0 16px; font-weight: 700; letter-spacing: -.02em; }
  p { margin: 0 0 12px; font-size: 16px; line-height: 1.55; color: var(--muted); }
  .eta { display: flex; gap: 12px; align-items: baseline; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--rule); }
  .eta span { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
  .eta strong { font-size: 18px; color: var(--ink); }
  .note { font-size: 13px; margin-top: 28px; }
</style>
</head>
<body>
<main role="main">
  <div class="brand">Cargo Care</div>
  <div class="lane" aria-hidden="true"></div>
  <h1>We&rsquo;re tuning the engines.</h1>
  <p>Cargo Care is down for scheduled maintenance. Your shipment plans, bookings and data are safe.</p>
  <p>Please check back shortly.</p>
  ${etaBlock}
  <p class="note">If this lasts longer than expected, contact your administrator.</p>
</main>
</body>
</html>`
}

/**
 * Called from the root middleware. React Router middleware can only short-circuit by
 * throwing, and a thrown Response is sent to the client as-is, so this always throws:
 *  - /api/*                    -> 503 JSON
 *  - browser page loads        -> 503 self-contained HTML maintenance page
 *  - in-app fetches (client-side navigations / form posts; no "text/html" in Accept)
 *                              -> 204 telling the client router to do a full page load,
 *                                 which then gets the maintenance page, so tabs that were
 *                                 already open land on the screen too
 */
export function throwMaintenance(request: Request): never {
  const url = new URL(request.url)
  const headers = { "Retry-After": RETRY_AFTER_SECONDS, "Cache-Control": "no-store" }

  if (url.pathname.startsWith("/api/")) {
    throw new Response(
      JSON.stringify({ error: "Cargo Care is down for scheduled maintenance. Please try again shortly." }),
      { status: 503, headers: { ...headers, "Content-Type": "application/json" } },
    )
  }

  if (!(request.headers.get("Accept") || "").includes("text/html")) {
    throw new Response(null, {
      status: 204,
      headers: {
        ...headers,
        "X-Remix-Redirect": url.pathname || "/",
        "X-Remix-Status": "302",
        "X-Remix-Reload-Document": "true",
      },
    })
  }

  throw new Response(renderPage((process.env.MAINTENANCE_ETA || "").trim()), {
    status: 503,
    headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
  })
}

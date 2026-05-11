# flujobox

Monorepo. Each top-level directory is a self-contained project with its own
dependencies and tooling. Shared orchestration lives at the root (`Makefile`,
this file).

## Layout

```
flujobox/
├── Makefile          # entry points for common tasks across projects
├── CLAUDE.md         # this file
├── README.md
├── servers/          # docs for long-lived hosts (no code)
│   ├── README.md
│   └── flujobox-dev.md
└── web/              # public site, served by a Cloudflare Worker
    ├── package.json
    ├── wrangler.toml # name = flujobox-web, assets + D1 bindings
    ├── schema.sql    # D1 schema (leads table)
    ├── src/index.js  # Worker entry: /api/lead + env.ASSETS fallback
    └── public/       # static assets served by the Worker
```

New projects go in their own top-level directory (e.g. `api/`, `mobile/`) and
follow the same pattern: self-contained, with its own package manager config,
exposed through targets in the root `Makefile`.

## Conventions

- **Self-contained projects.** Do not hoist dependencies or config to the root.
  Each project installs and runs on its own.
- **Root Makefile is the entry point.** Add a `<project>-<verb>` target for
  every common task (`web-dev`, `web-deploy`, etc). Avoid running `cd` chains
  by hand.
- **Cloudflare Worker naming.** Each Worker uses `flujobox-<project>` as its
  `name` in `wrangler.toml` so deploys don't collide.

## Common commands

```sh
make help           # list targets
make web-install    # install web/ deps
make web-dev        # local dev server (wrangler dev) on http://localhost:8787
make web-deploy     # deploy Worker to Cloudflare
```

## Projects

### web

Static site served by a Cloudflare Worker via [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/).

- **Worker name:** `flujobox-web`
- **Live URL:** https://flujobox.com (also https://www.flujobox.com)
- **Custom Domains:** `flujobox.com` and `www.flujobox.com`, configured as
  `custom_domain` routes in `web/wrangler.toml`. The `flujobox.com` zone must
  exist in the Cloudflare account.
- **`workers.dev` subdomain:** disabled (default once `routes` are set).
- **Wrangler:** v4 (pinned in `web/package.json`)
- **Entry:** `web/src/index.js` — `fetch` handler. `POST /api/lead` writes a
  row to D1 and forwards the payload to n8n; everything else falls back to
  `env.ASSETS.fetch(request)`.
- **Assets:** `web/public/` — files served as-is. `not_found_handling =
  "single-page-application"` means unknown paths fall back to `index.html`.
- **D1 database:** `flujobox-leads`, bound as `env.LEADS_DB`. Schema in
  `web/schema.sql` (single `leads` table). Apply with
  `cd web && npx wrangler d1 execute flujobox-leads --remote --file=schema.sql`.
- **Lead capture flow:** form on `flujobox.com` → `POST /api/lead` →
  `INSERT INTO leads` (D1) + fire-and-forget POST to
  `https://dev.flujobox.com/webhook/lead-capture` (n8n workflow that appends
  to Google Sheets + sends WhatsApp via Twilio).

#### Inspect leads

```sh
cd web && npx wrangler d1 execute flujobox-leads --remote \
  --command="SELECT id, created_at, name, email FROM leads ORDER BY id DESC LIMIT 20;"
```

#### Deploy

```sh
make web-deploy
```

First-time setup requires `npx wrangler login` (interactive, run from `web/`)
and a registered `workers.dev` subdomain on the Cloudflare account.

### servers

Docs-only directory describing the long-lived hosts the project depends on.
One file per host. No deploy logic — if/when we add IaC, it goes in its own
top-level project.

- **`flujobox-dev`** — Ubuntu 24.04 droplet (1 vCPU / 1 GB RAM). Hosts n8n
  for the MVP at https://dev.flujobox.com (n8n in Docker, Caddy on the host
  doing TLS via a Cloudflare Origin Certificate). SSH alias `flujobox-dev`
  (also `flujo-dev`) is configured in `~/.ssh/config`. See
  `servers/flujobox-dev.md` for full notes.

## Automations (n8n)

The n8n instance at https://dev.flujobox.com is the orchestrator for all
recurring tasks and event-driven flows. Workflows are managed through the
n8n UI; the n8n public API (`/api/v1/...`) is used for scripted creation /
updates by agents. The user holds the API key — keep it out of source.

### Credentials configured in n8n

| Name in n8n              | Type                        | Used by                  |
| ------------------------ | --------------------------- | ------------------------ |
| `Google Calendar (Juan)` | `googleCalendarOAuth2Api`   | Daily agenda workflow    |
| `Google Sheets (Juan)`   | `googleSheetsOAuth2Api`     | Lead capture workflow    |
| `Twilio (Juan)`          | `twilioApi` (auth token)    | Both notification flows  |

Google credentials share a single OAuth client created in
`console.cloud.google.com`. The OAuth consent screen is in **Testing** mode;
test users must be added explicitly. The authorized redirect URI is
`https://dev.flujobox.com/rest/oauth2-credential/callback`. APIs that must
stay enabled in the GCP project: Google Calendar API, Google Sheets API.

Twilio uses the **WhatsApp Sandbox**. The sandbox sender is
`+14155238886`; every recipient phone must complete the `join <keyword>`
opt-in (sent over WhatsApp to the sandbox number) before Twilio will
deliver messages to them. Opt-in lapses after ~72h of no inbound traffic
from that number.

### Workflows

#### 1. `Demo cec agenda` — daily Google Calendar → WhatsApp

- **Trigger:** Schedule, every day at 07:00 `America/Montevideo`.
- **Steps:** Google Calendar (`getAll` events for today, primary calendar) →
  Code (format Spanish summary, chunked to ≤1500 chars per WhatsApp) →
  Twilio (send WhatsApp to **+598 99 172 212**, from sandbox `+14155238886`).
- **Notes:** Calendar v1.3 node — `timeMin`/`timeMax` must live at the
  root of `parameters`, not inside `options`. The Code node uses
  `$now.setZone('America/Montevideo')` and a hand-rolled Spanish
  weekday/month table.

#### 2. `Lead capture (flujobox.com)` — webhook → Sheets + WhatsApp

- **Trigger:** Webhook `POST https://dev.flujobox.com/webhook/lead-capture`.
- **Steps:** Google Sheets (`append` row to spreadsheet
  `1YPFOKB3SCFfDubKCWrG9sfo0Ch9FlF6hDhpYDvEGYbE`, tab `Sheet1`, columns
  `timestamp | name | email | ip | userAgent`) → Twilio (WhatsApp
  notification to **+598 92 807 700**).
- **Payload contract:** the Cloudflare Worker sends JSON
  `{ name, email, ip, userAgent, source }`. Expressions in the workflow read
  from `$json.body.<field>`.
- **Caller:** the `flujobox-web` Worker (`POST /api/lead`).

### Operating notes

- Workflows are reachable via the public API with `X-N8N-API-KEY: <token>`,
  base URL `https://dev.flujobox.com/api/v1/`. Useful endpoints:
  `GET /workflows`, `PUT /workflows/{id}`, `POST /workflows/{id}/activate`,
  `POST /credentials`, `GET /credentials/schema/{type}`.
- The public API does **not** expose `GET /credentials` (security). To check
  what credentials exist, look in the n8n UI at
  https://dev.flujobox.com/home/credentials.
- After editing a workflow that uses a community/custom node, the node must
  already be installed on the n8n instance. The ChatArchitect WhatsApp node
  (`@chatarchitect/n8n-nodes-chatarchitectcom-for-whatsapp`) was installed
  earlier and is unused; Twilio replaced it.
- Twilio WhatsApp messages are capped at 1600 chars. The agenda workflow
  chunks proactively; any new flow that emits large content must do the
  same.

## Working in this repo (for agents)

- Always run common tasks through `make` from the repo root, not by `cd`-ing
  into project dirs and invoking npm scripts.
- When adding a new top-level project, update both this file and `README.md`
  (project table + layout block) so the docs stay in sync.
- Keep `wrangler.toml` `compatibility_date` current when bumping wrangler.

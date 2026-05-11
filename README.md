# flujobox

Monorepo. Each top-level directory is a self-contained project. Shared
orchestration lives at the root (`Makefile`, `CLAUDE.md`).

## Projects

| Path       | Description                                            | Live URL              |
| ---------- | ------------------------------------------------------ | --------------------- |
| `web/`     | Public site, served by a Cloudflare Worker             | https://flujobox.com  |
| `servers/` | Docs for long-lived hosts (e.g. `flujobox-dev` / n8n)  | —                     |

## Quick start

```sh
make help           # list available targets
make web-install    # install web/ deps
make web-dev        # run web/ locally on http://localhost:8787
make web-deploy     # deploy web/ Worker to Cloudflare
```

## Repo layout

```
flujobox/
├── Makefile          # entry points for common tasks across projects
├── CLAUDE.md         # contributor / agent guidelines
├── README.md         # this file
├── servers/          # ops docs for long-lived hosts (no code)
│   ├── README.md
│   └── flujobox-dev.md
└── web/              # static site served by a Cloudflare Worker
    ├── package.json
    ├── wrangler.toml # name = flujobox-web, assets dir = ./public
    ├── src/index.js  # Worker entry; delegates to env.ASSETS
    └── public/       # static assets served by the Worker
```

## Adding a new project

1. Create a top-level directory (e.g. `api/`) with its own package manager
   config — do **not** hoist deps to the root.
2. If it's a Cloudflare Worker, name it `flujobox-<project>` in its
   `wrangler.toml`.
3. Expose its common tasks through the root `Makefile` as
   `<project>-<verb>` targets (e.g. `api-dev`, `api-deploy`).

## Cloudflare deploy (web)

The `web/` Worker uses [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/):
`web/src/index.js` handles `POST /api/lead` (writes to D1 and forwards to
n8n) and delegates everything else to `env.ASSETS`, which serves files from
`web/public/`.

First-time setup:

```sh
make web-install
cd web && npx wrangler login         # authenticate with Cloudflare (interactive)
# Register a workers.dev subdomain in the Cloudflare dashboard if you haven't:
# https://dash.cloudflare.com/?to=/:account/workers/onboarding
```

Then `make web-deploy` from the repo root for any subsequent release.

### Lead capture

The home-page CTA form submits to `POST /api/lead`. The Worker:

1. Inserts a row into the `flujobox-leads` D1 database (`leads` table).
2. Fires a `POST` to the n8n webhook
   `https://dev.flujobox.com/webhook/lead-capture` (fire-and-forget via
   `ctx.waitUntil`); the workflow appends the lead to a Google Sheet and
   sends a WhatsApp notification via Twilio.

Schema for the `leads` table lives in `web/schema.sql`. Inspect leads with:

```sh
cd web && npx wrangler d1 execute flujobox-leads --remote \
  --command="SELECT id, created_at, name, email FROM leads ORDER BY id DESC LIMIT 20;"
```

## Automations (n8n)

A self-hosted n8n at https://dev.flujobox.com runs the recurring jobs and
event-driven flows. The instance and its host are documented in
`servers/flujobox-dev.md`. Detailed credential / workflow notes for agents
are in `CLAUDE.md`.

### Active workflows

| Workflow                       | Trigger                       | What it does                                                                                                       |
| ------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `Demo cec agenda`              | Every day 07:00 UTC-3         | Reads today's events from Google Calendar (primary) and sends them as a WhatsApp summary to **+598 99 172 212**.   |
| `Lead capture (flujobox.com)`  | Webhook `POST /lead-capture`  | Appends the lead to the `flujobox leads` Google Sheet and notifies **+598 92 807 700** via WhatsApp.               |

### Shared services

- **Google OAuth** — single client in Google Cloud (Testing mode). Used by
  both Calendar and Sheets credentials in n8n. Authorized redirect URI:
  `https://dev.flujobox.com/rest/oauth2-credential/callback`. The
  Calendar API and Sheets API must remain enabled in the project.
- **Twilio WhatsApp Sandbox** — sender `+14155238886`. Each recipient must
  send `join <keyword>` once (and at least every ~72h while no inbound
  messages flow) for Twilio to deliver. Sandbox is fine for the MVP; switch
  to a productive WhatsApp sender before launch.
- **n8n public API** — `https://dev.flujobox.com/api/v1/`. Auth header
  `X-N8N-API-KEY`. Used to script workflow / credential changes; treat the
  token as a secret.

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
the Worker entry (`web/src/index.js`) just delegates to the `ASSETS` binding,
which serves files from `web/public/`.

First-time setup:

```sh
make web-install
cd web && npx wrangler login         # authenticate with Cloudflare (interactive)
# Register a workers.dev subdomain in the Cloudflare dashboard if you haven't:
# https://dash.cloudflare.com/?to=/:account/workers/onboarding
```

Then `make web-deploy` from the repo root for any subsequent release.

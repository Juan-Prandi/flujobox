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
    ├── wrangler.toml # name = flujobox-web, assets dir = ./public
    ├── src/index.js  # Worker entry; delegates to env.ASSETS
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
- **Entry:** `web/src/index.js` — single `fetch` handler that delegates to
  `env.ASSETS.fetch(request)`. Add server-side logic here when needed.
- **Assets:** `web/public/` — files served as-is. `not_found_handling =
  "single-page-application"` means unknown paths fall back to `index.html`.

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

## Working in this repo (for agents)

- Always run common tasks through `make` from the repo root, not by `cd`-ing
  into project dirs and invoking npm scripts.
- When adding a new top-level project, update both this file and `README.md`
  (project table + layout block) so the docs stay in sync.
- Keep `wrangler.toml` `compatibility_date` current when bumping wrangler.

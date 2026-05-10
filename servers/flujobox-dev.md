# flujobox-dev

Dev / MVP server. Hosts n8n for the startup MVP workflows.

## Access

```sh
ssh flujobox-dev
```

SSH alias is configured in `~/.ssh/config`:

```
Host flujo-dev flujobox-dev
    HostName 159.223.136.155
    User root
    Port 22
    IdentityFile ~/.ssh/id_ed25519
```

- **Login user:** `root` (key-based; password auth should stay disabled).
- **Provider:** DigitalOcean droplet (inferred from `159.223.0.0/16` range).

## Specs

| | |
| --- | --- |
| OS       | Ubuntu 24.04.3 LTS (Noble) |
| Kernel   | 6.8.0-71-generic           |
| Arch     | x86_64                     |
| vCPU     | 1                          |
| RAM      | 1 GB                       |
| Disk     | 24 GB (`/dev/vda1`)        |
| Hostname | `flujo-dev-001`            |

> **Heads-up:** 1 GB RAM is tight for n8n under load. Fine for MVP traffic;
> revisit if workflow execution starts OOM-ing.

## What runs here

- **n8n** — workflow automation, MVP backend. Container `n8n`
  (`docker.n8n.io/n8nio/n8n`), restart policy `unless-stopped`, listening on
  `127.0.0.1:5678`.
- **Caddy** — host-installed (systemd unit `caddy.service`, enabled),
  reverse proxy with TLS termination on ports 80/443.

Public URL: **https://dev.flujobox.com**

## Current setup

### n8n (Docker)

Started with `docker run` (no compose file at the moment — single container,
fine for now):

| | |
| --- | --- |
| Image    | `docker.n8n.io/n8nio/n8n`      |
| Restart  | `unless-stopped`               |
| Port     | `127.0.0.1:5678 -> 5678/tcp` (bound to loopback; only Caddy reaches it) |
| Volume   | named volume `n8n_data` mounted at `/home/node/.n8n` |

Env (relevant):

```
N8N_HOST=dev.flujobox.com
N8N_PROTOCOL=https
N8N_PORT=5678
WEBHOOK_URL=https://dev.flujobox.com/
N8N_PROXY_HOPS=1
```

### Caddy (host)

`/etc/caddy/Caddyfile`:

```
dev.flujobox.com {
    tls /etc/ssl/flujobox/origin.pem /etc/ssl/flujobox/origin.key
    encode gzip
    reverse_proxy 127.0.0.1:5678
}
```

TLS uses a **Cloudflare Origin Certificate** (not Let's Encrypt) at
`/etc/ssl/flujobox/origin.{pem,key}` (mode `640`, group `caddy`). This means
the Cloudflare orange cloud is **proxied ON** for `dev.flujobox.com` — set
SSL/TLS mode to **Full (strict)** in the Cloudflare zone.

Reload Caddy after edits:

```sh
sudo systemctl reload caddy
```

### DNS

`dev.flujobox.com` → A record to `159.223.136.155`, proxied through
Cloudflare (orange cloud ON).

## Operations

```sh
# logs
ssh flujobox-dev 'docker logs -f --tail 200 n8n'

# restart n8n
ssh flujobox-dev 'docker restart n8n'

# upgrade n8n
ssh flujobox-dev 'docker pull docker.n8n.io/n8nio/n8n && docker rm -f n8n && \
  docker run -d --name n8n --restart unless-stopped \
  -p 127.0.0.1:5678:5678 -v n8n_data:/home/node/.n8n \
  -e N8N_HOST=dev.flujobox.com -e N8N_PROTOCOL=https -e N8N_PORT=5678 \
  -e WEBHOOK_URL=https://dev.flujobox.com/ -e N8N_PROXY_HOPS=1 \
  docker.n8n.io/n8nio/n8n'
```

> If the run command grows, migrate to a `docker-compose.yml` under
> `/opt/n8n/` so the spec lives in a file.

## Backups

Not yet configured. Plan:

- Periodic snapshot of the `n8n_data` Docker volume (workflows, credentials,
  SQLite DB) — e.g. nightly `docker run --rm -v n8n_data:/data -v
  /var/backups/n8n:/backup alpine tar czf /backup/n8n-$(date +%F).tgz -C
  /data .`, plus offsite copy.
- DigitalOcean weekly droplet snapshots as a safety net.
- Optional: `docker exec n8n n8n export:workflow --all --output=...` to
  source-control workflow JSON.

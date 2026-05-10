# servers

Operational notes for the long-lived hosts the project depends on. Each file
here describes a single server: how to reach it, what runs on it, and how it
is provisioned.

This directory is documentation only — there is no code to deploy from it.
Infrastructure-as-code (if/when we add Terraform, Ansible, etc.) goes in a
separate top-level project.

## Hosts

| Alias          | Host            | Purpose                                                           |
| -------------- | --------------- | ----------------------------------------------------------------- |
| `flujobox-dev` | `flujo-dev-001` | Dev/MVP box — runs n8n at https://dev.flujobox.com (Docker + Caddy) |

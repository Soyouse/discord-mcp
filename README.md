# discord-mcp

**An MCP server that lets an AI agent drive Discord bots as reliably as a human drives the client — and an alternative Discord web client built on the same core.**

Full REST coverage, multi-bot, concurrency-hardened. The MCP surface is the plumbing; the north star is a Discord-like web cockpit (chat, DMs, user list, broadcasts) that both humans and agents operate through the same `lib/core`.

## Design

- **Raw pass-through, nothing capped.** `discord_call` forwards `method / endpoint / payload / bot` straight to the API — the catalog is self-documentation, never a gate.
- **Multi-bot multiplexer.** One REST client *per token* (Discord rate-limits per token), hot-reloaded from disk. Bot identity is proven via `GET /users/@me` before any switch commits.
- **Session-scoped state.** The active bot lives per MCP session, never in a process-global — so concurrent HTTP agents can't leak state into each other (per the MCP spec: no implicit per-connection state).
- **IP-safety monitor.** Discord's invalid-request limit (401/403/429) is *per-IP* — one misbehaving bot bans the whole IP. A rate-monitor flags this before it happens.
- **Two-container history relay.** A separate daemon ingests the gateway into Postgres (write side); the MCP only reads. Coupled by Postgres alone, zero IPC, exactly-once via snowflake PK.
- **Sister web client.** `web/` + `front/` (React 19 / Vite / Tailwind / Socket.IO) read the relay and act through `lib/core` — never a second gateway, never touching Discord directly. One core, N faces.

## Tools

| Tool | Purpose |
|------|---------|
| `discord_call` | Raw REST pass-through (any endpoint) |
| `discord_discover` | Self-documenting endpoint catalog |
| `discord_switch_bot` | Switch active bot (identity-proven) |
| `discord_health` | Bots + 401/403/429 window |
| `discord_history` / `discord_search` | Read from the history relay (no REST) |

## Transports

- **stdio** — local use (`npm start`)
- **HTTP** — StreamableHTTP for a remote 24/7 service (`npm run start:http`): binds `127.0.0.1`, constant-time Bearer auth (refuses to boot without it), DNS-rebind protection, one transport per session. Exposed over a Tailscale tunnel only.

## Stack

Node ≥22, ESM. `@discordjs/{core,rest,ws}` · Fastify · Socket.IO · Postgres (`pg`) · ajv.
**Testing:** Vitest (unit) + Stryker (mutation, ratcheted gate at 80%) + Playwright (front E2E), wired into Husky pre-commit/pre-push. I/O is excluded from mutation; pure decision logic is fully mutated.

## Quick start

```bash
npm install
cp .secrets.example.json .secrets.json   # add your bot token(s)
npm start            # stdio
npm run start:http   # HTTP service
```

Secrets shape: `{ default, bots: { <id>: { token, application_id } } }` — never committed (`.gitignore`).

---
<sub>Part of a set of home-built MCP servers. Built to be driven by an agent, hardened for concurrency.</sub>

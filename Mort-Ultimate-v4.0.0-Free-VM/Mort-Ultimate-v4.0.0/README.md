# Mort Ultimate v4.0.0

**Mort Ultimate** is a production-hardened Discord.js v14 community bot for structured server setup, verification, moderation, tickets, safety automation, XP, a fake-coin economy, and member support.

> **Important:** Mort stores state in one JSON file. Use one bot replica and mount durable storage in production. It is not designed for horizontally scaled, multi-replica writes; use a transactional database before scaling beyond a single process.

## What changed in v4

- Closed privilege-escalation paths in auto-roles, reaction roles, moderation, ticket claims, backups, and anti-nuke configuration.
- Added **exact permission snapshots** for `/raid panic` so unlock restores prior channel rules instead of making read-only channels writable.
- Made `/remind set` persistent across redeploys, with `/remind list` and `/remind cancel`.
- Added runtime environment validation, liveness/readiness probes, graceful fatal shutdown, state normalization, safer atomic writes, and bounded in-memory trackers.
- Scoped downloadable backups to **one server only**, put them beside `DATA_FILE`, and restricted them to the guild/configured owner.
- Updated Discord.js and Undici to an audited dependency set; `npm audit --omit=dev` is clean at release time.
- Added source/container secret exclusions, a non-secret `.env.example`, and expanded automated tests.

## Requirements

| Requirement | Version / setting |
|---|---|
| Node.js | `>=20 <23` |
| Discord intents | **Server Members**, **Message Content**, and **Moderation** gateway access |
| Bot permissions | Least privilege: Manage Roles, Manage Channels, Manage Messages, Moderate Members, Kick Members, Ban Members, View Audit Log, Read/Send Messages, Embed Links, Attach Files, Read History, Add Reactions, Connect/Speak/Move Members |
| Storage | Durable mounted path in production, e.g. `/data/mort-memory.json` |

Do **not** grant Administrator unless you explicitly accept that risk. Mort reports missing capabilities through `/mort doctor` and `/mort permissions`.

## Quick start

```bash
cp .env.example .env
# Fill in DISCORD_TOKEN and CLIENT_ID in .env
npm ci
npm run check
npm test
npm run doctor
```

Register commands deliberately rather than on every reboot:

```bash
# Optional but recommended for rapid testing in one server:
# add GUILD_ID=your_test_server_id to .env
npm run register
npm start
```

`AUTO_REGISTER_COMMANDS` defaults to `false`. Set it to `true` only when intentionally registering commands during startup.

## Environment

Start with [`.env.example`](.env.example). The minimal configuration is:

```env
DISCORD_TOKEN=replace_with_your_bot_token
CLIENT_ID=replace_with_your_discord_application_id
DATA_FILE=./data/mort-memory.json
```

For production ownership controls, set `OWNER_IDS` to a comma-separated list of Discord user IDs. The server owner is always authorized for sensitive per-server actions; configured owners are useful for operational access.

Never commit `.env`, runtime `data/`, or backups. The included `.gitignore` and `.dockerignore` exclude them by default.

## Deploying on an always-on free-tier VM

Mort uses Discord’s persistent Gateway connection and needs one process running continuously. **Vercel serverless functions are not the deployment target for this full-featured release.** The included step-by-step [free VM deployment guide](FREE_VM_DEPLOY_GUIDE.md) sets up Ubuntu + systemd; the detailed [Oracle Cloud Always Free guide](hosting/ORACLE_ALWAYS_FREE_SETUP.md) is one possible VM provider.

Oracle’s current published Always Free compute allowance is limited (up to 2 OCPUs and 12 GB RAM across A1 instances), with regional capacity constraints. Oracle may reclaim an Always Free VM that meets its published idle criteria for a 7-day period; a low-traffic Discord bot can be affected. Signup may require a payment card for identity verification. Use only resources explicitly labeled **Always Free**, check the account’s usage/billing page, and do not upgrade to a paid account if your requirement is zero spend. Eligibility and capacity are not guaranteed. See the [official Always Free compute limits](https://docs.oracle.com/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) and [Oracle’s Free Tier FAQ](https://www.oracle.com/cloud/free/faq/).

If you can’t get an eligible VM or can’t accept idle reclamation, the included [free hosting guide](docs/FREE_HOSTING_GUIDE.md) covers the practical $0 fallback of hardware you already own. Avoid sleeping serverless/web hosts for the full Gateway bot.

The VM guide uses a durable local state file at `/opt/mort/data/mort-memory.json`; configure only SSH ingress and leave the health endpoint private. Register Discord commands once with `npm run register`; startup registration stays off by default.

## First server setup

Run these as a server manager after Mort is online:

```text
/setup server
/setup permissions
/verify status
/mort dashboard
/security antinuke status
```

Move Mort’s bot role above every role it needs to manage: the verification roles, moderation roles, the safe auto-role, and self-assignable reaction roles.

## Command map

| Area | Key commands |
|---|---|
| Setup & diagnostics | `/setup`, `/mort`, `/verify`, `/panel`, `/features` |
| Moderation | `/mod`, `/automod`, `/logs`, `/security`, `/raid` |
| Support | `/ticket`, `/remind`, `/community`, `/welcome` |
| Member tools | `/avatar`, `/fun`, `/meme`, `/poll`, `/giveaway`, `/stats`, `/embed` |
| Growth & economy | `/level`, `/economy`, `/balance`, `/work`, `/starboard`, `/reactionrole` |
| Server utilities | `/voice`, `/private`, `/backup`, `/cloud` |

All commands are guild-only. Mort validates the caller’s runtime permission for each sensitive action; Discord command defaults alone are not trusted.

## Security behavior

- **Auto-role:** only the server owner or a configured owner can select it; Mort rejects `@everyone`, managed roles, unmanageable roles, and roles with moderation/server-management permissions.
- **Reaction roles:** Mort only honors panels it created and recorded, and only for safe non-privileged roles below its own role.
- **Moderation:** each action requires its exact Discord permission and prevents moderators from targeting equal/higher roles, themselves, bots, or the server owner.
- **Tickets:** opening is concurrency-protected and rate-limited on both slash and panel paths; only staff can claim/release tickets.
- **Backups:** contain only the current server’s Mort state, not data from other servers.
- **Anti-nuke:** configuration is owner-gated. Keep the bot role high enough to take action against the accounts you expect it to protect against.

## Quality gates

```bash
npm run check       # JavaScript syntax checks
npm test            # node:test suite
npm run audit       # production dependency audit
npm run verify      # all of the above
```

## Health and operations

- `GET /health` — process liveness; returns 200 while the process runs.
- `GET /ready` — Discord readiness; returns 200 only after gateway readiness, otherwise 503.
- `GET /status` — liveness payload compatible with lightweight monitors.

The process exits non-zero after an uncaught exception/rejection so the host can restart it. Review `/mort insights` and deployment logs after any restart.

## Data and backups

The JSON state includes guild configuration, tickets, warnings, XP, fake economy, reminders, and insights. `/backup create` makes a private guild-scoped export under `DATA_FILE`’s directory. Treat every backup as sensitive because it can contain moderation and ticket metadata.

## License

MIT

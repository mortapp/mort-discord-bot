# Prompts for Other AIs to Improve Mort

Use these prompts in Codex, Cursor, Claude, Windsurf, Replit AI, or another coding assistant. Do not paste your Discord token into any AI prompt.

## Prompt 1 — Full codebase audit
```text
You are auditing a Discord.js v14 bot called Mort Ultimate. Review the entire repository for bugs, security problems, broken slash commands, permission issues, bad async handling, rate-limit risks, and deployment problems. Do not remove existing features. Produce a patch that keeps commands grouped and readable. Prioritize verification gate correctness, role hierarchy safety, idempotent setup/repair, logging, and safe token handling. After edits, run node --check on every JS file and explain every change.
```

## Prompt 2 — Make Mort production-ready
```text
Upgrade Mort Ultimate into a production-ready Discord.js bot. Add structured logging, better error boundaries, command cooldowns, guild-level config validation, permission diagnostics, safer automod false-positive handling, and database-ready storage abstraction. Keep the current JSON storage working, but design a clean adapter interface for SQLite/Postgres later. Do not hard-code secrets. Preserve all commands and add tests or validation scripts where possible.
```

## Prompt 3 — Improve verification/privacy permissions
```text
Focus only on Mort’s verification gate and permission overwrites. Make sure unverified members can only see the verify channel; verified/member roles cannot see the verify channel; staff can still see and manage it; muted users cannot speak/send; private beta/VIP/staff/partner channels remain private. Make /security refresh-perms idempotent and safe. Add a diagnostic report that lists every channel with incorrect overwrites before fixing them.
```

## Prompt 4 — Build a real database version
```text
Convert Mort’s memory system from local JSON to a storage adapter pattern. Keep JSON as default. Add optional SQLite support for local hosting and Postgres support for cloud hosting. The bot should pick storage by env var STORAGE_DRIVER=json|sqlite|postgres. Include migration-safe schemas for guild config, tickets, warnings, XP, feature flags, raid events, backups, and logs. Preserve all existing commands.
```

## Prompt 5 — Add advanced ticket system
```text
Upgrade Mort’s ticket system to support categories, claim/unclaim, transcript export, close reasons, reopen, staff notes, priority levels, user blacklist, cooldowns, ticket limits per user, and ticket logs. Keep it simple for users: buttons should handle open/claim/close. Make transcripts readable Markdown or HTML. Do not leak private ticket contents to public channels.
```

## Prompt 6 — Add anti-raid intelligence safely
```text
Improve Mort’s anti-raid system. Add join-rate detection, account-age warnings, mass-DM warning notes, invite spam detection, mass mention protection, panic lockdown, automatic unlock timer, and clear logs. Avoid unsafe AI claims. The system should assist staff, not ban everyone blindly. Add configurable thresholds through slash commands.
```

## Prompt 7 — Add app-community features
```text
Add Mort app community features: bug report flow, feature request board, roadmap posts, beta tester applications, changelog generator, showcase submissions, partner applications, staff review queues, and user feedback analytics. Keep everything Discord-native with slash commands, buttons, modals, embeds, and private staff queues.
```

## Prompt 8 — Free hosting deployment hardening
```text
Improve Mort deployment for free/low-cost hosting. Add Docker support, PM2 ecosystem config, Oracle Cloud setup notes, Termux setup notes, Render/Koyeb/Fly configs, health endpoints, graceful shutdown, environment validation, and a clear .env.example. Make sure package-lock uses registry.npmjs.org and does not include internal/private registry URLs.
```

## Prompt 9 — Slash command UX cleanup
```text
Review Mort’s slash commands for user experience. Group commands logically, improve descriptions/options, add autocomplete where useful, prevent command spam, make success/error embeds consistent, and ensure all staff-only commands require proper Discord permissions. Do not create hundreds of slash commands; use subcommands and panels.
```

## Prompt 10 — Roadmap execution plan
```text
Read Mort Ultimate’s 1,200-module feature catalog. Pick the top 50 highest-impact modules for a small Discord server and implement them in stages. Stage 1: verification/security/logs. Stage 2: tickets/moderation/automod. Stage 3: app community workflows. Stage 4: analytics/backups/cloud. For every stage, produce code changes, tests/checks, and a rollback plan.
```

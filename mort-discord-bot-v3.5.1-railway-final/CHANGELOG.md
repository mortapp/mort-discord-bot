# Changelog

## 3.5.1
- Updated Railway config to the current `RAILPACK` builder.
- Added `/health` deployment healthcheck configuration.
- Added explicit Railway persistent-volume instructions for JSON-backed XP, economy, tickets, reminders, warnings, and guild configuration.
- Updated Railway variable examples to use `/data/mort-memory.json` when a `/data` volume is mounted.


## v3.5.0 — Hardening Pass

**Fixed**
- Health server (`src/services/healthServer.js`) now binds to `process.env.PORT` immediately at process boot instead of waiting for the Discord `ready` event, and reports a `discord` status (`ready`/`connecting`/`reconnecting`/etc.) rather than a boolean. Previously, Railway's healthcheck had nothing to hit during initial connect or a bad token, which could cause unnecessary restarts.
- Removed a hardcoded fallback Discord Application ID (`1518021714494226695`) from `register-commands.js` and the `/mort about` / `/mort invite` link builder. If `CLIENT_ID` was ever unset, the bot would previously have silently targeted a different Discord application for command registration and invite links. `register-commands.js` now fails with a clear error instead of guessing, and the invite link now reads the live client's own application ID.
- `/ticket open` no longer permanently blocks a user from opening a new ticket if their previous ticket channel was deleted manually (outside of `/ticket close`). Added a `channelDelete` listener that cleans up orphaned ticket/temp-voice/private-room records.
- `src/register-commands.js` now checks for duplicate slash-command names before making any Discord API call, with a clear error naming the offending command(s).
- `@Mort` now also activates when a user replies directly to one of Mort's own messages, not only on an explicit mention.
- Removed an empty, unused `src/commands/music/` directory (no music feature was ever registered or advertised).

**Stability**
- Added periodic cleanup of the in-memory cooldown map (`src/utils/cooldown.js`) and the assistant's per-user mention-cooldown map, so long-running processes don't accumulate unbounded entries.
- Graceful shutdown (`SIGTERM`/`SIGINT`) now also stops the cooldown sweep timer and closes the health server before exiting.

**Testing**
- Added a `node:test` suite (`tests/`) covering `dataStore.js` (default state creation, atomic writes, corrupted-JSON recovery, warning case sequencing, error-log capping) and `cooldown.js`, plus the newly extracted `findDuplicateNames` helper. Run with `npm test`.
- Extracted duplicate-command-name detection into `src/utils/duplicateNames.js` (no `discord.js` dependency) so it's independently testable.

## v3.4.0 — Stability, Assistant, and Server Automation Update

**Major additions**
- Added @mention assistant: members can ask `@Mort how do I verify?`, `@Mort why missing permissions?`, `@Mort tickets?`, `@Mort invite?`, `@Mort Railway?`, and Mort responds with local rule-based help. No paid AI API required.
- Added `/assistant status|enable|disable|channel|cooldown` for staff to control the @mention assistant.
- Added `/mort dashboard`, `/mort permissions`, `/mort emergency-fix`, `/mort stats`, `/mort uptime`, and `/mort about`.
- Expanded `/mort doctor` so it checks both the server blueprint and Mort’s Discord permissions/role hierarchy.
- Added `/verify repair`, `/verify status`, and `/verify reset`.
- Expanded ticket tools: `/ticket claim`, `/ticket rename`, `/ticket add-user`, `/ticket remove-user`, `/ticket transcript`, and `/ticket setup`.
- Expanded moderation tools: `/mod clear`, `/mod slowmode`, `/mod lock`, `/mod unlock`, `/mod userinfo`, and `/mod serverinfo`.
- Added `/economy daily|pay|profile|leaderboard|shop|buy|inventory|gamble` with fake server coins only.
- Added `/fun 8ball|coinflip|dice|choose|quote`, `/avatar`, and `/remind`.

**Stability and Railway**
- Updated package version to 3.4.0 and Node engine to 20.x.
- Improved Railway startup behavior with auto command registration fallback.
- Added clearer token rejection messaging when Discord returns 401/TokenInvalid.
- Added cleaner startup logs with version, Node version, guild count, and command count.
- Added SIGTERM/SIGINT graceful shutdown for Railway restarts.
- Health server now reports v3.4.0 and online/starting status.
- Clean ZIP layout: `package.json` is at root; no nested GitHub folder problem.

**Permission fixes**
- Verify button and manual verify now check role hierarchy before trying to apply roles.
- Mort explains exactly when its role is too low and which roles it cannot manage.
- `/mort permissions` and `/setup permissions` show direct fix instructions.

## v3.2.0 — Bugfix & moderation upgrade
- Fixed balance command syntax.
- Fixed starboard import and duplicate repost behavior.
- Added anti-nuke protection.
- Added warning system and escalation.
- Improved anti-raid, automod, tickets, data storage, and stability handlers.

## v3.1.0 — Ultimate package
- Added cloud hosting docs, AI improvement prompts, concept blueprint, security/token rules, and 1,200-module feature catalog.

## v3.0.0 — Omega
- Added health server, cloud config files, feature catalog, raid tools, backups, logs, and expanded private channels.

## v2.0.1 — Secure
- Updated dependencies and fixed npm audit vulnerabilities.

## v2.0.0 — Mega
- Added strict verification gate, private channels, reaction roles, XP, automod, and expanded server setup.

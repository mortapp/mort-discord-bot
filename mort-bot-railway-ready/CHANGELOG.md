# Changelog

## v3.2.0 — Bugfix & moderation upgrade
**Critical fixes**
- Fixed a syntax error in `/balance` (`src/commands/economy/balance.js`) that crashed command loading for the *entire bot* at startup.
- Fixed `handleReactionAdd` never being imported in `src/index.js` — the starboard feature was completely dead (silently threw `ReferenceError` on every star reaction).
- Fixed the starboard re-posting a duplicate message on every reaction past the threshold instead of editing the existing post; now dedupes via a message-ID map in `dataStore`.
- Fixed `isOwnerAllowed()` failing *open* (allowing everyone) when `OWNER_IDS` wasn't set; added a fail-closed `requireOwner()` guard and a startup warning for the old permissive helper.

**New: Anti-nuke protection** (`src/services/antinukeService.js`)
- Watches the audit log for bursts of destructive actions (channel/role deletes, bans, kicks, webhook creation) and quarantines (strip roles + timeout), kicks, or bans the executor once a configurable threshold is hit.
- Blocks unauthorized bot additions automatically.
- Configurable via `/security antinuke status|toggle|threshold|punishment|bot-protection|whitelist-add|whitelist-remove`.

**New: Warning system & escalation** (`src/utils/escalation.js`, `/mod warn|warnings|delwarn|unban`)
- The `warnings` schema existed but nothing wrote to it. Added `/mod warn`, `/mod warnings`, `/mod delwarn`, and `/mod unban`, plus automatic case numbering.
- Configurable warn → timeout → kick → ban escalation ladder, wired into both manual warnings and automod violations.

**Anti-raid improvements** (`src/services/raidService.js`)
- Added a minimum account-age gate (log or auto-kick new accounts on join).
- Added an auto-unlock timer so panic lockdowns lift themselves after a configurable window instead of staying locked forever.

**Automod improvements** (`src/services/automodService.js`, `/automod`)
- Added spam/flood detection, caps-lock ratio detection, and a small high-confidence scam/phishing pattern set.
- Added bypass roles/channels.
- Automod violations now feed into the warning + escalation system instead of being a dead end.

**Tickets** (`src/services/ticketService.js`, `/ticket`)
- Added transcript generation (posted to mod-logs on close) and close reasons.
- Added claim/unclaim (button + `/ticket unclaim`).
- Added a cooldown on `/ticket open` to prevent spam.

**Performance / reliability** (`src/services/dataStore.js`)
- Added an in-memory cache so `getGuild()` no longer re-reads/re-parses the whole JSON file on every call.
- Writes are now atomic (temp file + rename) so a crash mid-write can't corrupt `mort-memory.json`.

**Stability**
- Added global `unhandledRejection` / `uncaughtException` handlers that log to Mort's insights store instead of failing silently or crashing unrecorded.

## v3.1.0 — Ultimate package
- Added free/no-pay hosting docs.
- Added Oracle Always Free setup guide.
- Added Android Termux setup guide.
- Added Koyeb free setup guide.
- Added AI improvement prompts for Codex, Claude, Cursor, and general coding assistants.
- Added concept blueprint and security/token rules.
- Added full Markdown export of the 1,200-module feature catalog.
- Updated `/cloud` with `/cloud free` and more no-pay provider guides.
- Removed bundled `node_modules` from the ZIP so installs use public npm registry.
- Added helper scripts for `.env`, Termux, and PM2.

## v3.0.0 — Omega
- Added health server, cloud config files, feature catalog, raid tools, backups, logs, and expanded private channels.

## v2.0.1 — Secure
- Updated dependencies and fixed npm audit vulnerabilities.

## v2.0.0 — Mega
- Added strict verification gate, private channels, reaction roles, XP, automod, and expanded server setup.

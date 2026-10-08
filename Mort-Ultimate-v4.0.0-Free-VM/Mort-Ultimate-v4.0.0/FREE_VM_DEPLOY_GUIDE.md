# Mort v4.0.0 — Always-on free-tier VM deployment

This deploys the **full Discord Gateway bot** on one Ubuntu VM. Do not deploy this release as a Vercel serverless function: Vercel functions are time-bounded and do not provide a durable process for Mort’s continuous Discord Gateway session and event listeners.

## Cost and availability warning

A provider’s "Always Free" offer is conditional, not a guarantee that a VM will be available or remain provisioned. For Oracle Cloud, the current published A1 Always Free allowance is up to **2 OCPUs and 12 GB RAM** in the account’s home region, subject to capacity. Oracle says an instance may be reclaimed after a 7-day period when CPU utilization is below 20% at the 95th percentile and network utilization is below 20%; A1 instances also meet the idle definition when memory utilization is below 20%. A small server bot may see low utilization, so this is a real risk—do not assume Oracle will keep it forever. Account signup may require payment-card identity verification; Oracle’s FAQ says verification can place a temporary authorization hold.

Before creating resources, confirm the shape/image is marked **Always Free Eligible** in the Oracle console; do not create paid resources, exceed free limits, or upgrade the account if you require zero spend. Recheck the official limits and your account’s usage/billing screen:

- [Oracle Always Free resource limits](https://docs.oracle.com/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [Oracle Free Tier FAQ](https://www.oracle.com/cloud/free/faq/)
- [Oracle Free Tier lifecycle](https://docs.oracle.com/iaas/Content/FreeTier/freetier.htm)

If the free VM cannot be provisioned, or must not be reclaimed, a spare computer or Android phone you already own is the practical no-cloud-bill alternative (see [`docs/FREE_HOSTING_GUIDE.md`](docs/FREE_HOSTING_GUIDE.md)). Do not use artificial traffic or keep-alive tricks to defeat a host’s idle policy.

## 1. Create one eligible Ubuntu VM

In your provider’s console:

1. Choose your **home region** carefully; Oracle Always Free compute is provisioned in the home region.
2. Select a Linux image labeled Always Free Eligible. Ubuntu 24.04 ARM64 is suitable for an Ampere A1 VM; x86 Ubuntu also works on an eligible AMD micro shape.
3. For Oracle A1, keep the **total across all A1 instances** at or below **2 OCPUs and 12 GB RAM**. A single 1-OCPU, 6-GB VM is ample for this bot and leaves headroom in the free allowance.
4. Keep the boot volume and every other resource within the displayed Always Free limits.
5. Assign a public IP only if you need direct SSH. Add one inbound rule for **TCP 22 restricted to your current IP**. Do not expose Mort’s `PORT`/health endpoint to the public internet. Allow outbound HTTPS/WSS (TCP 443) so Discord Gateway/API access works.
6. Save the SSH private key securely. Do not upload it to GitHub or send it in chat.

## 2. Install Node.js 22 and system tools

SSH into Ubuntu using the account and private key created with the VM, then run:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl unzip
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
sudo bash /tmp/nodesource_setup.sh
rm /tmp/nodesource_setup.sh
sudo apt install -y nodejs
node --version
npm --version
```

Mort supports Node.js `>=20 <23`; Node.js 22 is recommended.

## 3. Upload and install Mort

Upload `Mort-Ultimate-v4.0.0.zip` to the VM using `scp` or a trusted SFTP client. The following commands assume it is at `/tmp/Mort-Ultimate-v4.0.0.zip`:

```bash
sudo adduser --system --group --home /opt/mort mort
sudo mkdir -p /opt/mort/app /opt/mort/data
sudo chown -R mort:mort /opt/mort
sudo -u mort unzip /tmp/Mort-Ultimate-v4.0.0.zip -d /tmp/mort-release
sudo -u mort cp -a /tmp/mort-release/Mort-Ultimate-v4.0.0/. /opt/mort/app/
sudo -u mort bash -lc 'cd /opt/mort/app && npm ci --omit=dev'
```

The JSON state and private server backups will live in `/opt/mort/data`, outside the application update directory. Back up that directory securely.

## 4. Configure secrets and the durable state path

Create the environment file on the VM:

```bash
sudo nano /opt/mort/app/.env
```

Use your own values; never copy credentials from an example or put the token in source control:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_discord_application_id
OWNER_IDS=your_discord_user_id
DATA_FILE=/opt/mort/data/mort-memory.json
PORT=3000
NODE_ENV=production
AUTO_REGISTER_COMMANDS=false
ASSISTANT_ENABLED=true
ASSISTANT_COOLDOWN_SECONDS=8
ASSISTANT_MAX_RESPONSE_LENGTH=1800
```

Then restrict file access and check the configuration:

```bash
sudo chown mort:mort /opt/mort/app/.env
sudo chmod 600 /opt/mort/app/.env
sudo -u mort bash -lc 'cd /opt/mort/app && npm run doctor'
```

`PORT=3000` is optional; it enables local-only health checks. Do not add an internet-facing firewall rule for port 3000. The Discord bot connects outbound to Discord and does not need inbound webhooks for this Gateway-based setup.

## 5. Register slash commands once

Use a real bot token and application ID in `.env`. Register once before enabling the service:

```bash
sudo -u mort bash -lc 'cd /opt/mort/app && npm run register'
```

Set `GUILD_ID` temporarily in `.env` when developing against a test server; remove it when you intend global command registration. Keep `AUTO_REGISTER_COMMANDS=false` so restarts do not repeatedly overwrite commands.

## 6. Install the systemd service

The archive contains [`deploy/mort.service`](deploy/mort.service). Install and start it:

```bash
sudo install -m 0644 /opt/mort/app/deploy/mort.service /etc/systemd/system/mort.service
sudo systemctl daemon-reload
sudo systemctl enable --now mort
sudo systemctl status mort --no-pager
```

View live logs:

```bash
sudo journalctl -u mort -f
```

Expected success log: `Mort is online as ...`. In the Discord Developer Portal, enable **Server Members Intent**, **Message Content Intent**, and the **Moderation** intent used for audit-log protection. Move Mort’s bot role above roles it needs to manage. Start with least privilege; do not grant Administrator by default.

Check readiness locally on the VM (no public port needed):

```bash
curl -i http://127.0.0.1:3000/ready
```

After Discord connects, `/ready` returns HTTP 200. Before that it returns HTTP 503. `/health` is a liveness check, not proof Discord is connected.

## 7. First Discord setup

Run these as a server manager after Mort is online:

```text
/setup server
/setup permissions
/verify status
/mort doctor
/mort dashboard
```

Test in a private/test server first. In particular, verify that `/raid panic` followed by `/raid unlock` restores the original permission overwrites.

## 8. Updating without losing data

Keep the environment file and state data in their dedicated locations. Before an update, stop the bot and take a private backup:

```bash
sudo systemctl stop mort
sudo cp -a /opt/mort/data/mort-memory.json "/opt/mort/data/mort-memory.backup-$(date +%Y%m%d-%H%M%S).json"
```

Upload and extract the new release to a temporary directory, then copy the **application files only** to `/opt/mort/app`. Do not remove `/opt/mort/app/.env`, and never replace `/opt/mort/data`. After copying, run:

```bash
sudo chown -R mort:mort /opt/mort/app /opt/mort/data
sudo chmod 600 /opt/mort/app/.env
sudo -u mort bash -lc 'cd /opt/mort/app && npm ci --omit=dev && npm run doctor'
sudo systemctl start mort
sudo journalctl -u mort -n 50 --no-pager
```

## Common operations

```bash
sudo systemctl status mort
sudo systemctl restart mort
sudo systemctl stop mort
sudo journalctl -u mort -n 100 --no-pager
sudo systemctl is-enabled mort
```

A VM can stop, become capacity-limited, or be reclaimed; retain an offline copy of your data and never rely on the free tier as your only backup.

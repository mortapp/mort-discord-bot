# Mort Free / No-Monthly-Host-Cost Guide

Mort v4 is a **Discord Gateway bot**. It needs one Node.js process to remain connected and receive guild, message, moderation, and voice events. Serverless functions and hosts that sleep are not compatible with all of Mort’s features. A website host such as Vercel can host a dashboard, but it is not a drop-in home for this full Gateway process.

## Practical options

### 1. Oracle Cloud Always Free VM — cloud-hosted, conditional

Oracle documents free VM resources, including a current A1 allocation of up to 2 OCPUs and 12 GB RAM across the tenancy. This can run one Mort bot comfortably **if** a suitable Always Free shape is available in your home region and the account is eligible.

Important trade-offs:

- Capacity can be unavailable; no VM availability guarantee.
- Oracle documents potential reclamation of idle Always Free compute if CPU/network and (for A1) memory usage stay below its stated thresholds over a seven-day period. A quiet bot might qualify.
- Signup can require a payment card for identity verification and may involve a temporary authorization hold.
- Only resources labeled **Always Free Eligible** are in the no-cost allocation. Don’t create paid extras or upgrade if you require zero spend; check the official billing/usage view.

See current [Oracle free compute limits](https://docs.oracle.com/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) and the [official Free Tier FAQ](https://www.oracle.com/cloud/free/faq/). For the install steps, systemd setup, firewall, upgrades, and backup advice, follow [`../FREE_VM_DEPLOY_GUIDE.md`](../FREE_VM_DEPLOY_GUIDE.md).

### 2. A computer or Raspberry Pi you already own — most control

This avoids a cloud-host charge, but uses your electricity and home internet. Keep it powered on and online; install Node.js 22 and configure systemd or another process manager. Restrict your network/router: Mort needs outbound Discord access, not an exposed incoming bot port.

### 3. An Android phone you already own — low cost, less reliable

Termux can run Node.js if the phone stays awake, charging, and online. Android power management may stop background processes; test it before relying on it.

## What not to do

- Do not commit `.env` or upload the bot token publicly.
- Do not use artificial traffic/keep-alive tricks to evade provider idle policies.
- Do not run two copies of Mort with the same token at once.
- Do not grant Administrator by default.
- Do not assume a provider’s word “free” guarantees account approval, capacity, uptime, or zero charges for non-free resources.

## Backups

Keep a separate private copy of `DATA_FILE` (on the VM guide that is `/opt/mort/data/mort-memory.json`). Bot-side backups are not a substitute for a copy outside the host.

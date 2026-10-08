# Oracle Cloud Always Free for Mort

Oracle is one possible no-monthly-instance-cost home for the **full, always-connected Mort Discord bot**. This is not a guarantee of free availability or uninterrupted uptime: Oracle has regional capacity constraints and documents reclamation after a seven-day period when CPU is below 20% at the 95th percentile, network utilization is below 20%, and (for A1) memory utilization is below 20%. A low-traffic bot may be considered idle. Never use artificial traffic tricks to evade that policy.

## Check the current official terms before creating anything

- [Always Free resource limits](https://docs.oracle.com/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm): current A1 compute quota is up to **2 OCPUs and 12 GB RAM total** for Always Free tenancies, provisioned in the home region. Compute capacity may not be available.
- [Oracle Free Tier FAQ](https://www.oracle.com/cloud/free/faq/): Always Free resources do not expire, but signup may require a payment card for identity verification and can result in a temporary authorization hold. The free trial is separate from Always Free.
- [Free Tier lifecycle](https://docs.oracle.com/iaas/Content/FreeTier/freetier.htm): after trial expiry, stay within the Always Free allocation or paid trial resources may be reclaimed.

Only create resources explicitly marked **Always Free Eligible**. Do not choose paid shapes, paid images, extra storage, or paid services; do not upgrade an account if your goal is zero spend. Monitor the usage/billing screen. Eligibility depends on account, region, and available capacity.

## Recommended setup

Use one Ubuntu 24.04 ARM64 Ampere A1 VM sized within quota (for example, 1 OCPU / 6 GB). Keep its state on the VM’s disk at `/opt/mort/data/mort-memory.json`; restrict public ingress to SSH from your own IP, allow outbound TLS to Discord, and leave the bot’s health port closed to the internet.

Follow the complete, tested setup, systemd service installation, secrets, command registration, backup, and update steps in [`../FREE_VM_DEPLOY_GUIDE.md`](../FREE_VM_DEPLOY_GUIDE.md).

## If Oracle cannot provision the VM or reclaims it

There is no way to guarantee Oracle will provide always-on compute at no cost. If it cannot meet the availability you need, use a spare PC/Raspberry Pi or Android phone you already own (see [`../docs/FREE_HOSTING_GUIDE.md`](../docs/FREE_HOSTING_GUIDE.md)) or choose a paid host. Keep an offline backup of `/opt/mort/data`.

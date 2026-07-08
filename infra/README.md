# Infra — provisioning the GCP VM (gcloud runbook)

One small **GCP Compute Engine** VM runs the intake stack (n8n + Caddy).
Everything else lives off this box: the database is **Supabase**, the
frontend is **Vercel**, and the ML pipeline runs offline (its output is
committed to the repo). This VM's only job is giving Telegram / WhatsApp /
the web page one stable HTTPS URL to talk to.

There is **no Terraform** — the whole thing is a handful of `gcloud`
commands you paste into **Cloud Shell** (browser terminal, nothing to
install locally). This replaces the earlier AWS EC2 / Terraform setup.

| | |
|---|---|
| VM | `awaaz-n8n`, `e2-small` (2 GB), Ubuntu 24.04 LTS, 20 GB disk |
| Region / zone | `asia-south1` (Mumbai) / `asia-south1-a` |
| Static IP | `awaaz-ip` (reserved, regional) |
| Firewall | ingress `tcp:80,443` (SSH 22 is open by default) |
| Live URL | https://awaaz.duckdns.org |
| Cost | ~$13–15/mo, covered by the $300 trial credit |

Once the VM exists, bring the stack up and configure n8n by following
[`deploy/README.md`](../deploy/README.md).

---

## 1. Project + Cloud Shell

1. **console.cloud.google.com** → project dropdown → **New Project** →
   name `awaaz` → Create → select it.
2. Open **Cloud Shell** (`>_` icon, top-right) — a browser terminal with
   `gcloud` pre-installed and pre-authenticated. Paste all commands below
   into it.

## 2. Enable Compute Engine

```bash
gcloud services enable compute.googleapis.com
```

(~1 min. If it complains about billing, link the trial-credit billing
account: console → Billing.)

## 3. Reserve a static IP + open the web ports

```bash
gcloud compute addresses create awaaz-ip --region=asia-south1

# print it — you need this IP in step 5 (DuckDNS)
gcloud compute addresses describe awaaz-ip --region=asia-south1 \
  --format='get(address)'

gcloud compute firewall-rules create awaaz-allow-web \
  --direction=INGRESS --action=ALLOW --rules=tcp:80,tcp:443
```

## 4. Create the VM

```bash
gcloud compute instances create awaaz-n8n \
  --zone=asia-south1-a \
  --machine-type=e2-small \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=20GB \
  --address=awaaz-ip
```

`e2-small` (2 GB) is enough for n8n + Caddy with headroom.

## 5. Point DuckDNS at the IP (do this BEFORE bringing up Caddy)

1. **duckdns.org** → log in (GitHub works) → create a subdomain, e.g.
   `awaaz` → gives `awaaz.duckdns.org`. (If taken, pick anything and tell
   the team — it appears in several configs.)
2. Paste the static IP from step 3 into the subdomain's **current ip** box
   → **update ip**. Point it here first, or Caddy's first certificate
   request will fail.

## 6. Install Docker on the VM

Console → **Compute Engine → VM instances** → **SSH** next to `awaaz-n8n`
(browser terminal):

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit
```

Click **SSH** again to reconnect (the group change needs a fresh session),
then continue in [`deploy/README.md`](../deploy/README.md) to bring up the
stack and configure n8n.

---

## Teardown (after the hackathon)

An unattached reserved IP quietly bills a few cents/hour forever, so
release it too:

```bash
gcloud compute instances delete awaaz-n8n --zone=asia-south1-a
gcloud compute addresses delete awaaz-ip --region=asia-south1
```

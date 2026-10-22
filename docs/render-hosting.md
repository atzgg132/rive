# Render free hosting

Fallback host for when Netlify Free pauses the site at its credit cap
(`503 {"error":"usage_exceeded"}`). Supabase PostgreSQL and the private R2 bucket
stay where they are; only the web tier and the scheduler move.

## Why Netlify ran out

`job-dispatch` was scheduled every minute. Each run invoked the dispatcher, a
background function and at least one app route: three function invocations a
minute, around 130k a month, before any visitor traffic. It now runs every
15 minutes, which keeps every job (the 5- and 15-minute ones fire on the same
ticks, the hourly ones at minute 0).

## Service

`render.yaml` is a Blueprint for one free Docker web service built from the
existing `Dockerfile`. Render passes service environment variables to the
Docker build as build args, so `APP_URL` reaches the prerendered metadata.

Environment: paste the production variables exported from Netlify
(`netlify env:list --context production --plain`) with "Add from .env", then
remove the Netlify-only keys, which would otherwise route work to a paused site:

- `HOSTING_PROVIDER` (Render sends the client address in `X-Forwarded-For`)
- `MIGRATION_QUEUE_PROVIDER`, `NETLIFY_SITE_URL`, `NETLIFY_SCHEDULES_ENABLED`
  (without a queue, imports run in-process through the same worker)

## Scheduler

Render Free has no cron and spins a service down after 15 idle minutes.
`.github/workflows/scheduled-jobs.yml` posts to the cron routes every 10 minutes
(hourly and six-hourly jobs at :07), which also keeps the instance warm; the 750
free instance hours cover one service for a full month. It does nothing until
the repository variable `RIVE_JOBS_URL` (the service origin) and secret
`CRON_SECRET` (same value as the app) are set. Scheduled workflows run from the
default branch only.

## DNS (GoDaddy)

Add `www.rive.work` and `rive.work` as custom domains on the service, then at
GoDaddy point `www` CNAME to `<service>.onrender.com` and the apex A record to
the address Render shows. Change only web records; keep nameservers and mail.

## Back to Netlify

Revert the DNS records to `gleeful-starlight-ec822e.netlify.app` / `75.2.60.5`
once the credit cycle resets, and clear `RIVE_JOBS_URL` so the two schedulers
never run together.

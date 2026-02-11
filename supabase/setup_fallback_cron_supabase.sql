-- =====================================================
-- Supabase Cron setup for /api/check-fallback-bookings
-- =====================================================
-- Run this in Supabase SQL Editor (project: production).
--
-- Prerequisites:
-- 1) Extensions enabled: pg_cron, pg_net
-- 2) Set CRON_SECRET in your Vercel env (same value as below)
--
-- Replace placeholders before running:
--   <APP_BASE_URL>      ex: https://app.guidemytable.fr
--   <CRON_SECRET_VALUE> ex: a-long-random-secret

-- 0) Enable extensions (safe if already enabled)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1) Create a wrapper function that calls your API endpoint
create or replace function public.run_fallback_booking_cron()
returns void
language plpgsql
security definer
as $$
begin
  perform net.http_get(
    url := '<APP_BASE_URL>/api/check-fallback-bookings',
    headers := jsonb_build_object(
      'x-cron-secret',
      '<CRON_SECRET_VALUE>'
    )
  );
end;
$$;

-- 2) Unschedule old job if exists (avoid duplicates)
select cron.unschedule('check-fallback-bookings-hourly')
where exists (
  select 1 from cron.job where jobname = 'check-fallback-bookings-hourly'
);

-- 3) Schedule hourly run (at minute 5)
select cron.schedule(
  'check-fallback-bookings-hourly',
  '5 * * * *',
  $$select public.run_fallback_booking_cron();$$
);

-- 4) Verify
select jobid, jobname, schedule, active from cron.job where jobname = 'check-fallback-bookings-hourly';

-- Optional: remove job
-- select cron.unschedule('check-fallback-bookings-hourly');

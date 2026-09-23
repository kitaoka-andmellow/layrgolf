# Security

## Secret placement

| Secret | Browser | Vercel | Fixed-IP VPS |
|---|---:|---:|---:|
| Rakuten Application ID | No | No | Yes |
| Rakuten Access Key | No | No | Yes |
| Rakuten Affiliate ID | No | No | Yes |
| Supabase publishable key | No direct use | Yes | Optional |
| Supabase secret key / legacy service_role key | Never | Never | Yes |

The Supabase secret key (and legacy `service_role`) bypasses RLS. It must never be placed in `web/` or any client-exposed variable.

## Rakuten allowed IP

Rakuten Web Service should allow only the fixed public IPv4 of the synchronization VPS. Do not whitelist Vercel's changing egress range or end-user IPs.

## Key rotation

Rotate the Rakuten Access Key before production if it has been pasted into chat, logs, shell history, screenshots, tickets, or source files. After rotation, update only `/opt/course-code/infra/vps/.env`.

## Logging

The worker sends `accessKey` as an HTTP header instead of a query parameter so request URLs and exception traces do not contain the secret.

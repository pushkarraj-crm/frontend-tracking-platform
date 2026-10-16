# Relay frontend

React + TypeScript + Vite frontend for the FastAPI affiliate tracking platform. All frontend source, dependencies, deployment files and build output live in this folder. The backend is a separate sibling project.

## Run locally

```powershell
cd "D:\Tracking platform\Frontend"
npm ci
npm run dev
```

Open **http://localhost:3000**. Start the existing FastAPI backend on port 8000 and its PostgreSQL service separately. The development proxy sends `/api/*` to `http://127.0.0.1:8000/*`; browser cookies stay on the frontend origin. Refresh cookie paths are rewritten from `/auth` to `/api/auth`.

Copy `.env.example` to `.env.local` to change `API_PROXY_TARGET`. `VITE_API_BASE_URL` defaults to `/api`. Never place secrets in VITE variables: they are public bundle values. Use `localhost:3000` rather than switching between localhost and 127.0.0.1: the backend's configured frontend origin is `http://localhost:3000`.

No demo credentials or invented financial activity are bundled. Create an account through registration if the server enables it, or use an existing account. Development registration may return a session immediately; production requires email verification. Missing policies and disabled registration follow the backend configuration.

## Screens and API mapping

| Screen | API |
| --- | --- |
| Login, registration, recovery | `/auth/login`, `/auth/registration-options`, `/auth/register`, `/auth/csrf`, `/auth/refresh`, `/auth/verify`, `/auth/request-verification`, `/auth/forgot-password`, `/auth/reset-password` |
| Overview | `/reports/summary`, `/reports/grouped`, `/offers`, `/conversions` |
| Offers & targeting | `/offers`, `/offers/{id}`, `/offers/{id}/rules`, `/offers/{id}/rotate-postback-key` |
| Partners / publishers | `/users`, `/users/{id}` |
| Tracking links | `/links`, optional `tracking_domain_id` |
| Conversion review | `/conversions`, `/conversions/{id}` |
| Reports / CSV | `/reports/grouped`, `/reports/clicks`, `/reports/conversions`, `/reports/export/{dataset}` |
| Domains | `/tracking-domains`, `/tracking-domains/{id}/verify`, `/tracking-domains/{id}` |
| Fraud | `/fraud/events`, `/fraud/events/{id}/review` |
| Payouts | `/payouts`, `/payouts/balances`, `/automated-payouts/provider`, `/automated-payouts/beneficiaries`, `/automated-payouts/requests` |
| Billing | `/workspace`, `/billing/plans`, `/billing/subscribe`, `/billing/reconcile`, `/billing/pause`, `/billing/resume`, `/billing/cancel`, `/billing/invoices` |
| Settings | `/workspace`, `/webhooks`, `/deliveries`, `/audit-events`, `/auth/logout`, `/auth/logout-all` |
| Platform owner | `/platform/summary`, `/platform/workspaces`, `/platform/workspaces/{id}` |

The navigation follows the authenticated API role: admin, staff, affiliate, publisher, advertiser, or platform_admin. UI visibility is convenience; FastAPI authorizes every operation. Publishers log in independently; affiliates create publishers. Login has only email/password and no MFA or workspace ID.

Access tokens and CSRF values stay in memory. HttpOnly refresh cookies restore sessions; Web Locks serialize refresh across tabs and BroadcastChannel synchronizes logout. API errors are shown without silently replacing data with examples. Financial inputs are sent as decimal strings. Totals are separated by currency. CSV downloads warn when the server truncates rows. Payout initiation requires explicit in-form authorization, and retrying retains its client request key.

## Checks

```powershell
npm run build
npm test
npm run lint
npm audit
```

`npm run build` performs TypeScript checks and creates `dist/`. Tests cover session credentials, refresh coalescing/retry, CSRF logout, error handling, decimal form submissions and pagination.

## DigitalOcean deployment

Build static assets and serve them behind HTTPS. Dockerfile builds the app and serves with unprivileged Nginx on port 8080. The supplied Nginx template proxies `/api` and rewrites refresh-cookie paths. Set `API_UPSTREAM` to the internal FastAPI service and `API_HOST_HEADER` to the canonical hostname in the backend’s `ALLOWED_HOSTS`. It must be reachable on the container network; API port 8000 should remain private. The frontend Dockerfile is independent of the backend image.

```bash
docker build -t relay-frontend .
docker run --rm -p 8080:8080 -e API_UPSTREAM=http://api:8000 -e API_HOST_HEADER=relay.example.com --network YOUR_APPLICATION_NETWORK relay-frontend
```

Put a TLS gateway in front of this container. Set the backend's `FRONTEND_BASE_URL` and `CORS_ORIGINS` to the exact public frontend origin. Keep frontend and API same-site; if using `/api`, preserve the cookie path rewriting. The backend must accept the proxy Host and trust forwarded protocol only from your ingress. Configure the backend's actual SMTP, legal URLs, GeoIP, Razorpay plans, per-network RazorpayX accounts and verified domains independently.

For a direct API URL instead of `/api`, configure `VITE_API_BASE_URL` at build time and update the Content Security Policy `connect-src` to that exact API origin. Configure credentialed CORS and same-site HTTPS appropriately. No secret belongs in this image or frontend source. API business responses are never service-worker cached.

Live payments, bank transfers and external DNS/TLS require staging verification before release.

# Company dashboard routing

The domain is selected later through server-only COMPANY_BASE_DOMAIN. Backend company mode must also be enabled and configured. The current hosted free preview leaves this unset and continues to use its existing accounts.

Company signup returns a unique company_slug and dashboard_url. The frontend validates that the destination belongs to the backend-configured base domain and redirects to its /login page. No passwords or session tokens are transferred in the URL. Email/password login and host-only refresh cookies remain scoped to that company.

For local testing, start Backend scripts/company_dev.py serve, then in Frontend:

```powershell
$env:API_PROXY_TARGET = 'http://127.0.0.1:8001'
npm run dev -- --port 3001
```

Open http://localhost:3001/register. Media Kendra gets http://media.localhost:3001; duplicate first words get a suffix. Staff, affiliates and publishers log in on the same company address.

Vite derives company routing from *.localhost request hosts. The Vercel API function derives X-Company-Slug from the actual request Host and server-only COMPANY_BASE_DOMAIN; it ignores caller-supplied company headers. Keep API_ORIGIN pointed at the fixed backend origin.

Production requires the chosen apex and wildcard domain, DNS and HTTPS configured on the existing Vercel project. Existing project.vercel.app does not provide arbitrary customer subdomains. Keep backend company mode disabled until existing account migration and database provisioning privileges are ready. See Backend docs/company-databases.md for setup and migration boundaries.

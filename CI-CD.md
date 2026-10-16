# CI/CD - free personal testing

GitHub Actions runs lint, 22 frontend tests, the dependency vulnerability audit, and a production build for pushes and pull requests, on Node 24. Actions are pinned with read-only permissions and timeouts.

Vercel project frontend-tracking-platform (Vedhaka) is connected to this repository, with main as the production branch. Its GitHub app has repository-scoped access. No CI tokens are needed. Vercel runs npm run verify before publishing each Git deployment, so failing lint, tests, audit, or build keeps the current deployment live. The checks run again inside Vercel independently of GitHub notification timing.

Preserve API_ORIGIN and staging settings. Preview branch URLs require explicit backend origin approval for refresh cookies; use the canonical frontend URL for complete authentication testing.

Verify a new main commit passes Actions and is automatically deployed by Vercel. Rollbacks are available in the Vercel dashboard. Hobby remains for personal testing only. No paid features are configured.

# API proxy visitor identity

Before deploying `api/proxy.js`, set the same random `PROXY_IP_SECRET` in the
frontend's Vercel server environment and the backend hosting environment. Use at
least 32 characters, preferably generated with `secrets.token_urlsafe(48)` or a
password manager. Never expose it through a `VITE_*` variable or commit its value.

Deploy the backend signature verification before deploying this frontend proxy.
Requests fail closed with 503 when proxy identity cannot be safely supplied.
The Vite development proxy does not use this handler; local direct development
continues to use the backend's connection identity.

The handler trusts the platform-overwritten `x-forwarded-for` header only when
`VERCEL=1`. On other hosts it uses the socket peer. It does not copy caller-supplied
Relay identity headers. HMAC-SHA256 binds the visitor IP, timestamp, method, raw
target path/query and company slug; the backend accepts a 60-second clock window.
Bearer authentication, CSRF and tenant permissions still authorize each request.

Run `npm test -- tests/proxy.test.js` for the server-side proxy regressions;
`npm test` includes them alongside the existing suite. No live outbound requests
are made by these tests.

Provider reference: https://vercel.com/docs/headers/request-headers

import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: 3000,
      strictPort: true,
      allowedHosts: [".localhost"],
      proxy: {
        "/api": {
          target: env.API_PROXY_TARGET || "http://127.0.0.1:8000",
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq, req) => {
              proxyReq.removeHeader("x-company-slug");
              const hostname = (req.headers.host || "").split(":")[0];
              if (hostname.endsWith(".localhost")) {
                const slug = hostname.slice(0, -".localhost".length);
                if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) proxyReq.setHeader("x-company-slug", slug);
              }
            });
          },
          rewrite: (path: string) => path.replace(/^\/api/, ""),
          cookiePathRewrite: { "/auth": "/api/auth" },
        },
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      restoreMocks: true,
    },
  };
});
